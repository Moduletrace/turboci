import { DescribeSubnetsCommand, type Filter } from "@aws-sdk/client-ec2";
import { AWSEC2Client } from "../../clients/ec2";

type Params = {
    region: string;
    vpc_id: string;
    subnet_name?: string;
};

export default async function ({ region, vpc_id, subnet_name }: Params) {
    const EC2Client = AWSEC2Client({ region });

    let filters: Filter[] = [{ Name: "vpc-id", Values: [vpc_id] }];

    if (subnet_name) {
        filters.push({ Name: "tag:Name", Values: [subnet_name] });
    }

    const allSubnetsRes = await EC2Client.send(
        new DescribeSubnetsCommand({
            Filters: filters,
        })
    );

    return { subnets: allSubnetsRes.Subnets };
}
