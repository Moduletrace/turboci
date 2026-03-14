import { DeleteKeyPairCommand } from "@aws-sdk/client-ec2";
import { AWSEC2Client } from "../../clients/ec2";

type Params = {
    region: string;
    key_name?: string;
    key_id?: string;
};

export default async function ({ region, key_name, key_id }: Params) {
    const EC2Client = AWSEC2Client({ region });

    const delSSHKey = await EC2Client.send(
        new DeleteKeyPairCommand({
            KeyName: key_name,
            KeyPairId: key_id,
        })
    );

    return { del_res: delSSHKey };
}
