import { CreateVpcCommand } from "@aws-sdk/client-ec2";
import { AWSEC2Client } from "../../clients/ec2";
import awsGetNextAvailableCidrBlock from "../../utils/get-next-available-cidr-block";

type Params = {
    region: string;
    network_name: string;
};

export default async function ({ region, network_name }: Params) {
    const EC2Client = AWSEC2Client({ region });

    const CidrBlock = await awsGetNextAvailableCidrBlock(EC2Client);

    const newVPCRes = await EC2Client.send(
        new CreateVpcCommand({
            CidrBlock,
            TagSpecifications: [
                {
                    ResourceType: "vpc",
                    Tags: [{ Key: "Name", Value: network_name }],
                },
            ],
        })
    );

    return { network: newVPCRes.Vpc };
}
