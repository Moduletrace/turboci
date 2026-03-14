import { DescribeRegionsCommand } from "@aws-sdk/client-ec2";
import { AWSEC2Client } from "../../clients/ec2";

type Params = { region: string };

export default async function ({ region }: Params) {
    const EC2Client = AWSEC2Client({ region });
    const regionsRes = await EC2Client.send(
        new DescribeRegionsCommand({ AllRegions: true })
    );

    return { locations: regionsRes.Regions };
}
