import Hetzner from "../../../../platforms/hetzner";
import hetznerGrabNextAvailableNetwork from "../../../../platforms/hetzner/functions/grab-next-available-network";
import type { TCIGlobalConfig } from "../../../../types";
import { AppNames } from "../../../../utils/app-names";
import grabAppNames from "../../../../utils/grab-app-names";

type Params = {
    config: TCIGlobalConfig;
};

export default async function ({ config }: Params) {
    const deploymentName = config.deployment_name;

    const { appNetworkName } = grabAppNames({
        name: deploymentName,
    });

    const { ip_range, subnets } = await hetznerGrabNextAvailableNetwork({
        location: config.location as any,
    });

    const existingNetwork = await Hetzner.networks.list({
        name: appNetworkName,
    });

    if (existingNetwork.networks?.[0]?.id) {
        return true;
    }

    const newNtwkHetz = await Hetzner.networks.create({
        name: appNetworkName,
        ip_range,
        subnets,
        labels: {
            [AppNames["TurboCILabelNameKey"]]: deploymentName,
        },
    });

    return Boolean(newNtwkHetz.network?.id);
}
