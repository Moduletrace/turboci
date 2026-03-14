import {
    AssociateRouteTableCommand,
    AttachInternetGatewayCommand,
    CreateRouteCommand,
    CreateSubnetCommand,
    ModifySubnetAttributeCommand,
    type Tag,
} from "@aws-sdk/client-ec2";
import { AWSEC2Client } from "../../clients/ec2";
import { awsGetNextAvailableSubnetCidrBlock } from "../../utils/get-next-available-subnet-cidr-block";
import create_route_table from "./create_route_table";
import create_internet_gateway from "./create_internet_gateway";

type Params = {
    region: string;
    vpc_id: string;
    subnet_name: string;
    availability_zone?: string;
    is_public_subnet?: boolean;
};

export default async function ({
    region,
    vpc_id,
    subnet_name,
    availability_zone,
    is_public_subnet,
}: Params) {
    const EC2Client = AWSEC2Client({ region });

    const nextAvailableSubnetCidr = await awsGetNextAvailableSubnetCidrBlock({
        ec2: EC2Client,
        vpcId: vpc_id,
    });

    const newSubnetRes = await EC2Client.send(
        new CreateSubnetCommand({
            VpcId: vpc_id,
            CidrBlock: nextAvailableSubnetCidr,
            TagSpecifications: [
                {
                    ResourceType: "subnet",
                    Tags: [{ Key: "Name", Value: subnet_name }],
                },
            ],
            AvailabilityZone: availability_zone,
        })
    );

    if (is_public_subnet && newSubnetRes.Subnet?.SubnetId) {
        const igwResult = await create_internet_gateway({
            igw_name: "turboci-aws-default-internet-gateway",
            region,
        });

        const internetGateway = igwResult.internet_gateway;

        if (!internetGateway?.InternetGatewayId) {
            console.error(`Couldn't create Internet gateway for subnet`);
            process.exit(1);
        }

        await EC2Client.send(
            new AttachInternetGatewayCommand({
                VpcId: vpc_id,
                InternetGatewayId: internetGateway.InternetGatewayId,
            })
        );

        const publicSubnetRouteTableRes = await create_route_table({
            region,
            route_table_name: "turboci-aws-public-route-table",
            vpc_id,
        });

        await EC2Client.send(
            new CreateRouteCommand({
                RouteTableId:
                    publicSubnetRouteTableRes.route_table?.RouteTableId,
                DestinationCidrBlock: "0.0.0.0/0",
                GatewayId: internetGateway.InternetGatewayId,
            })
        );

        await EC2Client.send(
            new ModifySubnetAttributeCommand({
                SubnetId: newSubnetRes.Subnet.SubnetId,
                MapPublicIpOnLaunch: { Value: true },
            })
        );

        await EC2Client.send(
            new AssociateRouteTableCommand({
                SubnetId: newSubnetRes.Subnet.SubnetId,
                RouteTableId:
                    publicSubnetRouteTableRes.route_table?.RouteTableId,
            })
        );
    }

    return { subnet: newSubnetRes.Subnet };
}
