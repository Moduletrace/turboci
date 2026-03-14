import { ImportKeyPairCommand } from "@aws-sdk/client-ec2";
import { AWSEC2Client } from "../../clients/ec2";

type Params = {
    region: string;
    key_name: string;
    public_key: string;
};

export default async function ({ region, key_name, public_key }: Params) {
    const EC2Client = AWSEC2Client({ region });

    const newSSHKey = await EC2Client.send(
        new ImportKeyPairCommand({
            KeyName: key_name,
            PublicKeyMaterial: Buffer.from(public_key.trim()),
        })
    );

    return { ssh_key: newSSHKey };
}
