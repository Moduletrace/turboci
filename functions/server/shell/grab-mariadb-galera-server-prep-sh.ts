import type { ParsedDeploymentServiceConfig, TCIGlobalConfig } from "@/types";
import bunGrabPrivateIPsBulkScripts from "@/utils/bun-scripts/bun-grab-private-ips-bulk-scripts";
import grabPrivateIPsBulkScripts from "@/utils/ssh/shell-scripts/grab-private-ips-bulk-scripts";
import grabDefaultServicePrepSH from "./grab-default-service-prep-sh";
import grabNormalizedServers from "@/utils/grab-normalized-servers";
import grabMariadbGaleraInitSQL from "./grab-mariadb-galera-init-sql";

type Params = {
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
    service,
    deployment,
    bun,
}: Params): Promise<string[] | undefined> {
    const galeraConfig = service.mariadb_galera;
    const clusterName = galeraConfig?.cluster_name ?? "turboci_galera_cluster";
    const sstMethod = galeraConfig?.sst_method ?? "mariabackup";
    const port = galeraConfig?.port ?? 3306;
    const bindAddress = galeraConfig?.bind_address ?? "0.0.0.0";
    const rootPassword = galeraConfig?.root_password ?? "";

    const root_service_name =
        service.parent_service_name || service.service_name;

    const root_service = deployment.services.find(
        (srv) => srv.service_name == root_service_name,
    );

    if (!root_service?.service_name) {
        return undefined;
    }

    const servers = await grabNormalizedServers({
        provider: deployment.provider,
        service: root_service,
        target_deployment: deployment,
        grab_children: true,
    });

    const private_server_ips = servers
        ?.map((srv) => srv.private_ip)
        .filter((srv) => typeof srv == "string");

    if (!private_server_ips?.[0]) {
        return undefined;
    }

    if (!rootPassword) {
        console.error(`Mariadb needs a root_password.`);
        process.exit(1);
    }

    const bootstrapNodeIP = private_server_ips[0]?.replace(/"/g, "") ?? "";
    const clusterAddressIPs = private_server_ips
        .map((ip) => ip.replace(/"/g, ""))
        .join(",");

    const defaultPrepCmd = await grabDefaultServicePrepSH({
        service,
        deployment,
    });

    let init_cmd = ``;

    init_cmd += `set -e\n`;
    /**
     * Temporary remove Hetzner Mirrors
     */
    // init_cmd += `\n`;
    // init_cmd += `rm -rf /etc/apt/sources.list.d/*\n`;
    // init_cmd += `rm -rf /var/lib/apt/lists/*\n`;
    init_cmd += `\n`;

    init_cmd += `${defaultPrepCmd}\n`;

    init_cmd += `echo "--- TurboCI: Checking/Installing MariaDB Galera packages ---"\n`;
    init_cmd += `export DEBIAN_FRONTEND=noninteractive\n`;

    init_cmd += `command -v mariadbd >/dev/null 2>&1 || (\n`;
    init_cmd += `    apt update -qq\n`;
    init_cmd += `    curl -LsS https://r.mariadb.com/downloads/mariadb_repo_setup | bash\n`;
    init_cmd += `    apt install -y mariadb-server mariadb-backup galera-4 socat rsync\n`;
    init_cmd += `)\n\n`;

    init_cmd += `MY_IP=$(hostname -I | awk '{print $1}')\n\n`;

    // --- IDEMPOTENT CONFIGURATION ---
    init_cmd += `mkdir -p /etc/mysql/conf.d\n`;
    init_cmd += `cat > /etc/mysql/conf.d/galera.cnf << 'GALERAEOF'\n`;
    init_cmd += `[mariadb]\n`;
    init_cmd += `binlog_format=ROW\n`;
    init_cmd += `default-storage-engine=InnoDB\n`;
    init_cmd += `innodb_autoinc_lock_mode=2\n`;
    init_cmd += `bind-address=${bindAddress}\n`;
    init_cmd += `port=${port}\n`;
    init_cmd += `wsrep_on=ON\n`;
    init_cmd += `wsrep_provider=/usr/lib/galera/libgalera_smm.so\n`;
    init_cmd += `wsrep_cluster_name="${clusterName}"\n`;
    init_cmd += `wsrep_cluster_address="gcomm://${clusterAddressIPs}"\n`;
    init_cmd += `wsrep_sst_method=${sstMethod}\n`;
    init_cmd += `wsrep_node_address="__TCI_NODE_IP__"\n`;
    init_cmd += `wsrep_node_name="galera-$(hostname -s)"\n`;
    init_cmd += `GALERAEOF\n\n`;

    init_cmd += `sed -i "s/__TCI_NODE_IP__/$MY_IP/" /etc/mysql/conf.d/galera.cnf\n\n`;

    // --- START SCRIPT ---
    init_cmd += `cat > /usr/local/bin/tci-galera-start.sh << 'STARTEOF'\n`;
    init_cmd += `#!/bin/bash\n`;
    init_cmd += `MY_IP=$(hostname -I | awk '{print $1}')\n`;

    // Ensure bind-address is commented out before starting
    init_cmd += `sed -i '/^#\\s*bind-address/!s/^bind-address/# bind-address/' /etc/mysql/mariadb.conf.d/50-server.cnf\n`;

    init_cmd += `if [[ "$MY_IP" == "${bootstrapNodeIP}" ]]; then\n`;
    init_cmd += `    echo "TurboCI: Bootstrapping Galera cluster..."\n`;
    init_cmd += `    if [ -f "/var/lib/mysql/grastate.dat" ]; then\n`;
    init_cmd += `        sed -i 's/safe_to_bootstrap: 0/safe_to_bootstrap: 1/' "/var/lib/mysql/grastate.dat"\n`;
    init_cmd += `    fi\n`;
    init_cmd += `    if systemctl is-active --quiet mariadb; then\n`;
    init_cmd += `        systemctl restart mariadb\n`;
    init_cmd += `    else\n`;
    init_cmd += `        galera_new_cluster || { echo "Bootstrap failed"; exit 1; }\n`;
    init_cmd += `    fi\n`;
    init_cmd += `    exit 0\n`;
    init_cmd += `else\n`;
    init_cmd += `    echo "TurboCI: Bootstrapping Galera children nodes ..."\n`;
    init_cmd += `    systemctl start mariadb\n`;
    init_cmd += `fi\n`;

    // // JOINER LOGIC
    // finalCmd += `if systemctl is-active --quiet mariadb; then\n`;
    // finalCmd += `    echo "TurboCI: MariaDB is already running. Skipping start."\n`;
    // finalCmd += `    systemctl restart mariadb\n`;
    // finalCmd += `    exit 0\n`;
    // finalCmd += `else\n`;
    // finalCmd += `    echo "TurboCI: Starting MariaDB to join cluster..."\n`;
    // finalCmd += `    systemctl start mariadb\n`;
    // finalCmd += `fi\n`;
    init_cmd += `STARTEOF\n`;

    // --- SQL INIT (Idempotent Users) ---
    const initSqlLines: string[] = await grabMariadbGaleraInitSQL({
        deployment,
        service,
    });

    // Write SQL and Init script
    init_cmd += `cat > /usr/local/bin/tci-galera-init.sql << 'INITSQLEOF'\n${initSqlLines.join("\n")}\nINITSQLEOF\n\n`;

    init_cmd += `cat > /usr/local/bin/tci-galera-init.sh << 'INITSHEOF'\n`;
    init_cmd += `#!/bin/bash\n`;
    init_cmd += `MY_IP=$(hostname -I | awk '{print $1}')\n`;
    init_cmd += `if [[ "$MY_IP" = "${bootstrapNodeIP}" ]]; then\n`;
    init_cmd += `    echo "TurboCI: Running Galera init SQL..."\n`;
    init_cmd += `    mariadb -u root -p'${rootPassword}' < /usr/local/bin/tci-galera-init.sql || echo "SQL Init failed"\n`;
    init_cmd += `fi\n`;
    init_cmd += `INITSHEOF\n`;

    // --- Mariadb Config ---
    const network_cidr =
        clusterAddressIPs.split(",").pop()?.split(".").slice(0, 3).join(".") +
        ".0/24";

    if (!network_cidr) {
        console.error(`Couldn't crab network_cidr`);
        process.exit(1);
    }

    init_cmd += `cat > /etc/mysql/conf.d/default.cnf << 'MARIADBEOF'\n`;
    init_cmd += `[mariadb]\n`;
    init_cmd += `server-id=1\n`;
    init_cmd += `log-bin=mariadb-bin\n`;
    init_cmd += `skip-networking=0\n`;
    init_cmd += `bind-address = 0.0.0.0\n`;
    init_cmd += `proxy_protocol_networks=${network_cidr}\n`;

    init_cmd += `MARIADBEOF\n\n`;

    init_cmd += `chmod +x /usr/local/bin/tci-galera-start.sh\n`;
    init_cmd += `chmod +x /usr/local/bin/tci-galera-init.sh\n`;

    init_cmd += `if [[ "$MY_IP" != "${bootstrapNodeIP}" ]]; then\n`;
    init_cmd += `    systemctl stop mariadb || echo "Mariadb stopped already"\n`;
    init_cmd += `fi\n`;

    let start_cmd = ``;

    start_cmd += `/usr/local/bin/tci-galera-start.sh\n`;

    start_cmd += `\n# Wait for Galera to become ready\n`;
    start_cmd += `MAX_RETRIES=30\n`;
    start_cmd += `RETRY_COUNT=0\n`;
    start_cmd += `while true; do\n`;
    start_cmd += `    IS_READY=$(mariadb -N -s -e "show status like 'wsrep_ready'" | cut -f2)\n`;
    start_cmd += `    if [[ "$IS_READY" == "ON" ]]; then\n`;
    start_cmd += `        echo "Galera is ready!"\n`;
    start_cmd += `        /usr/local/bin/tci-galera-init.sh\n`;
    start_cmd += `        break\n`;
    start_cmd += `    fi\n`;
    start_cmd += `\n`;
    start_cmd += `    RETRY_COUNT=$((RETRY_COUNT + 1))\n`;
    start_cmd += `    if [[ $RETRY_COUNT -ge $MAX_RETRIES ]]; then\n`;
    start_cmd += `        echo "Error: Galera failed to become ready after $MAX_RETRIES attempts." >&2\n`;
    start_cmd += `        exit 1\n`;
    start_cmd += `    fi\n`;
    start_cmd += `\n`;
    start_cmd += `    echo "Waiting for Galera... (Attempt $RETRY_COUNT/$MAX_RETRIES)"\n`;
    start_cmd += `    /usr/local/bin/tci-galera-start.sh\n`;
    start_cmd += `    sleep 2\n`;
    start_cmd += `done\n`;

    const full_init_cmd = bun
        ? bunGrabPrivateIPsBulkScripts({
              private_server_ips,
              script: init_cmd,
              parrallel: true,
              async: true,
          })
        : grabPrivateIPsBulkScripts({
              private_server_ips,
              script: init_cmd,
              parrallel: true,
              async: true,
          });

    const full_start_cmd = bun
        ? bunGrabPrivateIPsBulkScripts({
              private_server_ips,
              script: start_cmd,
              parrallel: true,
          })
        : grabPrivateIPsBulkScripts({
              private_server_ips,
              script: start_cmd,
              parrallel: true,
          });

    return [full_init_cmd, full_start_cmd];
}
