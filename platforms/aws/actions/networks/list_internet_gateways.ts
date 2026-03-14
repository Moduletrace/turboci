import {
    DescribeInternetGatewaysCommand,
    type DescribeInternetGatewaysCommandInput,
    type Filter,
} from "@aws-sdk/client-ec2";
import { AWSEC2Client } from "../../clients/ec2";
import type { AWSInternetGatewayNames } from "./create_internet_gateway";

type Params = {
    region: string;
    igw_name?: (typeof AWSInternetGatewayNames)[number];
    igw_ids?: string[];
};

export default async function ({ region, igw_name, igw_ids }: Params) {
    const EC2Client = AWSEC2Client({ region });

    let opts: DescribeInternetGatewaysCommandInput = {};

    let filter: Filter[] = [];

    if (igw_name) {
        filter.push({ Name: "tag:Name", Values: [igw_name] });
    }

    if (igw_ids) {
        opts.InternetGatewayIds = igw_ids;
    }

    opts.Filters = filter;

    const allInternetGatewaysRes = await EC2Client.send(
        new DescribeInternetGatewaysCommand(opts)
    );

    return { internet_gateways: allInternetGatewaysRes.InternetGateways };
}
