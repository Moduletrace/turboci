import grabVolumeName from "@/utils/grab-volume-name";
import Hetzner from "../../../../platforms/hetzner";
import type {
    TCIConfigDeployment,
    TCIConfigServiceConfig,
} from "../../../../types";
import _ from "lodash";

type Params = {
    service: TCIConfigServiceConfig;
    deployment: Omit<TCIConfigDeployment, "services">;
};

export default async function ({ service, deployment }: Params) {
    let volumes: number[] = [];

    if (service.volumes?.[0]) {
        for (let i = 0; i < service.volumes.length; i++) {
            const service_volume_name = service.volumes[i];

            if (!service_volume_name) continue;

            const hetzner_volume = (
                await Hetzner.volumes.list({
                    name: grabVolumeName({
                        config: deployment,
                        volume_name: service_volume_name,
                    }),
                })
            )?.volumes?.[0];
            if (hetzner_volume?.id) {
                volumes.push(hetzner_volume.id);
            }
        }
    }

    return volumes;
}
