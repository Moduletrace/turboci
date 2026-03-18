import type { ParsedDeploymentServiceConfig, TCIGlobalConfig } from "@/types";
import grabPrivateIPsBulkScripts from "../../../utils/ssh/shell-scripts/grab-private-ips-bulk-scripts";
import grabLoadBalancerNginxConfig from "./grab-nginx-config";
import grabActiveConfig from "@/utils/grab-active-config";
import grabLoadBalancerCertbotSH from "./grab-nginx-certbot-sh";
import bunGrabPrivateIPsBulkScripts from "@/utils/bun-scripts/bun-grab-private-ips-bulk-scripts";

type Params = {
    private_server_ips: string[];
    load_balancer_service: ParsedDeploymentServiceConfig;
    deployment: TCIGlobalConfig;
    skip_init?: boolean;
    bun?: boolean;
};

export default async function grabLoadBalancerServerPrepSH({
    private_server_ips,
    load_balancer_service,
    deployment,
    skip_init,
    bun,
}: Params) {
    const configs = global.CONFIGS;
    const currentConfigs = grabActiveConfig();

    const target_deployment = configs?.find(
        (c) => c.deployment_name == deployment.deployment_name,
    );

    const target_active_deployment = currentConfigs?.find(
        (c) => c.deployment_name == deployment.deployment_name,
    );

    if (!target_deployment) {
        console.error(`Deployment not found for load balancer sh gen.`);
        process.exit(1);
    }

    const current_active_service = target_active_deployment?.services.find(
        (s) => s.service_name == load_balancer_service.service_name,
    );

    let finalCmd = "";

    if (!skip_init) {
        finalCmd += `cat /root/.bashrc | grep "ll='ls -laF'" || printf "\nalias ll='ls -laF'\n" >> /root/.bashrc\n`;
        finalCmd += `cat /root/.hushlogin || touch /root/.hushlogin\n`;
        finalCmd += `apt update\n`;
        finalCmd += `command -v nginx >/dev/null 2>&1 || apt install -y nginx\n`;
        finalCmd += `command -v certbot >/dev/null 2>&1 || apt install -y certbot\n`;
        finalCmd += `command -v bun >/dev/null 2>&1 || (apt install -y zip unzip curl wget && curl -fsSL https://bun.com/install | bash)\n`;

        finalCmd += `rm -f /etc/nginx/sites-enabled/default\n`;
    }

    /**
     * # SSL Config
     */
    const sslCmd = grabLoadBalancerCertbotSH({
        load_balancer_service,
        current_active_service,
    });

    if (sslCmd) {
        finalCmd += `${sslCmd}\n`;
    }

    /**
     * # Nginx Config
     */

    const nginxCnf = await grabLoadBalancerNginxConfig({
        target_deployment,
        load_balancer_service,
    });

    console.log("nginxCnf", nginxCnf);

    if (nginxCnf) {
        finalCmd += `\ncat << 'EOF' > /etc/nginx/nginx.conf\n`;
        finalCmd += `${nginxCnf}\n`;
        finalCmd += `EOF\n`;
    }

    /**
     * # Validate and reload nginx
     */
    finalCmd += `nginx -t || exit 1\n`;
    finalCmd += `rm -rf /var/cache/nginx/*\n`;
    finalCmd += `nginx -s reload\n`;

    const bulkCmds = bun
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

    return bulkCmds;
}
