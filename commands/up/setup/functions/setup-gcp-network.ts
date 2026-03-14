import type { TCIGlobalConfig } from "../../../../types";
import grabAppNames from "../../../../utils/grab-app-names";
import TurboCIGCP from "@/platforms/gcp";
import { gcpGetRegionFromZone } from "@/platforms/gcp/types";
import { AppNames } from "@/utils/app-names";

type Params = {
    config: TCIGlobalConfig;
};

export default async function ({ config }: Params) {
    const deploymentName = config.deployment_name;

    const { appNetworkName } = grabAppNames({
        name: deploymentName,
    });

    if (!config.location) {
        console.error(
            `GCP network setup requires a \`location\` (zone) parameter for deployment`,
        );
        process.exit(1);
    }

    const zone = config.location;
    const region = gcpGetRegionFromZone(zone);

    const existingNetwork = await TurboCIGCP.networks.get({
        network_name: appNetworkName,
    });

    if (existingNetwork.network?.name) {
        return true;
    }

    const newNetwork = await TurboCIGCP.networks.create({
        name: appNetworkName,
        labels: { [AppNames["TurboCILabelNameKey"]]: deploymentName },
    });

    if (!newNetwork.network?.name) {
        console.error(`Failed to create GCP network ${appNetworkName}`);
        process.exit(1);
    }

    // Create a single subnet for the region (GCP VPCs are global, subnets are regional)
    const subnetName = `${appNetworkName.replace("_network", "")}_subnet`;

    await TurboCIGCP.networks.create_subnet({
        subnet_name: subnetName,
        network_name: appNetworkName,
        region,
    });

    return true;
}
