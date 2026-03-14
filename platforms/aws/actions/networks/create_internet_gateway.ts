import { CreateInternetGatewayCommand } from "@aws-sdk/client-ec2";
import { AWSEC2Client } from "../../clients/ec2";

export const AWSInternetGatewayNames = [
    "turboci-aws-default-internet-gateway",
] as const;

type Params = {
    region: string;
    igw_name: (typeof AWSInternetGatewayNames)[number];
};

export default async function ({ region, igw_name }: Params) {
    const EC2Client = AWSEC2Client({ region });

    const newIGW = await EC2Client.send(
        new CreateInternetGatewayCommand({
            TagSpecifications: [
                {
                    ResourceType: "internet-gateway",
                    Tags: [
                        {
                            Key: "Name",
                            Value: igw_name,
                        },
                    ],
                },
            ],
        })
    );

    return { internet_gateway: newIGW.InternetGateway };
}
