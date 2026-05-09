import Hetzner from "../../../../platforms/hetzner";
import type {
    ParsedDeploymentServiceConfig,
    TCIConfigDeployment,
} from "../../../../types";
import _ from "lodash";
import type { HETZNER_NEW_SERVER } from "@/platforms/hetzner/types";
import relayExecSSH from "@/utils/ssh/relay-exec-ssh";
import AppData from "@/data/app-data";
import grabPrivateIPsBulkScripts from "@/utils/ssh/shell-scripts/grab-private-ips-bulk-scripts";

type Params = {
    service: ParsedDeploymentServiceConfig;
    deployment: Omit<TCIConfigDeployment, "services">;
    all_servers: HETZNER_NEW_SERVER[];
};

export default async function ({ service, deployment, all_servers }: Params) {
    const service_volumes = service.volumes;

    if (!service_volumes) {
        return;
    }

    for (let i = 0; i < all_servers.length; i++) {
        const server = all_servers[i];
        const server_private_ip = server?.private_net?.[0]?.ip;

        if (!server_private_ip) {
            continue;
        }

        if (server?.volumes?.[0]) {
            let cmd = ``;

            for (let vol = 0; vol < server.volumes.length; vol++) {
                const volume_id = server.volumes[vol];
                if (!volume_id) continue;

                const volume = (await Hetzner.volumes.get({ volume_id }))
                    .volume;

                if (!volume?.id) {
                    console.error(`This volume was not created.`);
                    process.exit(1);
                }

                for (let srvol = 0; srvol < service_volumes.length; srvol++) {
                    const service_vol = service_volumes[srvol];

                    if (!service_vol?.mount_dir) {
                        console.error(`Volume requires a mount directory`);
                        process.exit(1);
                    }

                    cmd += `if [ ! -d "${service_vol.mount_dir}"; then\n`;
                    cmd += `    mount ${volume.linux_device} ${service_vol.mount_dir}\n`;
                    cmd += `fi\n`;
                }
            }

            const script = grabPrivateIPsBulkScripts({
                private_server_ips: [server_private_ip],
                script: cmd,
            });

            const res = await relayExecSSH({
                cmd: script,
                deployment,
                log_error: true,
                options: {
                    timeout: AppData["DefaultInitTimeoutMilliseconds"],
                },
            });

            if (!res) {
                console.error(
                    `\`${service.service_name}\` volume mount failed!`,
                );
                process.exit(1);
            }
        }
    }
}
