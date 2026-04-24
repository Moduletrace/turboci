import Hetzner from "../../../../platforms/hetzner";
import type { TCIGlobalConfig } from "../../../../types";
import { AppNames } from "../../../../utils/app-names";
import grabVolumeName from "@/utils/grab-volume-name";

type Params = {
    config: TCIGlobalConfig;
};

export default async function ({ config }: Params) {
    const deploymentName = config.deployment_name;

    if (config.volumes) {
        const volume_names = Object.keys(config.volumes);

        for (let i = 0; i < volume_names.length; i++) {
            const volume_name = volume_names[i];

            if (!volume_name) continue;

            const volume = config.volumes[volume_name];

            if (!volume) continue;

            const final_volume_name = grabVolumeName({
                config,
                volume_name,
            });

            const create_volume = await Hetzner.volumes.create({
                name: final_volume_name,
                labels: {
                    [AppNames["TurboCILabelNameKey"]]: deploymentName,
                    [AppNames["TurboCILabelVolumeNameKey"]]: final_volume_name,
                },
                size: volume.size,
            });

            if (!create_volume.volume?.id) {
                throw new Error(`Couldn't create volume \`${volume_name}\``);
            }
        }
    }

    return true;
}
