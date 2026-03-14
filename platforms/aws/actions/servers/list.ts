import {
    DescribeInstancesCommand,
    type DescribeInstancesCommandInput,
    type Instance,
} from "@aws-sdk/client-ec2";
import { AWSEC2Client } from "../../clients/ec2";

export type AWSListServersParams = {
    region: string;
    name?: string | string[];
    instance_id?: string | string[];
    tag?: { [k: string]: string | string[] };
};

export default async function ({
    name,
    instance_id,
    region,
    tag,
}: AWSListServersParams) {
    let opts: DescribeInstancesCommandInput = { Filters: [] };

    const EC2Client = AWSEC2Client({ region });

    if (name) {
        opts.Filters?.push({
            Name: "tag:Name",
            Values: Array.isArray(name) ? name : [name],
        });
    }

    if (tag) {
        for (let i = 0; i < Object.keys(tag).length; i++) {
            const key = Object.keys(tag)[i];
            if (!key) continue;
            const value = tag[key];
            if (!value) continue;
            opts.Filters?.push({
                Name: `tag:${key}`,
                Values: Array.isArray(value) ? value : [value],
            });
        }
    }

    if (instance_id) {
        opts["InstanceIds"] = Array.isArray(instance_id)
            ? instance_id
            : [instance_id];
    }

    const servers: Instance[] = [];
    let nextToken: string | undefined;

    do {
        const serversRes = await EC2Client.send(
            new DescribeInstancesCommand(opts)
        );

        serversRes.Reservations?.forEach((srv) => {
            servers.push(...(srv.Instances || []));
        });

        nextToken = serversRes.NextToken;
    } while (nextToken);

    return { servers };
}
