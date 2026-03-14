import {
    DescribeSubnetsCommand,
    DescribeInternetGatewaysCommand,
    DescribeNatGatewaysCommand,
    DescribeNetworkInterfacesCommand,
    DescribeRouteTablesCommand,
    DescribeSecurityGroupsCommand,
    DescribeNetworkAclsCommand,
    DescribeVpcEndpointsCommand,
    DescribeEgressOnlyInternetGatewaysCommand,
} from "@aws-sdk/client-ec2";
import { AWSEC2Client } from "../clients/ec2";

type Params = {
    vpc_id: string;
    region: string;
};

export default async function listVpcDependencies({ region, vpc_id }: Params) {
    const EC2Client = AWSEC2Client({ region });

    console.log(`🔍 Checking dependencies for ${vpc_id}...`);

    const checks = [
        {
            name: "Subnets",
            cmd: new DescribeSubnetsCommand({
                Filters: [{ Name: "vpc-id", Values: [vpc_id] }],
            }),
        },
        {
            name: "Internet Gateways",
            cmd: new DescribeInternetGatewaysCommand({
                Filters: [{ Name: "attachment.vpc-id", Values: [vpc_id] }],
            }),
        },
        {
            name: "NAT Gateways",
            cmd: new DescribeNatGatewaysCommand({
                Filter: [{ Name: "vpc-id", Values: [vpc_id] }],
            }),
        },
        {
            name: "Network Interfaces",
            cmd: new DescribeNetworkInterfacesCommand({
                Filters: [{ Name: "vpc-id", Values: [vpc_id] }],
            }),
        },
        {
            name: "Route Tables",
            cmd: new DescribeRouteTablesCommand({
                Filters: [{ Name: "vpc-id", Values: [vpc_id] }],
            }),
        },
        {
            name: "Security Groups",
            cmd: new DescribeSecurityGroupsCommand({
                Filters: [{ Name: "vpc-id", Values: [vpc_id] }],
            }),
        },
        {
            name: "Network ACLs",
            cmd: new DescribeNetworkAclsCommand({
                Filters: [{ Name: "vpc-id", Values: [vpc_id] }],
            }),
        },
        {
            name: "VPC Endpoints",
            cmd: new DescribeVpcEndpointsCommand({
                Filters: [{ Name: "vpc-id", Values: [vpc_id] }],
            }),
        },
        {
            name: "Egress-only IGWs",
            cmd: new DescribeEgressOnlyInternetGatewaysCommand({
                Filters: [{ Name: "vpc-id", Values: [vpc_id] }],
            }),
        },
    ];

    for (const { name, cmd } of checks) {
        try {
            const result = (await EC2Client.send(cmd)) as any;
            const indx = Object.keys(result)[0] as string;
            const items = result[indx];

            if (items?.length) {
                console.log(`🚧 Found ${items.length} ${name}:`);
                for (const i of items) {
                    console.log(
                        "  ",
                        i.RouteTableId ||
                            i.SubnetId ||
                            i.NetworkInterfaceId ||
                            i.GroupId ||
                            i.VpcEndpointId ||
                            i.EgressOnlyInternetGatewayId
                    );
                }
            } else {
                console.log(`✅ No ${name} found.`);
            }
        } catch (err) {
            if (!String(err).includes("UnsupportedOperation")) {
                console.error(`⚠️ Error checking ${name}:`, err);
            }
        }
    }

    console.log("✅ Dependency scan complete.");
}
