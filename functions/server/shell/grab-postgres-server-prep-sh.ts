import type {
    ParsedDeploymentServiceConfig,
    TCIGlobalConfig,
} from "@/types";
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

    // The first IP in the list becomes the primary
    const primaryNodeIP = private_server_ips[0]?.replace(/"/g, "") ?? "";

    const defaultPrepCmd = await grabDefaultServicePrepSH({ service, deployment });

    let finalCmd = defaultPrepCmd;

    finalCmd += `echo "--- TurboCI: Installing PostgreSQL ---"\n`;
    finalCmd += `apt update -qq\n`;
    finalCmd += `apt install -y postgresql postgresql-contrib\n`;
    finalCmd += `systemctl stop postgresql 2>/dev/null || true\n\n`;

    // Detect own IP and PostgreSQL version/paths at runtime
    finalCmd += `MY_IP=$(hostname -I | awk '{print $1}')\n`;
    finalCmd += `PG_VERSION=$(pg_lsclusters -h | awk '{print $1}' | head -1)\n`;
    finalCmd += `PG_CONF_DIR="/etc/postgresql/$PG_VERSION/main"\n`;
    finalCmd += `PG_DATA_DIR="/var/lib/postgresql/$PG_VERSION/main"\n\n`;

    // Apply postgresql.conf settings using sed (idempotent)
    finalCmd += `echo "--- TurboCI: Configuring postgresql.conf ---"\n`;
    finalCmd += `# listen_addresses\n`;
    finalCmd += `grep -q "^listen_addresses" $PG_CONF_DIR/postgresql.conf \\\n`;
    finalCmd += `    && sed -i "s|^listen_addresses.*|listen_addresses = '${listenAddresses}'|" $PG_CONF_DIR/postgresql.conf \\\n`;
    finalCmd += `    || echo "listen_addresses = '${listenAddresses}'" >> $PG_CONF_DIR/postgresql.conf\n`;
    finalCmd += `# port\n`;
    finalCmd += `sed -i "s|^#\\?port\\s*=.*|port = ${port}|" $PG_CONF_DIR/postgresql.conf\n`;
    finalCmd += `# max_connections\n`;
    finalCmd += `sed -i "s|^#\\?max_connections\\s*=.*|max_connections = ${maxConnections}|" $PG_CONF_DIR/postgresql.conf\n`;
    finalCmd += `# shared_buffers\n`;
    finalCmd += `sed -i "s|^#\\?shared_buffers\\s*=.*|shared_buffers = ${sharedBuffers}|" $PG_CONF_DIR/postgresql.conf\n`;

    if (replication?.enabled) {
        const maxWalSenders = replication.max_wal_senders ?? 5;
        finalCmd += `# replication\n`;
        finalCmd += `sed -i "s|^#\\?wal_level\\s*=.*|wal_level = replica|" $PG_CONF_DIR/postgresql.conf\n`;
        finalCmd += `sed -i "s|^#\\?max_wal_senders\\s*=.*|max_wal_senders = ${maxWalSenders}|" $PG_CONF_DIR/postgresql.conf\n`;
        finalCmd += `sed -i "s|^#\\?hot_standby\\s*=.*|hot_standby = on|" $PG_CONF_DIR/postgresql.conf\n`;
    }

    // pg_hba.conf — allow remote connections and replication
    finalCmd += `\necho "--- TurboCI: Configuring pg_hba.conf ---"\n`;
    finalCmd += `grep -q "^host all all 0.0.0.0/0" $PG_CONF_DIR/pg_hba.conf \\\n`;
    finalCmd += `    || echo "host all all 0.0.0.0/0 md5" >> $PG_CONF_DIR/pg_hba.conf\n`;

    if (replication?.enabled && replication.user) {
        finalCmd += `grep -q "^host replication ${replication.user}" $PG_CONF_DIR/pg_hba.conf \\\n`;
        finalCmd += `    || echo "host replication ${replication.user} 0.0.0.0/0 md5" >> $PG_CONF_DIR/pg_hba.conf\n`;
    }

    // Build the TCI start helper
    finalCmd += `\ncat > /usr/local/bin/tci-postgres-start.sh << 'STARTEOF'\n`;
    finalCmd += `#!/bin/bash\n`;
    finalCmd += `set -e\n`;
    finalCmd += `MY_IP=$(hostname -I | awk '{print $1}')\n`;
    finalCmd += `PG_VERSION=$(pg_lsclusters -h | awk '{print $1}' | head -1)\n`;
    finalCmd += `PG_DATA_DIR="/var/lib/postgresql/$PG_VERSION/main"\n\n`;

    finalCmd += `if [ "$MY_IP" = "${primaryNodeIP}" ]; then\n`;
    finalCmd += `    echo "TurboCI: Starting as PostgreSQL primary ($MY_IP) ..."\n`;
    finalCmd += `    systemctl start postgresql\n`;

    if (rootPassword) {
        finalCmd += `    sudo -u postgres psql -c "ALTER USER postgres PASSWORD '${rootPassword}';"\n`;
    }

    if (replication?.enabled && replication.user && replication.password) {
        finalCmd += `    sudo -u postgres psql -c "CREATE USER ${replication.user} WITH REPLICATION ENCRYPTED PASSWORD '${replication.password}';" 2>/dev/null || true\n`;
    }

    if (pgConfig?.databases?.[0]) {
        for (const db of pgConfig.databases) {
            finalCmd += `    sudo -u postgres psql -c "CREATE DATABASE ${db.name};" 2>/dev/null || true\n`;
            if (db.user && db.password) {
                finalCmd += `    sudo -u postgres psql -c "CREATE USER ${db.user} WITH ENCRYPTED PASSWORD '${db.password}';" 2>/dev/null || true\n`;
                finalCmd += `    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${db.name} TO ${db.user};"\n`;
            }
        }
    }

    finalCmd += `else\n`;
    finalCmd += `    echo "TurboCI: Starting as PostgreSQL standby — syncing from primary ${primaryNodeIP} ..."\n`;

    if (replication?.enabled && replication.user && replication.password) {
        finalCmd += `    systemctl stop postgresql 2>/dev/null || true\n`;
        finalCmd += `    rm -rf $PG_DATA_DIR/*\n`;
        finalCmd += `    sudo -u postgres pg_basebackup -h ${primaryNodeIP} -U ${replication.user} \\\n`;
        finalCmd += `        -X stream -C --slot="replica_$(hostname -s)" --create-slot 2>/dev/null \\\n`;
        finalCmd += `        -D $PG_DATA_DIR --checkpoint=fast -R -P\n`;
    }

    finalCmd += `    systemctl start postgresql\n`;
    finalCmd += `fi\n`;
    finalCmd += `STARTEOF\n`;
    finalCmd += `chmod +x /usr/local/bin/tci-postgres-start.sh\n`;

    // Run sequentially: primary must be up before standbys run pg_basebackup
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
