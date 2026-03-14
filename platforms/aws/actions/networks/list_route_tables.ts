import { DescribeRouteTablesCommand } from "@aws-sdk/client-ec2";
import { AWSEC2Client } from "../../clients/ec2";
import type { AWSRouteTableNames } from "./create_route_table";

type Params = {
    region: string;
    route_table_name?: (typeof AWSRouteTableNames)[number];
    vpc_id?: string;
};

export default async function ({ region, route_table_name, vpc_id }: Params) {
    const EC2Client = AWSEC2Client({ region });

    const allRouteTablesRes = await EC2Client.send(
        new DescribeRouteTablesCommand({
            Filters: route_table_name
                ? [{ Name: "tag:Name", Values: [route_table_name] }]
                : vpc_id
                ? [{ Name: "vpc-id", Values: [vpc_id] }]
                : undefined,
        })
    );

    return { route_tables: allRouteTablesRes.RouteTables };
}
