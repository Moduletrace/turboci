import Hetzner from "../../../../platforms/hetzner";
import type { TCIGlobalConfig } from "../../../../types";
import grabAppNames from "../../../../utils/grab-app-names";

type Params = {
    config: TCIGlobalConfig;
};

export default async function ({ config }: Params) {
    const deploymentName = config.deployment_name;

    const { appNetworkName } = grabAppNames({
        name: deploymentName,
    });

    const existingNetwork = await Hetzner.networks.list({
        name: appNetworkName,
    });

    if (!existingNetwork.networks?.[0]?.id) {
        return true;
    }

    const rmNtwkHetz = await Hetzner.networks.delete({
        network_id: existingNetwork.networks?.[0]?.id,
    });

    return Boolean(rmNtwkHetz);
}
