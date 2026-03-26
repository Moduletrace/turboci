import type {
    ParsedDeploymentServiceConfig,
    TCIGlobalConfig,
} from "@/types";
import bunGrabPrivateIPsBulkScripts from "@/utils/bun-scripts/bun-grab-private-ips-bulk-scripts";
import grabPrivateIPsBulkScripts from "@/utils/ssh/shell-scripts/grab-private-ips-bulk-scripts";
import grabProxySQLConfig from "./grab-proxysql-config";

type Params = {
    private_server_ips: string[];
    proxysql_service: ParsedDeploymentServiceConfig;
    deployment: TCIGlobalConfig;
    skip_init?: boolean;
    bun?: boolean;
};

/**
 * Generates the shell script that runs on ProxySQL servers during the
 * prepare phase:
 *
 * 1. Installs ProxySQL from the official GitHub release (if not present).
 * 2. Stops ProxySQL and removes its internal SQLite database so the next
 *    start re-reads /etc/proxysql.cnf from scratch.
 * 3. Writes /etc/proxysql.cnf from the generated config.
 * 4. Enables and starts the proxysql systemd service.
 *
 * ProxySQL supports MySQL 5.5+ and MariaDB 5.5+. It does NOT support
 * PostgreSQL — use HAProxy for PostgreSQL proxying. MaxScale is an
 * alternative that also supports MySQL and all MariaDB versions.
 *
 * Called on every deploy and on backend-service changes so that ProxySQL
 * always reflects the current set of backend IPs.
 */
export default async function grabProxySQLServerPrepSH({
    private_server_ips,
    proxysql_service,
    deployment,
    skip_init,
    bun,
}: Params) {
    let finalCmd = `set -e\n\n`;

    if (!skip_init) {
        finalCmd += `cat /root/.hushlogin || touch /root/.hushlogin\n`;
        finalCmd += `apt update -qq\n`;
        finalCmd += `command -v proxysql >/dev/null 2>&1 || (\n`;
        finalCmd += `    apt install -y wget lsb-release\n`;
        finalCmd += `    PROXYSQL_VERSION=2.7.1\n`;
        finalCmd += `    DISTRO=$(lsb_release -cs)\n`;
        finalCmd += `    wget -q "https://github.com/sysown/proxysql/releases/download/v\${PROXYSQL_VERSION}/proxysql2_\${PROXYSQL_VERSION}-\${DISTRO}_amd64.deb" -O /tmp/proxysql2.deb\n`;
        finalCmd += `    dpkg -i /tmp/proxysql2.deb || apt-get install -f -y\n`;
        finalCmd += `)\n\n`;
    }

    const proxysqlCnf = await grabProxySQLConfig({ proxysql_service, deployment });

    if (proxysqlCnf) {
        // Stop ProxySQL before writing config to avoid file lock issues
        finalCmd += `systemctl stop proxysql 2>/dev/null || true\n`;
        // Remove the SQLite database so ProxySQL re-reads proxysql.cnf on next start
        finalCmd += `rm -f /var/lib/proxysql/proxysql.db\n\n`;
        finalCmd += `cat << 'PROXYSQLEOF' > /etc/proxysql.cnf\n`;
        finalCmd += `${proxysqlCnf}`;
        finalCmd += `PROXYSQLEOF\n\n`;
    }

    finalCmd += `systemctl enable proxysql\n`;
    finalCmd += `systemctl start proxysql\n`;

    return bun
        ? bunGrabPrivateIPsBulkScripts({
              private_server_ips,
              script: finalCmd,
              parrallel: true,
          })
        : grabPrivateIPsBulkScripts({
              private_server_ips,
              script: finalCmd,
              parrallel: true,
          });
}
