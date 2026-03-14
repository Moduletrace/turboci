import { DescribeVpcsCommand } from "@aws-sdk/client-ec2";
import { AWSEC2Client } from "../../clients/ec2";
import list from "./list";

type Params = {
    region: string;
    vpc_id?: string;
    network_name?: string;
};

export default async function ({ region, vpc_id, network_name }: Params) {
    const EC2Client = AWSEC2Client({ region });

    if (vpc_id) {
        const VPCsRes = await EC2Client.send(
            new DescribeVpcsCommand({
                VpcIds: [vpc_id],
            })
        );

        return { network: VPCsRes.Vpcs?.[0] };
    }

    if (network_name) {
        const ntwkSearch = await list({ region, network_name });

        const vpcID = ntwkSearch.networks?.[0]?.VpcId;

        if (!vpcID) {
            return {
                network: undefined,
            };
        }

        const VPCsRes = await EC2Client.send(
            new DescribeVpcsCommand({
                VpcIds: [vpcID],
            })
        );

        return { network: VPCsRes.Vpcs?.[0] };
    }

    return {
        network: undefined,
    };
}
