import grabServerVolumeName from "@/utils/grab-server-volume-name";
import Hetzner from "../../../../platforms/hetzner";
import type {
    ParsedDeploymentServiceConfig,
    TCIConfigDeployment,
} from "../../../../types";
import _ from "lodash";
import { AppNames } from "@/utils/app-names";

type Params = {
    service: ParsedDeploymentServiceConfig;
    deployment: Omit<TCIConfigDeployment, "services">;
    server_index: number;
};

export default async function ({ service, deployment, server_index }: Params) {
    let volumes: number[] = [];

    if (service.volumes?.[0]) {
        for (let i = 0; i < service.volumes.length; i++) {
            const service_volume = service.volumes[i];

            if (!service_volume) continue;

            const service_volume_name = grabServerVolumeName({
                config: deployment,
                service,
                server_index,
                volume_index: i,
            });

            const hetzner_volume = (
                await Hetzner.volumes.list({
                    name: service_volume_name,
                })
            )?.volumes?.[0];

            if (hetzner_volume?.id) {
                if (service_volume.size == hetzner_volume.size) {
                    volumes.push(hetzner_volume.id);
                } else {
                    const resize_vol_res = await Hetzner.volumes.resize({
                        volume_id: hetzner_volume.id,
                        size: service_volume.size,
                    });

                    if (resize_vol_res.error) {
                        console.error(
                            `Couldn't resize \`${i}\` for \`${service.service_name}\` service instance \`${server_index}\``,
                        );
                        console.error(
                            `Code: ${resize_vol_res.error.code}\nError: ${resize_vol_res.error.message}`,
                        );
                        process.exit(1);
                    }
                }
                continue;
            }

            const new_volume = await Hetzner.volumes.create({
                name: service_volume_name,
                size: service_volume.size,
                labels: {
                    [AppNames["TurboCILabelNameKey"]]:
                        deployment.deployment_name,
                    [AppNames["TurboCILabelServiceNameKey"]]:
                        service.service_name,
                    [AppNames["TurboCILabelVolumeNameKey"]]:
                        service_volume_name,
                },
                location: deployment.location!,
            });

            if (new_volume.volume?.id) {
                volumes.push(new_volume.volume.id);
            } else {
                console.error(
                    `Couldn't create volume \`${i}\` for \`${service.service_name}\` service instance \`${server_index}\``,
                );
                process.exit(1);
            }
        }
    }

    return volumes;
}
