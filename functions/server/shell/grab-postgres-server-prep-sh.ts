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
 * 1. Installs postgresql and postgresql-contrib (idempotent — skipped if
 *    psql is already present).
 * 2. Edits postgresql.conf (listen_addresses, port, max_connections,
 *    shared_buffers) and appends replication/pg_hba rules when replication
 *    is enabled in the service config.
 * 3. Writes /usr/local/bin/tci-postgres-start.sh — a helper called in
 *    `run.start`. If PostgreSQL is already running it exits immediately;
 *    otherwise the primary starts the service and standbys perform
 *    pg_basebackup (if needed) then start.
 * 4. Writes /usr/local/bin/tci-postgres-init.sh — runs idempotent SQL
 *    (users, databases, privileges) only on the primary node after the
 *    cluster is up. Should be called from `run.postflight.cmds`.
 *
 * The script runs SEQUENTIALLY so the primary initialises before standbys
 * attempt pg_basebackup.
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
    const listenAddresses = pgConfig?.listen_addresses ?? "*";
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

    // --- IDEMPOTENT INSTALLATION ---
    finalCmd += `echo "--- TurboCI: Checking/Installing PostgreSQL packages ---"\n`;
    finalCmd += `export DEBIAN_FRONTEND=noninteractive\n`;
    finalCmd += `command -v psql >/dev/null 2>&1 || (\n`;
    finalCmd += `    apt update -qq\n`;
    finalCmd += `    apt install -y postgresql postgresql-contrib\n`;
    finalCmd += `)\n\n`;

    finalCmd += `MY_IP=$(hostname -I | awk '{print $1}')\n`;
    finalCmd += `PG_VERSION=$(pg_lsclusters -h | awk '{print $1}' | head -1)\n`;
    finalCmd += `PG_CONF_DIR="/etc/postgresql/$PG_VERSION/main"\n`;
    finalCmd += `PG_DATA_DIR="/var/lib/postgresql/$PG_VERSION/main"\n\n`;

    // --- IDEMPOTENT CONFIGURATION ---
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

    // --- START SCRIPT ---
    finalCmd += `\ncat > /usr/local/bin/tci-postgres-start.sh << 'STARTEOF'\n`;
    finalCmd += `#!/bin/bash\nset -e\n`;
    finalCmd += `MY_IP=$(hostname -I | awk '{print $1}')\n`;
    finalCmd += `PG_VERSION=$(pg_lsclusters -h | awk '{print $1}' | head -1)\n`;
    finalCmd += `PG_DATA_DIR="/var/lib/postgresql/$PG_VERSION/main"\n\n`;

    // If PostgreSQL is already running, don't try to start it again
    finalCmd += `if systemctl is-active --quiet postgresql; then\n`;
    finalCmd += `    echo "TurboCI: PostgreSQL is already running."\n`;
    finalCmd += `    systemctl restart postgresql\n`;
    finalCmd += `    exit 0\n`;
    finalCmd += `fi\n\n`;

    finalCmd += `if [ "$MY_IP" = "${primaryNodeIP}" ]; then\n`;
    finalCmd += `    echo "TurboCI: Starting Primary Node ($MY_IP)..."\n`;
    finalCmd += `    systemctl start postgresql\n`;
    finalCmd += `else\n`;
    finalCmd += `    echo "TurboCI: Managing Standby Node ($MY_IP)..."\n`;

    finalCmd += `    if [ ! -s "$PG_DATA_DIR/PG_VERSION" ]; then\n`;
    finalCmd += `        echo "TurboCI: Initial sync from primary ${primaryNodeIP}..."\n`;
    finalCmd += `        systemctl stop postgresql || true\n`;
    finalCmd += `        rm -rf $PG_DATA_DIR/*\n`;

    finalCmd += `        export PGPASSWORD='${replication?.password}'\n`;
    finalCmd += `        SAFE_SLOT="replica_$(hostname -s | tr '-' '_')"\n`;

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

    finalCmd += `        touch $PG_DATA_DIR/standby.signal\n`;
    finalCmd += `        chown -R postgres:postgres $PG_DATA_DIR\n`;
    finalCmd += `        chmod 700 $PG_DATA_DIR\n`;
    finalCmd += `        unset PGPASSWORD\n`;
    finalCmd += `    fi\n`;

    finalCmd += `    echo "TurboCI: Starting PostgreSQL Service..."\n`;
    finalCmd += `    systemctl enable postgresql\n`;
    finalCmd += `    systemctl start postgresql\n`;

    finalCmd += `    sleep 2\n`;
    finalCmd += `    if ! systemctl is-active --quiet postgresql; then\n`;
    finalCmd += `        echo "ERROR: PostgreSQL failed to start. Checking logs..."\n`;
    finalCmd += `        tail -n 20 /var/log/postgresql/postgresql-$PG_VERSION-main.log\n`;
    finalCmd += `        exit 1\n`;
    finalCmd += `    fi\n`;
    finalCmd += `fi\n`;
    finalCmd += `STARTEOF\n`;
    finalCmd += `chmod +x /usr/local/bin/tci-postgres-start.sh\n`;

    // --- SQL INIT (Idempotent) ---
    const initSqlLines: string[] = [];

    if (rootPassword) {
        initSqlLines.push(`ALTER USER postgres PASSWORD '${rootPassword}';`);
    }

    if (replication?.enabled && replication.user && replication.password) {
        initSqlLines.push(
            `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='${replication.user}') THEN CREATE USER ${replication.user} WITH REPLICATION ENCRYPTED PASSWORD '${replication.password}'; END IF; END $$;`,
        );
    }

    if (pgConfig?.databases) {
        for (const db of pgConfig.databases) {
            initSqlLines.push(
                `SELECT 'CREATE DATABASE ${db.name}' WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname='${db.name}')\\gexec`,
            );

            if (db.user && db.password) {
                initSqlLines.push(
                    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='${db.user}') THEN CREATE USER ${db.user} WITH ENCRYPTED PASSWORD '${db.password}'; END IF; END $$;`,
                );
                initSqlLines.push(
                    `ALTER USER ${db.user} WITH ENCRYPTED PASSWORD '${db.password}';`,
                );
                initSqlLines.push(
                    `GRANT ALL PRIVILEGES ON DATABASE ${db.name} TO ${db.user};`,
                );
                initSqlLines.push(`\\connect ${db.name}`);
                initSqlLines.push(
                    `GRANT USAGE, CREATE ON SCHEMA public TO ${db.user};`,
                );
                initSqlLines.push(`ALTER SCHEMA public OWNER TO ${db.user};`);
                initSqlLines.push(`\\connect postgres`);
            }
        }
    }

    // Write SQL and Init script
    finalCmd += `\ncat > /usr/local/bin/tci-postgres-init.sql << 'INITEOF'\n${initSqlLines.join("\n")}\nINITEOF\n\n`;

    finalCmd += `cat > /usr/local/bin/tci-postgres-init.sh << 'INITSHEOF'\n`;
    finalCmd += `#!/bin/bash\nset -e\n`;
    finalCmd += `MY_IP=$(hostname -I | awk '{print $1}')\n`;
    finalCmd += `if [ "$MY_IP" = "${primaryNodeIP}" ]; then\n`;
    finalCmd += `    echo "TurboCI: Running PostgreSQL init SQL..."\n`;
    finalCmd += `    sudo -u postgres psql < /usr/local/bin/tci-postgres-init.sql || echo "SQL Init failed"\n`;
    finalCmd += `fi\n`;
    finalCmd += `INITSHEOF\n`;
    finalCmd += `chmod +x /usr/local/bin/tci-postgres-init.sh\n`;

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
