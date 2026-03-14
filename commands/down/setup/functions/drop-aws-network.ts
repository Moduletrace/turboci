import TurboCIAWS from "@/platforms/aws";
import type { TCIGlobalConfig } from "../../../../types";
import grabAppNames from "../../../../utils/grab-app-names";
import { AWSEC2Client } from "@/platforms/aws/clients/ec2";
import { AssociateDhcpOptionsCommand } from "@aws-sdk/client-ec2";

type Params = {
    config: TCIGlobalConfig;
};

export default async function ({ config }: Params) {
    const deploymentName = config.deployment_name;

    const { appNetworkName } = grabAppNames({
        name: deploymentName,
    });

    const existingNetworkRes = await TurboCIAWS.networks.list({
        network_name: appNetworkName,
        region: config.location!,
    });

    const existingNetwork = existingNetworkRes.networks?.[0];

    if (!existingNetwork?.VpcId) {
        return true;
    }

    const EC2Client = AWSEC2Client({ region: config.location! });

    const deleteInternetGateway =
        await TurboCIAWS.networks.delete_internet_gateway({
            region: config.location!,
            igw_name: "turboci-aws-default-internet-gateway",
            vpc_id: existingNetwork.VpcId,
        });

    await TurboCIAWS.networks.delete_route_tables({
        region: config.location!,
        vpc_id: existingNetwork.VpcId,
    });

    await TurboCIAWS.networks.delete_subnets({
        region: config.location!,
        vpc_id: existingNetwork.VpcId,
    });

    await EC2Client.send(
        new AssociateDhcpOptionsCommand({
            DhcpOptionsId: "default",
            VpcId: existingNetwork.VpcId,
        }),
    );

    const rmNtwk = await TurboCIAWS.networks.delete({
        region: config.location!,
        vpc_id: existingNetwork.VpcId,
    });

    return Boolean(rmNtwk.del.$metadata.httpStatusCode?.toString().match(/^2/));
}
