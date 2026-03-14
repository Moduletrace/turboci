import { DeleteVpcCommand, type Tag } from "@aws-sdk/client-ec2";
import { AWSEC2Client } from "../../clients/ec2";

type Params = {
    region: string;
    vpc_id: string;
};

export default async function ({ region, vpc_id }: Params) {
    const EC2Client = AWSEC2Client({ region });

    const updateVPCRes = await EC2Client.send(
        new DeleteVpcCommand({
            VpcId: vpc_id,
        })
    );

    return { del: updateVPCRes };
}
