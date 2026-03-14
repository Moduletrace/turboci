import { DescribeKeyPairsCommand } from "@aws-sdk/client-ec2";
import { AWSEC2Client } from "../../clients/ec2";

type Params = {
    region: string;
    key_name?: string;
    key_id?: string;
};

export default async function ({ region, key_id, key_name }: Params) {
    try {
        const EC2Client = AWSEC2Client({ region });

        const sshKeysRes = await EC2Client.send(
            new DescribeKeyPairsCommand({
                KeyNames: key_name ? [key_name] : undefined,
                KeyPairIds: key_id ? [key_id] : undefined,
            })
        );

        return { ssh_keys: sshKeysRes.KeyPairs };
    } catch (error) {
        return { ssh_keys: undefined };
    }
}
