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
 * Generates the shell script that runs on every MariaDB Galera node
 * during the prepare phase:
 *
 * 1. Installs mariadb-server, mariadb-backup, galera-4, socat.
 * 2. Writes /etc/mysql/conf.d/galera.cnf with the cluster address containing
 *    ALL node IPs (known at deploy time). Each node detects its own private
 *    IP at runtime via `hostname -I` and substitutes it for wsrep_node_address.
 * 3. Writes /usr/local/bin/tci-galera-start.sh — a helper called in
 *    `run.start`. The first node in private_server_ips bootstraps the cluster
 *    with `galera_new_cluster`; subsequent nodes join with `systemctl start mariadb`.
 * 4. Writes /usr/local/bin/tci-galera-init.sh — runs CREATE DATABASE/USER
 *    SQL only on the bootstrap node after the cluster is up.
 *
 * The script runs SEQUENTIALLY (not in parallel) across nodes so the
 * bootstrap node's config is written before any joiner node starts.
 * Users should call the generated helpers from their `run.start` scripts.
 */
export default async function grabMariadbGaleraServerPrepSH({
    private_server_ips,
    service,
    deployment,
    bun,
}: Params) {
    const galeraConfig = service.mariadb_galera;
    const clusterName = galeraConfig?.cluster_name ?? "turboci_galera_cluster";
    const sstMethod = galeraConfig?.sst_method ?? "mariabackup";
    const port = galeraConfig?.port ?? 3306;
    const bindAddress = galeraConfig?.bind_address ?? "0.0.0.0";
    const rootPassword = galeraConfig?.root_password ?? "";

    const bootstrapNodeIP = private_server_ips[0]?.replace(/"/g, "") ?? "";
    const clusterAddressIPs = private_server_ips
        .map((ip) => ip.replace(/"/g, ""))
        .join(",");

    const defaultPrepCmd = await grabDefaultServicePrepSH({
        service,
        deployment,
    });

    let finalCmd = defaultPrepCmd;

    // --- IDEMPOTENT INSTALLATION ---
    finalCmd += `echo "--- TurboCI: Checking/Installing MariaDB Galera packages ---"\n`;
    finalCmd += `export DEBIAN_FRONTEND=noninteractive\n`;
    // Only install if mariadb isn't present to save time/bandwidth on re-runs
    finalCmd += `command -v mariadbd >/dev/null 2>&1 || (\n`;
    finalCmd += `    apt update -qq\n`;
    finalCmd += `    apt install -y mariadb-server mariadb-backup galera-4 socat rsync\n`;
    finalCmd += `)\n\n`;

    finalCmd += `MY_IP=$(hostname -I | awk '{print $1}')\n\n`;

    // --- IDEMPOTENT CONFIGURATION ---
    finalCmd += `mkdir -p /etc/mysql/conf.d\n`;
    finalCmd += `cat > /etc/mysql/conf.d/galera.cnf << 'GALERAEOF'\n`;
    finalCmd += `[mysqld]\n`;
    finalCmd += `binlog_format=ROW\n`;
    finalCmd += `default-storage-engine=InnoDB\n`;
    finalCmd += `innodb_autoinc_lock_mode=2\n`;
    finalCmd += `bind-address=${bindAddress}\n`;
    finalCmd += `port=${port}\n`;
    finalCmd += `wsrep_on=ON\n`;
    finalCmd += `wsrep_provider=/usr/lib/galera/libgalera_smm.so\n`;
    finalCmd += `wsrep_cluster_name="${clusterName}"\n`;
    finalCmd += `wsrep_cluster_address="gcomm://${clusterAddressIPs}"\n`;
    finalCmd += `wsrep_sst_method=${sstMethod}\n`;
    finalCmd += `wsrep_node_address="__TCI_NODE_IP__"\n`;
    finalCmd += `wsrep_node_name="galera-$(hostname -s)"\n`;
    finalCmd += `GALERAEOF\n\n`;

    finalCmd += `sed -i "s/__TCI_NODE_IP__/$MY_IP/" /etc/mysql/conf.d/galera.cnf\n\n`;

    // --- START SCRIPT ---
    finalCmd += `cat > /usr/local/bin/tci-galera-start.sh << 'STARTEOF'\n`;
    finalCmd += `#!/bin/bash\n`;
    finalCmd += `MY_IP=$(hostname -I | awk '{print $1}')\n`;
    // If MariaDB is already running, don't try to bootstrap/start it again
    finalCmd += `if systemctl is-active --quiet mariadb; then\n`;
    finalCmd += `    echo "TurboCI: MariaDB is already running."\n`;
    finalCmd += `    exit 0\n`;
    finalCmd += `fi\n`;
    finalCmd += `if [ "$MY_IP" = "${bootstrapNodeIP}" ]; then\n`;
    finalCmd += `    echo "TurboCI: Bootstrapping Galera cluster..."\n`;
    finalCmd += `    galera_new_cluster\n`;
    finalCmd += `else\n`;
    finalCmd += `    echo "TurboCI: Joining Galera cluster..."\n`;
    finalCmd += `    systemctl start mariadb\n`;
    finalCmd += `fi\n`;
    finalCmd += `STARTEOF\n`;
    finalCmd += `chmod +x /usr/local/bin/tci-galera-start.sh\n\n`;

    // --- SQL INIT (Idempotent Users) ---
    const initSqlLines: string[] = [];

    // Detect ProxySQL attachments
    const attached_proxysql = deployment.services.filter(
        (s) =>
            s.type === "proxysql" &&
            s.proxysql?.target_services?.some(
                (ts) => ts.service_name === service.service_name,
            ),
    );

    // Detect HAProxy attachments
    const attached_haproxy = deployment.services.filter(
        (s) =>
            s.type === "haproxy" &&
            s.haproxy?.target_services?.some(
                (ts) => ts.service_name === service.service_name,
            ),
    );

    // ProxySQL Monitor User
    for (const p of attached_proxysql) {
        initSqlLines.push(
            `CREATE USER IF NOT EXISTS 'proxysql_monitor'@'%' IDENTIFIED BY '${p.proxysql?.monitor_password}';`,
        );
        initSqlLines.push(
            `GRANT USAGE, REPLICATION CLIENT ON *.* TO 'proxysql_monitor'@'%';`,
        );
    }

    // HAProxy Check User (Allows HAProxy 'option mysql-check' to work)
    if (attached_haproxy.length > 0) {
        initSqlLines.push(`CREATE USER IF NOT EXISTS 'haproxy_check'@'%';`);
        initSqlLines.push(`GRANT USAGE ON *.* TO 'haproxy_check'@'%';`);
    }

    if (rootPassword) {
        initSqlLines.push(
            `ALTER USER 'root'@'localhost' IDENTIFIED BY '${rootPassword}';`,
        );
    }

    if (galeraConfig?.databases) {
        for (const db of galeraConfig.databases) {
            initSqlLines.push(
                `CREATE DATABASE IF NOT EXISTS \\\`${db.name}\\\`;`,
            );

            if (db.user && db.password) {
                initSqlLines.push(
                    `CREATE USER IF NOT EXISTS '${db.user}'@'%' IDENTIFIED BY '${db.password}';`,
                );
                initSqlLines.push(
                    `GRANT ALL PRIVILEGES ON \\\`${db.name}\\\`.* TO '${db.user}'@'%';`,
                );
            }
        }
    }
    initSqlLines.push(`FLUSH PRIVILEGES;`);

    // Write SQL and Init script
    finalCmd += `cat > /usr/local/bin/tci-galera-init.sql << 'INITEOF'\n${initSqlLines.join("\n")}\nINITEOF\n\n`;

    finalCmd += `cat > /usr/local/bin/tci-galera-init.sh << 'INITSHEOF'\n`;
    finalCmd += `#!/bin/bash\n`;
    finalCmd += `MY_IP=$(hostname -I | awk '{print $1}')\n`;
    finalCmd += `if [ "$MY_IP" = "${bootstrapNodeIP}" ]; then\n`;
    finalCmd += `    echo "TurboCI: Running Galera init SQL..."\n`;
    // Use -p only if rootPassword exists
    const passArg = rootPassword ? `-p'${rootPassword}'` : "";
    finalCmd += `    mysql -u root ${passArg} < /usr/local/bin/tci-galera-init.sql || echo "SQL Init failed (maybe password already set?)"\n`;
    finalCmd += `fi\n`;
    finalCmd += `INITSHEOF\n`;
    finalCmd += `chmod +x /usr/local/bin/tci-galera-init.sh\n`;

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
