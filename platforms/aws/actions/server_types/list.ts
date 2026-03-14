import {
    DescribeInstanceTypesCommand,
    type InstanceTypeInfo,
} from "@aws-sdk/client-ec2";
import { AWSEC2Client } from "../../clients/ec2";

type Params = { region: string };

export default async function ({ region }: Params) {
    const EC2Client = AWSEC2Client({ region });

    const types: InstanceTypeInfo[] = [];
    let nextToken: string | undefined;

    do {
        const serverTypesRes = await EC2Client.send(
            new DescribeInstanceTypesCommand({ NextToken: nextToken })
        );

        serverTypesRes.InstanceTypes?.forEach((t) => {
            types.push(t);
        });

        nextToken = serverTypesRes.NextToken;
    } while (nextToken);

    return { server_types: types };
}
