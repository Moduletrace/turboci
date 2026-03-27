import type { ParsedDeploymentServiceConfig, TCIGlobalConfig } from "@/types";
import bunGrabPrivateIPsBulkScripts from "@/utils/bun-scripts/bun-grab-private-ips-bulk-scripts";
import grabPrivateIPsBulkScripts from "@/utils/ssh/shell-scripts/grab-private-ips-bulk-scripts";
import grabMaxScaleConfig from "./grab-maxscale-config";

type Params = {
    private_server_ips: string[];
    maxscale_service: ParsedDeploymentServiceConfig;
    deployment: TCIGlobalConfig;
    skip_init?: boolean;
    bun?: boolean;
};

/**
 * Generates the shell script that runs on MaxScale proxy servers during
 * the prepare phase:
 *
 * 1. Installs MaxScale via the MariaDB repository (if not already present).
 * 2. Writes /etc/maxscale.cnf from the generated config.
 * 3. Enables and (re)starts the maxscale systemd service.
 *
 * Called on every deploy and on backend-service changes so that MaxScale
 * always reflects the current set of backend IPs.
 */
export default async function grabMaxScaleServerPrepSH({
    private_server_ips,
    maxscale_service,
    deployment,
    skip_init,
    bun,
}: Params) {
    let finalCmd = `set -e\n\n`;

    if (!skip_init) {
        finalCmd += `cat /root/.hushlogin || touch /root/.hushlogin\n`;
        finalCmd += `apt update -qq\n`;
        finalCmd += `command -v maxscale >/dev/null 2>&1 || (\n`;
        // finalCmd += `    apt install -y wget gnupg2\n`;
        // finalCmd += `    wget -q https://downloads.mariadb.com/MariaDB/mariadb_repo_setup -O /tmp/mariadb_repo_setup\n`;
        // finalCmd += `    chmod +x /tmp/mariadb_repo_setup && /tmp/mariadb_repo_setup\n`;
        // finalCmd += `    apt update -qq && apt install -y maxscale\n`;
        finalCmd += `    apt install -y curl\n`;
        finalCmd += `    curl -LsS https://r.mariadb.com/downloads/mariadb_repo_setup | bash\n`;
        finalCmd += `    apt install -y maxscale-trial\n`;
        finalCmd += `)\n\n`;
    }

    const maxscaleCnf = await grabMaxScaleConfig({
        maxscale_service,
        deployment,
    });

    if (maxscaleCnf) {
        finalCmd += `cat << 'MAXSCALEEOF' > /etc/maxscale.cnf\n`;
        finalCmd += `${maxscaleCnf}`;
        finalCmd += `MAXSCALEEOF\n\n`;
    }

    finalCmd += `systemctl enable maxscale\n`;
    finalCmd += `systemctl restart maxscale 2>/dev/null || systemctl start maxscale\n`;

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
