import { DescribeSecurityGroupsCommand } from "@aws-sdk/client-ec2";
import { AWSEC2Client } from "../../clients/ec2";

type Params = {
    region: string;
    vpc_id: string;
};

export default async function ({ region, vpc_id }: Params) {
    const EC2Client = AWSEC2Client({ region });

    const allSecurityGroupsRes = await EC2Client.send(
        new DescribeSecurityGroupsCommand({
            Filters: [{ Name: "vpc-id", Values: [vpc_id] }],
        })
    );

    return { sgs: allSecurityGroupsRes.SecurityGroups };
}
