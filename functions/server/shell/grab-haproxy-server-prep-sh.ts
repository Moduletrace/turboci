import type {
    ParsedDeploymentServiceConfig,
    TCIGlobalConfig,
} from "@/types";
import bunGrabPrivateIPsBulkScripts from "@/utils/bun-scripts/bun-grab-private-ips-bulk-scripts";
import grabPrivateIPsBulkScripts from "@/utils/ssh/shell-scripts/grab-private-ips-bulk-scripts";
import grabHAProxyConfig from "./grab-haproxy-config";

type Params = {
    private_server_ips: string[];
    haproxy_service: ParsedDeploymentServiceConfig;
    deployment: TCIGlobalConfig;
    skip_init?: boolean;
    bun?: boolean;
};

/**
 * Generates the shell script that runs on HAProxy servers during the
 * prepare phase:
 *
 * 1. Installs haproxy from apt (if not already present).
 * 2. Writes /etc/haproxy/haproxy.cfg from the generated config.
 * 3. Validates the config with `haproxy -c`.
 * 4. Enables and (re)starts the haproxy systemd service.
 *
 * HAProxy works with any TCP backend (PostgreSQL, MySQL, MariaDB, Redis,
 * HTTP services, etc.) and is the recommended proxy for PostgreSQL since
 * neither MaxScale nor ProxySQL support it.
 *
 * Called on every deploy and on backend-service changes so that HAProxy
 * always reflects the current set of backend IPs.
 */
export default async function grabHAProxyServerPrepSH({
    private_server_ips,
    haproxy_service,
    deployment,
    skip_init,
    bun,
}: Params) {
    let finalCmd = `set -e\n\n`;

    if (!skip_init) {
        finalCmd += `cat /root/.hushlogin || touch /root/.hushlogin\n`;
        finalCmd += `apt update -qq\n`;
        finalCmd += `command -v haproxy >/dev/null 2>&1 || apt install -y haproxy\n\n`;
    }

    const haproxyCnf = await grabHAProxyConfig({ haproxy_service, deployment });

    if (haproxyCnf) {
        finalCmd += `cat << 'HAPROXYEOF' > /etc/haproxy/haproxy.cfg\n`;
        finalCmd += `${haproxyCnf}`;
        finalCmd += `HAPROXYEOF\n\n`;
        finalCmd += `haproxy -c -f /etc/haproxy/haproxy.cfg || exit 1\n\n`;
    }

    finalCmd += `systemctl enable haproxy\n`;
    finalCmd += `systemctl restart haproxy 2>/dev/null || systemctl start haproxy\n`;

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
