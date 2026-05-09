import type { ParsedDeploymentServiceConfig, TCIGlobalConfig } from "@/types";
import bunGrabPrivateIPsBulkScripts from "@/utils/bun-scripts/bun-grab-private-ips-bulk-scripts";
import grabPrivateIPsBulkScripts from "@/utils/ssh/shell-scripts/grab-private-ips-bulk-scripts";
import grabDefaultServicePrepSH from "./grab-default-service-prep-sh";
import grabNormalizedServers from "@/utils/grab-normalized-servers";
import grabMariadbGaleraInitSQL from "./grab-mariadb-galera-init-sql";
import grabDirNames from "@/utils/grab-dir-names";

const { serviceBashrcDir } = grabDirNames();

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
}: Params) {
    const galeraConfig = service.mariadb_galera;
    const clusterName = galeraConfig?.cluster_name ?? "turboci_galera_cluster";
    const sstMethod = galeraConfig?.sst_method ?? "mariabackup";
    const port = galeraConfig?.port ?? 3306;
    const bindAddress = galeraConfig?.bind_address ?? "0.0.0.0";
    const rootPassword = galeraConfig?.root_password ?? "";

    const default_data_dir = "/var/lib/mysql";

    const data_dir = galeraConfig?.data_dir ?? default_data_dir;

    const was_this_server_deleted =
        global.ACTIVE_SERVICE_INFO[deployment.deployment_name]?.[
            service.service_name
        ]?.service_deleted;

    const root_service_name =
        service.parent_service_name || service.service_name;

    const root_service = deployment.services.find(
        (srv) => srv.service_name == root_service_name,
    );

    if (!root_service?.service_name) {
        return undefined;
    }

    const servers = await grabNormalizedServers({
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
    init_cmd += `cat > /usr/local/bin/tci-galera-setup.sh << 'SETUPEOF'\n`;
    init_cmd += `#!/bin/bash\n`;
    init_cmd += `MY_IP=$(hostname -I | awk '{print $1}')\n`;

    if (data_dir !== default_data_dir) {
        init_cmd += `mkdir -p ${data_dir}\n`;
        init_cmd += `if [ -z "$(ls -A ${data_dir} 2>/dev/null)" ]; then\n`;
        init_cmd += `    cp -a ${default_data_dir}/. ${data_dir}/\n`;
        init_cmd += `    chown -R mysql:mysql ${data_dir}\n`;
        init_cmd += `fi\n`;
    }

    init_cmd += `echo "${data_dir}/** rwk," >> /etc/apparmor.d/local/usr.sbin.mysqld\n`;
    init_cmd += `apparmor_parser -r /etc/apparmor.d/usr.sbin.mysqld\n`;
    init_cmd += `sed -i -e '/^#\\s*bind-address/!s/^bind-address/# bind-address/' -e 's|^datadir\\s*=.*|datadir = ${data_dir}|' /etc/mysql/mariadb.conf.d/50-server.cnf\n`;
    init_cmd += `chown -R mysql:mysql ${data_dir}\n`;

    init_cmd += `if [[ "$MY_IP" == "${bootstrapNodeIP}" ]]; then\n`;

    if (was_this_server_deleted) {
        init_cmd += `    echo "Rejoining primary node to cluster..."\n`;
        init_cmd += `    systemctl restart mariadb\n`;
    } else {
        init_cmd += `    echo "TurboCI: Bootstrapping Galera cluster..."\n`;
        init_cmd += `    if [ -f "${data_dir}/grastate.dat" ]; then\n`;
        init_cmd += `        sed -i 's/safe_to_bootstrap: 0/safe_to_bootstrap: 1/' "${data_dir}/grastate.dat"\n`;
        init_cmd += `    fi\n`;
        init_cmd += `    if systemctl is-active --quiet mariadb; then\n`;

        init_cmd += `        systemctl restart mariadb\n`;
        init_cmd += `    else\n`;
        init_cmd += `        galera_new_cluster || { echo "Bootstrap failed"; exit 1; }\n`;
        init_cmd += `    fi\n`;
        init_cmd += `    exit 0\n`;
    }

    init_cmd += `else\n`;
    init_cmd += `    echo "TurboCI: Joining Galera cluster..."\n`;
    init_cmd += `    if systemctl is-active --quiet mariadb; then\n`;
    init_cmd += `        systemctl restart mariadb\n`;
    init_cmd += `    else\n`;
    init_cmd += `        systemctl start mariadb\n`;
    init_cmd += `    fi\n`;
    init_cmd += `fi\n`;
    init_cmd += `SETUPEOF\n`;

    const init_sql_lines: string[] = await grabMariadbGaleraInitSQL({
        deployment,
        service,
    });

    /**
     * Write Envs
     */
    init_cmd += `cat > ${serviceBashrcDir}/envs.sh << 'ENVSEOF'\n`;
    init_cmd += `export MARIADB_ROOT_PASSWORD="${rootPassword}"\n`;
    init_cmd += `ENVSEOF\n`;
    init_cmd += `\n`;

    // Write SQL and Init script
    init_cmd += `cat > /usr/local/bin/tci-galera-init.sql << 'INITSQLEOF'\n${init_sql_lines.join("\n")}\nINITSQLEOF\n\n`;

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
    init_cmd += `datadir=${data_dir}\n`;
    init_cmd += `MARIADBEOF\n\n`;

    init_cmd += `cat > /usr/local/bin/tci-galera-start.sh << 'STARTEOF'\n`;
    init_cmd += `#!/bin/bash\n`;
    init_cmd += `/usr/local/bin/tci-galera-setup.sh\n`;

    init_cmd += `\n`;
    init_cmd += `# Wait for Galera to become ready\n`;
    init_cmd += `MAX_RETRIES=30\n`;
    init_cmd += `RETRY_COUNT=0\n`;
    init_cmd += `while true; do\n`;
    init_cmd += `    IS_READY=$(mariadb -u root -p'${rootPassword}' -e "show status like 'wsrep_ready'")\n`;
    init_cmd += `    if echo "$IS_READY" | grep "ON"; then\n`;
    init_cmd += `        echo "Galera is ready!"\n`;
    init_cmd += `        /usr/local/bin/tci-galera-init.sh\n`;
    init_cmd += `        break\n`;
    init_cmd += `    fi\n`;
    init_cmd += `\n`;
    init_cmd += `    RETRY_COUNT=$((RETRY_COUNT + 1))\n`;
    init_cmd += `    if [[ $RETRY_COUNT -ge $MAX_RETRIES ]]; then\n`;
    init_cmd += `        echo "Error: Galera failed to become ready after $MAX_RETRIES attempts." >&2\n`;
    init_cmd += `        exit 1\n`;
    init_cmd += `    fi\n`;
    init_cmd += `\n`;
    init_cmd += `    echo "Waiting for Galera... (Attempt $RETRY_COUNT/$MAX_RETRIES)"\n`;
    init_cmd += `    /usr/local/bin/tci-galera-setup.sh\n`;
    init_cmd += `    sleep 2\n`;
    init_cmd += `done\n`;
    init_cmd += `STARTEOF\n`;
    init_cmd += `\n`;

    init_cmd += `cat > /root/.bash_history << 'BASHHISTORYEOF'\n`;
    init_cmd += `systemctl status mariadb.service\n`;
    init_cmd += `/usr/local/bin/tci-galera-setup.sh\n`;
    init_cmd += `/usr/local/bin/tci-galera-start.sh\n`;
    init_cmd += `mariadb -u root -p"\$MARIADB_ROOT_PASSWORD" -e "SHOW STATUS LIKE 'wsrep_%'"\n`;
    init_cmd += `mariadb -u root -p"\$MARIADB_ROOT_PASSWORD"\n`;
    init_cmd += `BASHHISTORYEOF\n`;

    init_cmd += `cat > /root/.bash_history << 'BASHHISTORYEOF'\n`;
    init_cmd += `systemctl status mariadb.service\n`;
    init_cmd += `/usr/local/bin/tci-galera-setup.sh\n`;
    init_cmd += `/usr/local/bin/tci-galera-start.sh\n`;
    init_cmd += `mariadb -u root -p"\$MARIADB_ROOT_PASSWORD" -e "SHOW STATUS LIKE 'wsrep_%'"\n`;
    init_cmd += `mariadb -u root -p"\$MARIADB_ROOT_PASSWORD"\n`;
    init_cmd += `BASHHISTORYEOF\n`;
    init_cmd += `\n`;

    init_cmd += `chmod +x /usr/local/bin/tci-galera-setup.sh\n`;
    init_cmd += `chmod +x /usr/local/bin/tci-galera-start.sh\n`;
    init_cmd += `chmod +x /usr/local/bin/tci-galera-init.sh\n`;

    const full_init_cmd = bun
        ? bunGrabPrivateIPsBulkScripts({
              private_server_ips,
              script: init_cmd,
          })
        : grabPrivateIPsBulkScripts({
              private_server_ips,
              script: init_cmd,
          });

    return full_init_cmd;
}
