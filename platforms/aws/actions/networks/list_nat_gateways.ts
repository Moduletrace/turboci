import { DescribeNatGatewaysCommand, type Filter } from "@aws-sdk/client-ec2";
import { AWSEC2Client } from "../../clients/ec2";

type Params = {
    region: string;
    name?: string;
};

export default async function ({ region, name }: Params) {
    const EC2Client = AWSEC2Client({ region });

    let filter: Filter[] = [];

    if (name) {
        filter.push({ Name: "tag:Name", Values: [name] });
    }

    const allInternetGatewaysRes = await EC2Client.send(
        new DescribeNatGatewaysCommand({
            Filter: filter,
        })
    );

    return { nat_gateways: allInternetGatewaysRes.NatGateways };
}
