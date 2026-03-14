import {
    AuthorizeSecurityGroupEgressCommand,
    AuthorizeSecurityGroupIngressCommand,
    CreateSecurityGroupCommand,
    type CreateSecurityGroupCommandInput,
    type IpPermission,
} from "@aws-sdk/client-ec2";
import { AWSEC2Client } from "../../clients/ec2";

type Params = {
    region: string;
    name: string;
    description: string;
    vpc_id: string;
    rules: IpPermission[];
    tags?: { [k: string]: string };
    allow_all_egress?: boolean;
};

export default async function ({
    region,
    name,
    description,
    vpc_id,
    rules,
    tags,
    allow_all_egress,
}: Params) {
    const EC2Client = AWSEC2Client({ region });

    let opts: CreateSecurityGroupCommandInput = {
        GroupName: name,
        Description: description,
        VpcId: vpc_id,
        TagSpecifications: [
            {
                ResourceType: "security-group",
                Tags: [
                    { Key: "Name", Value: name },
                    ...(tags
                        ? Object.entries(tags).map(([Key, Value]) => ({
                              Key,
                              Value,
                          }))
                        : []),
                ],
            },
        ],
    };

    // console.log("opts", opts);

    const newFirewallRes = await EC2Client.send(
        new CreateSecurityGroupCommand(opts)
    );

    // console.log("newFirewallRes", newFirewallRes);

    const firewallIngressRules = await EC2Client.send(
        new AuthorizeSecurityGroupIngressCommand({
            GroupId: newFirewallRes.GroupId!,
            IpPermissions: rules,
        })
    );

    if (allow_all_egress) {
        const firewallEgressRules = await EC2Client.send(
            new AuthorizeSecurityGroupEgressCommand({
                GroupId: newFirewallRes.GroupId!,
                IpPermissions: [
                    {
                        IpProtocol: "-1",
                        IpRanges: [{ CidrIp: "0.0.0.0/0" }],
                    },
                ],
            })
        );
    }

    return { firewall: newFirewallRes, options: opts };
}
