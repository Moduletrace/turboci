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
 * Generates the shell script that runs on every MySQL node during the
 * prepare phase:
 *
 * 1. Installs mysql-server.
 * 2. Writes /etc/mysql/conf.d/tci-replication.cnf with server-id (1 for
 *    the primary, derived from the last IP octet for replicas), binlog,
 *    GTID, and bind-address settings.
 * 3. Writes /usr/local/bin/tci-mysql-start.sh — a helper called from
 *    `run.start`:
 *    - Primary (first IP): starts MySQL, sets the root password, creates the
 *      replication user, creates application databases and users.
 *    - Replicas: start MySQL, then issue CHANGE REPLICATION SOURCE TO to
 *      point at the primary and START REPLICA.
 *
 * The script runs SEQUENTIALLY so the primary is running before replicas
 * attempt to connect.
 *
 * MySQL is supported by both ProxySQL (query routing + read/write split) and
 * MaxScale (readwritesplit router with mariadbmon monitor). HAProxy can also
 * be used for simple TCP load balancing with `option mysql-check`.
 */
export default async function grabMysqlServerPrepSH({
    private_server_ips,
    service,
    deployment,
    bun,
}: Params) {
    const mysqlConfig = service.mysql;
    const port = mysqlConfig?.port ?? 3306;
    const bindAddress = mysqlConfig?.bind_address ?? "0.0.0.0";
    const maxConnections = mysqlConfig?.max_connections ?? 151;
    const rootPassword = mysqlConfig?.root_password ?? "";
    const replication = mysqlConfig?.replication;

    // The first IP in the list becomes the primary (server-id = 1)
    const primaryNodeIP = private_server_ips[0]?.replace(/"/g, "") ?? "";

    const defaultPrepCmd = await grabDefaultServicePrepSH({ service, deployment });

    let finalCmd = defaultPrepCmd;

    finalCmd += `echo "--- TurboCI: Installing MySQL ---"\n`;
    finalCmd += `export DEBIAN_FRONTEND=noninteractive\n`;
    finalCmd += `apt update -qq\n`;
    finalCmd += `apt install -y mysql-server\n`;
    finalCmd += `systemctl stop mysql 2>/dev/null || true\n\n`;

    // Detect own IP at runtime to set the correct server-id
    finalCmd += `MY_IP=$(hostname -I | awk '{print $1}')\n`;
    finalCmd += `if [ "$MY_IP" = "${primaryNodeIP}" ]; then\n`;
    finalCmd += `    TCI_SERVER_ID=1\n`;
    finalCmd += `else\n`;
    // Derive a unique server-id from the last IP octet; avoid collisions with 1
    finalCmd += `    TCI_SERVER_ID=$(echo $MY_IP | awk -F. '{print $4}')\n`;
    finalCmd += `    [ "$TCI_SERVER_ID" = "1" ] && TCI_SERVER_ID=2\n`;
    finalCmd += `fi\n\n`;

    // Write /etc/mysql/conf.d/tci-replication.cnf
    finalCmd += `mkdir -p /etc/mysql/conf.d\n`;

    // Using a temp file so we can embed the runtime $TCI_SERVER_ID variable
    finalCmd += `cat > /etc/mysql/conf.d/tci-replication.cnf << MYSQLEOF\n`;
    finalCmd += `[mysqld]\n`;
    finalCmd += `server-id = \${TCI_SERVER_ID}\n`;
    finalCmd += `bind-address = ${bindAddress}\n`;
    finalCmd += `port = ${port}\n`;
    finalCmd += `max_connections = ${maxConnections}\n`;

    if (replication?.enabled) {
        finalCmd += `log_bin = /var/log/mysql/mysql-bin.log\n`;
        finalCmd += `binlog_format = ROW\n`;
        finalCmd += `gtid_mode = ON\n`;
        finalCmd += `enforce_gtid_consistency = ON\n`;
        finalCmd += `log_replica_updates = ON\n`;
    }

    finalCmd += `MYSQLEOF\n\n`;

    // Build the TCI start helper
    const rootFlag = rootPassword ? `-p'${rootPassword}'` : "";

    finalCmd += `cat > /usr/local/bin/tci-mysql-start.sh << 'STARTEOF'\n`;
    finalCmd += `#!/bin/bash\n`;
    finalCmd += `set -e\n`;
    finalCmd += `MY_IP=$(hostname -I | awk '{print $1}')\n\n`;

    finalCmd += `if [ "$MY_IP" = "${primaryNodeIP}" ]; then\n`;
    finalCmd += `    echo "TurboCI: Starting as MySQL primary ($MY_IP) ..."\n`;
    finalCmd += `    systemctl start mysql\n`;

    if (rootPassword) {
        finalCmd += `    mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '${rootPassword}'; FLUSH PRIVILEGES;" 2>/dev/null || true\n`;
    }

    if (replication?.enabled && replication.user && replication.password) {
        finalCmd += `    mysql -u root ${rootFlag} -e "CREATE USER IF NOT EXISTS '${replication.user}'@'%' IDENTIFIED BY '${replication.password}'; GRANT REPLICATION SLAVE ON *.* TO '${replication.user}'@'%'; FLUSH PRIVILEGES;"\n`;
    }

    if (mysqlConfig?.databases?.[0]) {
        for (const db of mysqlConfig.databases) {
            const charset = db.charset ?? "utf8mb4";
            const collation = db.collation ?? "utf8mb4_unicode_ci";
            finalCmd += `    mysql -u root ${rootFlag} -e "CREATE DATABASE IF NOT EXISTS \\\`${db.name}\\\` CHARACTER SET ${charset} COLLATE ${collation};" 2>/dev/null || true\n`;
            if (db.user && db.password) {
                finalCmd += `    mysql -u root ${rootFlag} -e "CREATE USER IF NOT EXISTS '${db.user}'@'%' IDENTIFIED BY '${db.password}'; GRANT ALL PRIVILEGES ON \\\`${db.name}\\\`.* TO '${db.user}'@'%'; FLUSH PRIVILEGES;"\n`;
            }
        }
    }

    finalCmd += `else\n`;
    finalCmd += `    echo "TurboCI: Starting as MySQL replica — connecting to primary ${primaryNodeIP} ..."\n`;
    finalCmd += `    systemctl start mysql\n`;

    if (replication?.enabled && replication.user && replication.password) {
        finalCmd += `    mysql -u root ${rootFlag} -e "STOP REPLICA; CHANGE REPLICATION SOURCE TO SOURCE_HOST='${primaryNodeIP}', SOURCE_USER='${replication.user}', SOURCE_PASSWORD='${replication.password}', SOURCE_AUTO_POSITION=1; START REPLICA;"\n`;
    }

    finalCmd += `fi\n`;
    finalCmd += `STARTEOF\n`;
    finalCmd += `chmod +x /usr/local/bin/tci-mysql-start.sh\n`;

    // Run sequentially: primary must be running before replicas connect
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
