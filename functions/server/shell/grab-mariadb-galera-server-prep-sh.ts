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

    // The first IP in the list becomes the bootstrap (primary component) node
    const bootstrapNodeIP = private_server_ips[0]?.replace(/"/g, "") ?? "";

    // All node IPs form the Galera cluster address
    const clusterAddressIPs = private_server_ips
        .map((ip) => ip.replace(/"/g, ""))
        .join(",");

    const defaultPrepCmd = await grabDefaultServicePrepSH({ service, deployment });

    let finalCmd = defaultPrepCmd;

    finalCmd += `echo "--- TurboCI: Installing MariaDB Galera packages ---"\n`;
    finalCmd += `apt update -qq\n`;
    finalCmd += `apt install -y mariadb-server mariadb-backup galera-4 socat rsync\n`;
    finalCmd += `systemctl stop mariadb 2>/dev/null || true\n\n`;

    // Detect own private IP at runtime for wsrep_node_address
    finalCmd += `MY_IP=$(hostname -I | awk '{print $1}')\n\n`;

    // Write /etc/mysql/conf.d/galera.cnf
    // Use double-quoted heredoc so $MY_IP substitution works for the sed placeholder only;
    // the actual wsrep_node_address is set via sed after the file is written.
    finalCmd += `mkdir -p /etc/mysql/conf.d\n`;
    finalCmd += `cat > /etc/mysql/conf.d/galera.cnf << 'GALERAEOF'\n`;
    finalCmd += `[mysqld]\n`;
    finalCmd += `binlog_format=ROW\n`;
    finalCmd += `default-storage-engine=InnoDB\n`;
    finalCmd += `innodb_autoinc_lock_mode=2\n`;
    finalCmd += `bind-address=${bindAddress}\n`;
    finalCmd += `port=${port}\n`;
    finalCmd += `\n`;
    finalCmd += `# Galera Provider\n`;
    finalCmd += `wsrep_on=ON\n`;
    finalCmd += `wsrep_provider=/usr/lib/galera/libgalera_smm.so\n`;
    finalCmd += `\n`;
    finalCmd += `# Galera Cluster\n`;
    finalCmd += `wsrep_cluster_name="${clusterName}"\n`;
    finalCmd += `wsrep_cluster_address="gcomm://${clusterAddressIPs}"\n`;
    finalCmd += `\n`;
    finalCmd += `# SST\n`;
    finalCmd += `wsrep_sst_method=${sstMethod}\n`;
    finalCmd += `\n`;
    finalCmd += `# Node identity — populated at runtime by TurboCI\n`;
    finalCmd += `wsrep_node_address="__TCI_NODE_IP__"\n`;
    finalCmd += `wsrep_node_name="galera-$(hostname -s)"\n`;
    finalCmd += `GALERAEOF\n\n`;

    // Replace the placeholder with the real IP detected at runtime
    finalCmd += `sed -i "s/__TCI_NODE_IP__/$MY_IP/" /etc/mysql/conf.d/galera.cnf\n\n`;

    // Write /usr/local/bin/tci-galera-start.sh
    finalCmd += `cat > /usr/local/bin/tci-galera-start.sh << 'STARTEOF'\n`;
    finalCmd += `#!/bin/bash\n`;
    finalCmd += `set -e\n`;
    finalCmd += `MY_IP=$(hostname -I | awk '{print $1}')\n`;
    finalCmd += `if [ "$MY_IP" = "${bootstrapNodeIP}" ]; then\n`;
    finalCmd += `    echo "TurboCI: Bootstrapping Galera cluster as primary component ($MY_IP) ..."\n`;
    finalCmd += `    galera_new_cluster\n`;
    finalCmd += `else\n`;
    finalCmd += `    echo "TurboCI: Joining Galera cluster from $MY_IP ..."\n`;
    finalCmd += `    systemctl start mariadb\n`;
    finalCmd += `fi\n`;
    finalCmd += `STARTEOF\n`;
    finalCmd += `chmod +x /usr/local/bin/tci-galera-start.sh\n\n`;

    // Build init SQL (CREATE DATABASE, CREATE USER — only run on bootstrap node)
    const initSqlLines: string[] = [];

    if (rootPassword) {
        initSqlLines.push(
            `ALTER USER 'root'@'localhost' IDENTIFIED BY '${rootPassword}';`,
        );
        initSqlLines.push(`FLUSH PRIVILEGES;`);
    }

    if (galeraConfig?.databases?.[0]) {
        for (const db of galeraConfig.databases) {
            const charset = db.charset ?? "utf8mb4";
            const collation = db.collation ?? "utf8mb4_unicode_ci";
            initSqlLines.push(
                `CREATE DATABASE IF NOT EXISTS \`${db.name}\` CHARACTER SET ${charset} COLLATE ${collation};`,
            );
            if (db.user && db.password) {
                initSqlLines.push(
                    `CREATE USER IF NOT EXISTS '${db.user}'@'%' IDENTIFIED BY '${db.password}';`,
                );
                initSqlLines.push(
                    `GRANT ALL PRIVILEGES ON \`${db.name}\`.* TO '${db.user}'@'%';`,
                );
            }
        }
        initSqlLines.push(`FLUSH PRIVILEGES;`);
    }

    if (initSqlLines.length > 0) {
        finalCmd += `cat > /usr/local/bin/tci-galera-init.sql << 'INITEOF'\n`;
        for (const line of initSqlLines) {
            finalCmd += `${line}\n`;
        }
        finalCmd += `INITEOF\n\n`;

        // Write /usr/local/bin/tci-galera-init.sh — runs SQL only on bootstrap node
        finalCmd += `cat > /usr/local/bin/tci-galera-init.sh << 'INITSHEOF'\n`;
        finalCmd += `#!/bin/bash\n`;
        finalCmd += `set -e\n`;
        finalCmd += `MY_IP=$(hostname -I | awk '{print $1}')\n`;
        finalCmd += `if [ "$MY_IP" = "${bootstrapNodeIP}" ]; then\n`;
        finalCmd += `    echo "TurboCI: Running Galera init SQL on bootstrap node ..."\n`;
        if (rootPassword) {
            finalCmd += `    mysql -u root -p'${rootPassword}' < /usr/local/bin/tci-galera-init.sql\n`;
        } else {
            finalCmd += `    mysql -u root < /usr/local/bin/tci-galera-init.sql\n`;
        }
        finalCmd += `fi\n`;
        finalCmd += `INITSHEOF\n`;
        finalCmd += `chmod +x /usr/local/bin/tci-galera-init.sh\n`;
    }

    // Run sequentially: bootstrap node must be configured before joiners start
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
