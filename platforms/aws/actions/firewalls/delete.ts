import { DeleteSecurityGroupCommand } from "@aws-sdk/client-ec2";
import { AWSEC2Client } from "../../clients/ec2";

type Params = {
    region: string;
    group_id: string;
};

export default async function ({ region, group_id }: Params) {
    const EC2Client = AWSEC2Client({ region });

    const deleteSGRes = await EC2Client.send(
        new DeleteSecurityGroupCommand({
            GroupId: group_id,
        })
    );

    return { res: deleteSGRes };
}
