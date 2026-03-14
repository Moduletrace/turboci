import create_subnet from "@/platforms/aws/actions/networks/create_subnet";
import type { TCIGlobalConfig } from "../../../../types";
import grabAppNames from "../../../../utils/grab-app-names";
import TurboCIAWS from "@/platforms/aws";

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
            `AWS newtwork setup requires a \`location\` parameter for deployment`,
        );
        process.exit(1);
    }

    const existingNetwork = await TurboCIAWS.networks.list({
        region: config.location,
        network_name: appNetworkName,
    });

    if (existingNetwork.networks?.[0]?.VpcId) {
        return true;
    }

    const newNtwkAWS = await TurboCIAWS.networks.create({
        network_name: appNetworkName,
        region: config.location,
    });

    if (newNtwkAWS.network?.VpcId) {
        const createPrivateSubnetRes = await create_subnet({
            region: config.location,
            subnet_name: privateSubnetName,
            vpc_id: newNtwkAWS.network.VpcId,
            availability_zone: config.availability_zone,
        });

        const createPublicSubnetRes = await create_subnet({
            region: config.location,
            subnet_name: publicSubnetName,
            vpc_id: newNtwkAWS.network.VpcId,
            availability_zone: config.availability_zone,
            is_public_subnet: true,
        });
    }

    return Boolean(newNtwkAWS.network?.VpcId);
}
