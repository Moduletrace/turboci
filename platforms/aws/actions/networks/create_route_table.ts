import { CreateRouteTableCommand } from "@aws-sdk/client-ec2";
import { AWSEC2Client } from "../../clients/ec2";

export const AWSRouteTableNames = [
    "turboci-aws-private-route-table",
    "turboci-aws-public-route-table",
] as const;

type Params = {
    region: string;
    vpc_id: string;
    route_table_name: (typeof AWSRouteTableNames)[number];
};

export default async function ({ region, vpc_id, route_table_name }: Params) {
    const EC2Client = AWSEC2Client({ region });

    const newSubnetRes = await EC2Client.send(
        new CreateRouteTableCommand({
            VpcId: vpc_id,
            TagSpecifications: [
                {
                    ResourceType: "route-table",
                    Tags: [
                        {
                            Key: "Name",
                            Value: route_table_name,
                        },
                    ],
                },
            ],
        })
    );

    return { route_table: newSubnetRes.RouteTable };
}
