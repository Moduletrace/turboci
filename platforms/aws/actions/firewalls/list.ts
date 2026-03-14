import {
    DescribeSecurityGroupsCommand,
    type DescribeSecurityGroupsCommandInput,
} from "@aws-sdk/client-ec2";
import { AWSEC2Client } from "../../clients/ec2";

export type AWSFirewallListParams = {
    region: string;
    name?: string | string[];
    tags?: { [k: string]: string };
};

export default async function ({ region, name, tags }: AWSFirewallListParams) {
    const EC2Client = AWSEC2Client({ region });

    let opts: DescribeSecurityGroupsCommandInput = {};

    if (name) {
        opts["Filters"] = [
            {
                Name: "tag:Name",
                Values: Array.isArray(name) ? name : [name],
            },
        ];
    }

    if (tags) {
        for (let i = 0; i < Object.keys(tags).length; i++) {
            const key = Object.keys(tags)[i];
            if (!key) continue;
            const value = tags[key];
            if (!value) continue;
            opts.Filters?.push({
                Name: `tag:${key}`,
                Values: Array.isArray(value) ? value : [value],
            });
        }
    }

    const firewallRes = await EC2Client.send(
        new DescribeSecurityGroupsCommand(opts)
    );

    return { firewalls: firewallRes.SecurityGroups };
}
