import {
    AuthorizeSecurityGroupIngressCommand,
    RevokeSecurityGroupIngressCommand,
    type IpPermission,
} from "@aws-sdk/client-ec2";
import { AWSEC2Client } from "../../clients/ec2";

type Params = {
    region: string;
    group_id: string;
    add_rules?: IpPermission[];
    remove_rules?: IpPermission[];
};

export default async function ({
    region,
    group_id,
    add_rules,
    remove_rules,
}: Params) {
    const EC2Client = AWSEC2Client({ region });

    if (add_rules) {
        const addRulesRes = await EC2Client.send(
            new AuthorizeSecurityGroupIngressCommand({
                GroupId: group_id,
                IpPermissions: add_rules,
            })
        );

        if (!addRulesRes.$metadata.httpStatusCode?.toString().match(/^2/)) {
            return { success: false };
        }
    }

    if (remove_rules) {
        const removeRulesRes = await EC2Client.send(
            new RevokeSecurityGroupIngressCommand({
                GroupId: group_id,
                IpPermissions: remove_rules,
            })
        );

        if (!removeRulesRes.$metadata.httpStatusCode?.toString().match(/^2/)) {
            return { success: false };
        }
    }

    return { success: true };
}
