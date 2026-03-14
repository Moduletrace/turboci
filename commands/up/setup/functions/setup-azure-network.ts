import type { TCIGlobalConfig } from "../../../../types";
import grabAppNames from "../../../../utils/grab-app-names";
import TurboCIAzure from "@/platforms/azure";
import { AppNames } from "@/utils/app-names";
import createResourceGroup from "@/platforms/azure/utils/create-resource-group";

type Params = {
    config: TCIGlobalConfig;
};

export default async function ({ config }: Params) {
    const deploymentName = config.deployment_name;

    const { appNetworkName, publicSubnetName, privateSubnetName } =
        grabAppNames({
            name: deploymentName,
        });

    if (!config.location) {
        console.error(
            `Azure network setup requires a \`location\` parameter for deployment`,
        );
        process.exit(1);
    }

    const location = config.location;

    // Ensure resource group exists
    await createResourceGroup({ deployment_name: deploymentName, location });

    const existingNetwork = await TurboCIAzure.networks.get({
        deployment_name: deploymentName,
        network_name: appNetworkName,
    });

    if (existingNetwork.network?.name) {
        return true;
    }

    const newNetwork = await TurboCIAzure.networks.create({
        deployment_name: deploymentName,
        network_name: appNetworkName,
        location,
        address_prefix: "10.0.0.0/16",
        tags: { [AppNames["TurboCILabelNameKey"]]: deploymentName },
    });

    if (!newNetwork.network?.name) {
        console.error(`Failed to create Azure VNet ${appNetworkName}`);
        process.exit(1);
    }

    // Create public subnet
    await TurboCIAzure.networks.create_subnet({
        deployment_name: deploymentName,
        vnet_name: appNetworkName,
        subnet_name: publicSubnetName,
        address_prefix: "10.0.0.0/24",
    });

    // Create private subnet
    await TurboCIAzure.networks.create_subnet({
        deployment_name: deploymentName,
        vnet_name: appNetworkName,
        subnet_name: privateSubnetName,
        address_prefix: "10.0.1.0/24",
    });

    return true;
}
