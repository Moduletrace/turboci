import { CreateNatGatewayCommand } from "@aws-sdk/client-ec2";
import { AWSEC2Client } from "../../clients/ec2";

type Params = {
    region: string;
    subnet_id: string;
    allocation_id: string;
    name: string;
};

export default async function ({
    region,
    subnet_id,
    allocation_id,
    name,
}: Params) {
    const EC2Client = AWSEC2Client({ region });

    const newNATRes = await EC2Client.send(
        new CreateNatGatewayCommand({
            SubnetId: subnet_id,
            AllocationId: allocation_id,
            TagSpecifications: [
                {
                    ResourceType: "natgateway",
                    Tags: [{ Key: "Name", Value: name }],
                },
            ],
        })
    );

    return { nat: newNATRes.NatGateway };
}
