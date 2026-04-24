import { AppNames } from "@/utils/app-names";
import Hetzner from "../../../../platforms/hetzner";
import type { TCIGlobalConfig } from "../../../../types";

type Params = {
    config: TCIGlobalConfig;
};

export default async function ({ config }: Params) {
    const deploymentName = config.deployment_name;

    const existingVolumes = await Hetzner.volumes.list({
        label_selector: `${AppNames["TurboCILabelNameKey"]}==${deploymentName}`,
    });

    if (existingVolumes.volumes?.[0]) {
        for (let i = 0; i < existingVolumes.volumes.length; i++) {
            const volume = existingVolumes.volumes[i];
            if (!volume?.id) continue;
            const dropVolume = await Hetzner.volumes.delete({
                volume_id: volume.id,
            });
        }
    }

    return true;
}
