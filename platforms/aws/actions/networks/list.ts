import { DescribeVpcsCommand } from "@aws-sdk/client-ec2";
import { AWSEC2Client } from "../../clients/ec2";

type Params = { region: string; network_name?: string };

export default async function ({ region, network_name }: Params) {
    const EC2Client = AWSEC2Client({ region });

    const allVPCsRes = await EC2Client.send(
        new DescribeVpcsCommand({
            Filters: network_name
                ? [
                      {
                          Name: "tag:Name",
                          Values: [network_name],
                      },
                  ]
                : undefined,
        })
    );

    return { networks: allVPCsRes.Vpcs };
}
