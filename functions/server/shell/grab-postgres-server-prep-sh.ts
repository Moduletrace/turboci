import type { ParsedDeploymentServiceConfig, TCIGlobalConfig } from "@/types";
import bunGrabPrivateIPsBulkScripts from "@/utils/bun-scripts/bun-grab-private-ips-bulk-scripts";
import grabPrivateIPsBulkScripts from "@/utils/ssh/shell-scripts/grab-private-ips-bulk-scripts";
import grabDefaultServicePrepSH from "./grab-default-service-prep-sh";

type Params = {
    private_server_ips: string[];
    service: ParsedDeploymentServiceConfig;
    deployment: TCIGlobalConfig;
    bun?: boolean;
};

/**
 * Generates the shell script that runs on every PostgreSQL node during
 * the prepare phase:
 *
 * 1. Installs postgresql and postgresql-contrib.
 * 2. Edits postgresql.conf (listen_addresses, port, max_connections,
 *    shared_buffers) and appends replication/pg_hba rules when replication
 *    is enabled in the service config.
 * 3. Writes /usr/local/bin/tci-postgres-start.sh — a helper that detects
 *    whether the node is the primary (first IP in the list) or a standby:
 *    - Primary: starts PostgreSQL, creates the replication user, creates
 *      databases and application users, and runs FLUSH PRIVILEGES.
 *    - Standby: runs pg_basebackup against the primary to copy the data
 *      directory, then starts PostgreSQL in hot-standby mode.
 *
 * The script runs SEQUENTIALLY so the primary initialises before standbys
 * attempt pg_basebackup. Users should call tci-postgres-start.sh from
 * their `run.start` script.
 *
 * PostgreSQL is NOT supported by MaxScale or ProxySQL — use HAProxy
 * (with `option pgsql-check`) for client-facing load balancing.
 */
export default async function grabPostgresServerPrepSH({
    private_server_ips,
    service,
    deployment,
    bun,
}: Params) {
    const pgConfig = service.postgres;
    const port = pgConfig?.port ?? 5432;
    const listenAddresses = pgConfig?.listen_addresses ?? "localhost";
    const maxConnections = pgConfig?.max_connections ?? 100;
    const sharedBuffers = pgConfig?.shared_buffers ?? "128MB";
    const rootPassword = pgConfig?.root_password ?? "";
    const replication = pgConfig?.replication;

    const primaryNodeIP = private_server_ips[0]?.replace(/"/g, "") ?? "";
    const defaultPrepCmd = await grabDefaultServicePrepSH({
        service,
        deployment,
    });

    let finalCmd = defaultPrepCmd;

    finalCmd += `echo "--- TurboCI: Ensuring PostgreSQL is installed ---"\n`;
    finalCmd += `apt update -qq\n`;
    finalCmd += `apt install -y postgresql postgresql-contrib\n`;

    // Detect environment
    finalCmd += `MY_IP=$(hostname -I | awk '{print $1}')\n`;
    finalCmd += `PG_VERSION=$(pg_lsclusters -h | awk '{print $1}' | head -1)\n`;
    finalCmd += `PG_CONF_DIR="/etc/postgresql/$PG_VERSION/main"\n`;
    finalCmd += `PG_DATA_DIR="/var/lib/postgresql/$PG_VERSION/main"\n\n`;

    finalCmd += `echo "--- TurboCI: Updating postgresql.conf (Idempotent) ---"\n`;
    const updateConf = (key: string, value: string | number) => {
        return `grep -q "^${key}\\s*=" $PG_CONF_DIR/postgresql.conf && sed -i "s|^${key}.*|${key} = '${value}'|" $PG_CONF_DIR/postgresql.conf || echo "${key} = '${value}'" >> $PG_CONF_DIR/postgresql.conf\n`;
    };

    finalCmd += updateConf("listen_addresses", listenAddresses);
    finalCmd += updateConf("port", port);
    finalCmd += updateConf("max_connections", maxConnections);
    finalCmd += updateConf("shared_buffers", sharedBuffers);

    if (replication?.enabled) {
        finalCmd += updateConf("wal_level", "replica");
        finalCmd += updateConf(
            "max_wal_senders",
            replication.max_wal_senders ?? 5,
        );
        finalCmd += updateConf("hot_standby", "on");
    }

    finalCmd += `\necho "--- TurboCI: Configuring pg_hba.conf ---"\n`;
    finalCmd += `grep -q "host all all 0.0.0.0/0 md5" $PG_CONF_DIR/pg_hba.conf || echo "host all all 0.0.0.0/0 md5" >> $PG_CONF_DIR/pg_hba.conf\n`;

    if (replication?.enabled && replication.user) {
        finalCmd += `grep -q "host replication ${replication.user}" $PG_CONF_DIR/pg_hba.conf || echo "host replication ${replication.user} 0.0.0.0/0 md5" >> $PG_CONF_DIR/pg_hba.conf\n`;
    }

    // Start helper generation
    finalCmd += `\ncat > /usr/local/bin/tci-postgres-start.sh << 'STARTEOF'\n`;
    finalCmd += `#!/bin/bash\nset -e\n`;
    finalCmd += `MY_IP=$(hostname -I | awk '{print $1}')\n`;
    finalCmd += `PG_VERSION=$(pg_lsclusters -h | awk '{print $1}' | head -1)\n`;
    finalCmd += `PG_DATA_DIR="/var/lib/postgresql/$PG_VERSION/main"\n\n`;

    finalCmd += `if [ "$MY_IP" = "${primaryNodeIP}" ]; then\n`;
    finalCmd += `    echo "TurboCI: Managing Primary Node ($MY_IP)..."\n`;
    finalCmd += `    systemctl start postgresql\n`;

    if (rootPassword) {
        finalCmd += `    sudo -u postgres psql -c "ALTER USER postgres PASSWORD '${rootPassword}';"\n`;
    }

    if (replication?.enabled && replication.user && replication.password) {
        finalCmd += `    sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${replication.user}'" | grep -q 1 || sudo -u postgres psql -c "CREATE USER ${replication.user} WITH REPLICATION ENCRYPTED PASSWORD '${replication.password}';"\n`;
    }

    if (pgConfig?.databases) {
        for (const db of pgConfig.databases) {
            // Idempotent Database & User creation
            finalCmd += `    echo "TurboCI: Ensuring database ${db.name} exists..."\n`;
            finalCmd += `    sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${db.name}'" | grep -q 1 || sudo -u postgres psql -c "CREATE DATABASE ${db.name};"\n`;

            if (db.user && db.password) {
                finalCmd += `    sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${db.user}'" | grep -q 1 || sudo -u postgres psql -c "CREATE USER ${db.user} WITH ENCRYPTED PASSWORD '${db.password}';"\n`;
                finalCmd += `    sudo -u postgres psql -c "ALTER USER ${db.user} WITH ENCRYPTED PASSWORD '${db.password}';"\n`;
                finalCmd += `    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${db.name} TO ${db.user};"\n`;

                // Fix Permission Denied for Public Schema
                finalCmd += `    sudo -u postgres psql -d ${db.name} -c "GRANT USAGE, CREATE ON SCHEMA public TO ${db.user};"\n`;
                finalCmd += `    sudo -u postgres psql -d ${db.name} -c "ALTER SCHEMA public OWNER TO ${db.user};"\n`;
            }
        }
    }

    // ... inside the else block (Standby Node) ...
    finalCmd += `else\n`;
    finalCmd += `    echo "TurboCI: Managing Standby Node ($MY_IP)..."\n`;

    // 1. Only sync if the data directory is empty/uninitialized
    finalCmd += `    if [ ! -s "$PG_DATA_DIR/PG_VERSION" ]; then\n`;
    finalCmd += `        echo "TurboCI: Initial sync from primary ${primaryNodeIP}..."\n`;
    finalCmd += `        systemctl stop postgresql || true\n`;
    finalCmd += `        rm -rf $PG_DATA_DIR/*\n`;

    finalCmd += `        export PGPASSWORD='${replication?.password}'\n`;
    finalCmd += `        SAFE_SLOT="replica_$(hostname -s | tr '-' '_')"\n`;

    // 2. Explicitly target 'postgres' database for the slot check
    finalCmd += `        SLOT_EXISTS=$(sudo -E -u postgres psql -h ${primaryNodeIP} -U ${replication?.user} -d postgres -tAc "SELECT 1 FROM pg_replication_slots WHERE slot_name='$SAFE_SLOT'" || echo "0")\n`;

    if (replication?.enabled && replication.user) {
        finalCmd += `        if [ "$SLOT_EXISTS" = "1" ]; then\n`;
        finalCmd += `            echo "TurboCI: Slot $SAFE_SLOT exists. Syncing..."\n`;
        finalCmd += `            sudo -E -u postgres pg_basebackup -h ${primaryNodeIP} -U ${replication.user} -D $PG_DATA_DIR -X stream -R -P\n`;
        finalCmd += `        else\n`;
        finalCmd += `            echo "TurboCI: Creating slot $SAFE_SLOT and syncing..."\n`;
        finalCmd += `            sudo -E -u postgres pg_basebackup -h ${primaryNodeIP} -U ${replication.user} -D $PG_DATA_DIR -X stream -C --slot="$SAFE_SLOT" --create-slot -R -P\n`;
        finalCmd += `        fi\n`;
    }

    // 3. CRITICAL: Ensure the signal file exists and permissions are correct
    finalCmd += `        touch $PG_DATA_DIR/standby.signal\n`;
    finalCmd += `        chown -R postgres:postgres $PG_DATA_DIR\n`;
    finalCmd += `        chmod 700 $PG_DATA_DIR\n`;
    finalCmd += `        unset PGPASSWORD\n`;
    finalCmd += `    fi\n`;

    // 4. Start and enable
    finalCmd += `    echo "TurboCI: Starting PostgreSQL Service..."\n`;
    finalCmd += `    systemctl enable postgresql\n`;
    finalCmd += `    systemctl start postgresql\n`;

    // 5. Verification Check
    finalCmd += `    sleep 2\n`;
    finalCmd += `    if ! systemctl is-active --quiet postgresql; then\n`;
    finalCmd += `        echo "ERROR: PostgreSQL failed to start. Checking logs..."\n`;
    finalCmd += `        tail -n 20 /var/log/postgresql/postgresql-$PG_VERSION-main.log\n`;
    finalCmd += `        exit 1\n`;
    finalCmd += `    fi\n`;
    finalCmd += `fi\n`;

    finalCmd += `STARTEOF\n`;
    finalCmd += `chmod +x /usr/local/bin/tci-postgres-start.sh\n`;

    return bun
        ? bunGrabPrivateIPsBulkScripts({
              private_server_ips,
              script: finalCmd,
              parrallel: false,
          })
        : grabPrivateIPsBulkScripts({
              private_server_ips,
              script: finalCmd,
              parrallel: false,
          });
}
