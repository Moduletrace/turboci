import {
    DeleteInternetGatewayCommand,
    DetachInternetGatewayCommand,
} from "@aws-sdk/client-ec2";
import { AWSEC2Client } from "../../clients/ec2";
import type { AWSInternetGatewayNames } from "./create_internet_gateway";
import get_internet_gateway from "./get_internet_gateway";

type Params = {
    region: string;
    igw_name?: (typeof AWSInternetGatewayNames)[number];
    igw_ids?: string[];
    vpc_id: string;
};

export default async function ({ region, igw_name, igw_ids, vpc_id }: Params) {
    try {
        const EC2Client = AWSEC2Client({ region });

        const targetIgw = await get_internet_gateway({
            region,
            igw_ids,
            igw_name,
        });

        await EC2Client.send(
            new DetachInternetGatewayCommand({
                InternetGatewayId:
                    targetIgw.internet_gateway?.InternetGatewayId,
                VpcId: vpc_id,
            })
        );

        const delGw = await EC2Client.send(
            new DeleteInternetGatewayCommand({
                InternetGatewayId:
                    targetIgw.internet_gateway?.InternetGatewayId,
            })
        );

        return { del: delGw };
    } catch (error: any) {
        return { del: undefined };
    }
}
