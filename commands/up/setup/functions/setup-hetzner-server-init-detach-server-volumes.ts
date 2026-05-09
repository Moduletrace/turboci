import type { HETZNER_EXISTING_SERVER } from "@/platforms/hetzner/types";
import Hetzner from "../../../../platforms/hetzner";
import type {
    ParsedDeploymentServiceConfig,
    TCIConfigDeployment,
} from "../../../../types";
import _ from "lodash";

type Params = {
    service: ParsedDeploymentServiceConfig;
    deployment: Omit<TCIConfigDeployment, "services">;
    server: HETZNER_EXISTING_SERVER;
};

export default async function ({ service, deployment, server }: Params) {
    const server_volumes = server.volumes;

    if (!server_volumes) {
        return;
    }

    for (let i = 0; i < server_volumes.length; i++) {
        const volume_id = server_volumes[i];
        if (!volume_id) continue;
        const detach_volume = await Hetzner.volumes.detach({
            volume_id,
        });

        const MAX_RETRIES = 10;
        let retries = 0;

        while (true) {
            if (retries > MAX_RETRIES) {
                console.error(`Couldn't detach volume.`);
                process.exit(1);
            }

            const check_vol = await Hetzner.volumes.get({ volume_id });

            if (check_vol.volume && !check_vol.volume.server) {
                break;
            }

            retries++;

            await Bun.sleep(2000);
        }
    }
}
