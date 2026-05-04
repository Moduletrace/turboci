import type { ParsedDeploymentServiceConfig, TCIGlobalConfig } from "@/types";
import bunGrabPrivateIPsBulkScripts from "@/utils/bun-scripts/bun-grab-private-ips-bulk-scripts";
import grabPrivateIPsBulkScripts from "@/utils/ssh/shell-scripts/grab-private-ips-bulk-scripts";
import grabDefaultServicePrepSH from "./grab-default-service-prep-sh";
import { turboCiDepsCmds } from "../install-turboci-dependencies";
import grabNormalizedServers from "@/utils/grab-normalized-servers";
import grabMariadbGaleraInitSQL from "./grab-mariadb-galera-init-sql";

type Params = {
    private_server_ips: string[];
    service: ParsedDeploymentServiceConfig;
    deployment: TCIGlobalConfig;
    bun?: boolean;
};

/**
 * Generates the shell script that runs on every MariaDB Galera node
 * This script is docker-based
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
export default async function grabMariadbGaleraDockerServerPrepSH({
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

    let finalCmd = defaultPrepCmd;

    finalCmd += `${turboCiDepsCmds({ os: "debian", dependency: "docker" })}\n`;

    // --- IDEMPOTENT CONFIGURATION ---
    finalCmd += `mkdir -p /etc/mysql/conf.d\n`;
    finalCmd += `cat > /etc/mysql/conf.d/galera.cnf << 'GALERAEOF'\n`;
    finalCmd += `[mariadb]\n`;
    finalCmd += `binlog_format=ROW\n`;
    finalCmd += `default-storage-engine=InnoDB\n`;
    finalCmd += `innodb_autoinc_lock_mode=2\n`;
    finalCmd += `bind-address=${bindAddress}\n`;
    finalCmd += `port=${port}\n`;
    finalCmd += `wsrep_on=ON\n`;
    finalCmd += `wsrep_provider=/usr/lib/libgalera_smm.so\n`;
    finalCmd += `wsrep_cluster_name="${clusterName}"\n`;
    finalCmd += `wsrep_cluster_address="gcomm://${clusterAddressIPs}"\n`;
    finalCmd += `wsrep_sst_method=${sstMethod}\n`;
    finalCmd += `wsrep_node_address="__TCI_NODE_IP__"\n`;
    finalCmd += `wsrep_node_name="galera-$(hostname -s)"\n`;
    finalCmd += `GALERAEOF\n\n`;

    finalCmd += `sed -i "s/__TCI_NODE_IP__/$MY_IP/" /etc/mysql/conf.d/galera.cnf\n\n`;

    const initSqlLines: string[] = await grabMariadbGaleraInitSQL({
        deployment,
        service,
    });

    // Write SQL and Init script
    finalCmd += `cat > /usr/local/bin/tci-galera-init.sql << 'INITEOF'\n${initSqlLines.join("\n")}\nINITEOF\n\n`;

    finalCmd += `cat > /usr/local/bin/tci-galera-init.sh << 'INITSHEOF'\n`;
    finalCmd += `#!/bin/bash\n`;
    finalCmd += `MY_IP=$(hostname -I | awk '{print $1}')\n`;
    finalCmd += `if [ "$MY_IP" = "${bootstrapNodeIP}" ]; then\n`;
    finalCmd += `    echo "TurboCI: Running Galera init SQL..."\n`;
    finalCmd += `    mariadb -u root -p'${rootPassword}' < /usr/local/bin/tci-galera-init.sql || echo "SQL Init failed (maybe password already set?)"\n`;
    finalCmd += `fi\n`;
    finalCmd += `INITSHEOF\n`;
    finalCmd += `chmod +x /usr/local/bin/tci-galera-init.sh\n`;

    // --- Mariadb Config ---
    const network_cidr =
        bootstrapNodeIP.split(".").slice(0, 3).join(".") + ".0/24";

    finalCmd += `cat > /etc/mysql/conf.d/default.cnf << 'MARIADBEOF'\n`;
    finalCmd += `[mariadb]\n`;
    finalCmd += `server-id=1\n`;
    finalCmd += `log-bin=mariadb-bin\n`;
    finalCmd += `skip-networking=0\n`;
    finalCmd += `bind-address = 0.0.0.0\n`;
    finalCmd += `proxy_protocol_networks=${network_cidr}\n`;
    finalCmd += `MARIADBEOF\n\n`;

    const GaleraContainerName = "turboci-mariadb-galera";
    const GaleraVolumeName = "turboci-mariadb-galera-volume";

    finalCmd += `docker kill ${GaleraContainerName} || echo "Docker container already killed"\n`;
    finalCmd += `docker rm ${GaleraContainerName} || echo "Docker container already removed"\n`;
    finalCmd += `\n`;

    let docker_run_cmd = `docker run`;
    docker_run_cmd += ` -d`;
    docker_run_cmd += ` --network host`;
    docker_run_cmd += ` --name ${GaleraContainerName}`;
    docker_run_cmd += ` -v /var/lib/mysql:/var/lib/mysql`;
    docker_run_cmd += ` -v /etc/mysql/conf.d:/etc/mysql/conf.d`;
    docker_run_cmd += ` -e MARIADB_ROOT_PASSWORD=${rootPassword}`;
    docker_run_cmd += ` --restart unless-stopped`;
    docker_run_cmd += ` mariadb:12.2-noble-rc mariadbd --wsrep-on=ON`;

    finalCmd += `if [ "$MY_IP" = "${bootstrapNodeIP}" ]; then\n`;
    finalCmd += `    echo "TurboCI: Starting Bootstrap Node..."\n`;
    finalCmd += `    if [ -f "/var/lib/mysql/grastate.dat" ]; then\n`;
    finalCmd += `        sed -i 's/safe_to_bootstrap: 0/safe_to_bootstrap: 1/' "/var/lib/mysql/grastate.dat"\n`;
    finalCmd += `    fi\n`;
    finalCmd += `    ${docker_run_cmd} --wsrep-new-cluster\n`;
    finalCmd += `else\n`;
    finalCmd += `    echo "TurboCI: Starting Joiner Node..."\n`;
    finalCmd += `    ${docker_run_cmd}\n`;
    finalCmd += `fi\n`;
    docker_run_cmd += `\n`;

    finalCmd += `docker cp /usr/local/bin/tci-galera-init.sql ${GaleraContainerName}:/usr/local/bin/tci-galera-init.sql\n`;
    finalCmd += `docker cp /usr/local/bin/tci-galera-init.sh ${GaleraContainerName}:/usr/local/bin/tci-galera-init.sh\n`;
    finalCmd += `\n`;

    finalCmd += `cat > /usr/local/bin/tci-galera-start.sh << 'STARTEOF'\n`;
    finalCmd += `docker start ${GaleraContainerName} || echo "Container already running ..."\n`;
    finalCmd += `docker exec ${GaleraContainerName} bash -c 'chmod +x /usr/local/bin/tci-galera-init.sh && /usr/local/bin/tci-galera-init.sh'\n`;
    finalCmd += `STARTEOF\n`;
    finalCmd += `chmod +x /usr/local/bin/tci-galera-start.sh\n`;
    finalCmd += `\n`;

    finalCmd += `cat > /usr/local/bin/tci-galera-health.sh << 'HEALTHEOF'\n`;
    finalCmd += `docker exec ${GaleraContainerName} mariadb -u root -p"\$MARIADB_ROOT_PASSWORD" -e "SHOW STATUS LIKE 'wsrep_cluster_size';"\n`;
    finalCmd += `HEALTHEOF\n`;
    finalCmd += `chmod +x /usr/local/bin/tci-galera-health.sh\n`;
    finalCmd += `\n`;

    finalCmd += `cat > /usr/local/bin/tci-galera-exec.sh << 'EXECEOF'\n`;
    finalCmd += `#!/bin/bash\n`;
    finalCmd += `if [ -z "$1" ]; then\n`;
    finalCmd += `    echo "Usage: $0 \"command\""\n`;
    finalCmd += `    echo "Example: $0 \"ls -la /var/www\""\n`;
    finalCmd += `    exit 1\n`;
    finalCmd += `fi\n`;
    finalCmd += `docker exec ${GaleraContainerName} bash -c "$1"\n`;
    finalCmd += `EXECEOF\n`;
    finalCmd += `chmod +x /usr/local/bin/tci-galera-exec.sh\n`;
    finalCmd += `\n`;

    finalCmd += `/usr/local/bin/tci-galera-start.sh\n`;

    finalCmd += `\n`;

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
