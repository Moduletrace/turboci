import {
    TerminateInstancesCommand,
    type TerminateInstancesCommandInput,
} from "@aws-sdk/client-ec2";
import { AWSEC2Client } from "../../clients/ec2";
import list from "./list";

export type AWSListServersParams = {
    region: string;
    instance_id?: string | string[];
    tag?: { [k: string]: string | string[] };
    name?: string;
};

export default async function ({
    instance_id,
    region,
    tag,
    name,
}: AWSListServersParams) {
    let InstanceIds = (
        Array.isArray(instance_id) ? instance_id : [instance_id]
    ) as string[] | undefined;

    if (name || tag) {
        const serversRes = await list({
            region,
            name,
            tag,
        });

        InstanceIds = serversRes.servers?.map((s) => s.InstanceId!);
    }

    if (!InstanceIds) {
        throw new Error(`Couldn't get instance IDs`);
    }

    let opts: TerminateInstancesCommandInput = {
        InstanceIds,
    };

    const EC2Client = AWSEC2Client({ region });

    const deleteInstancesTagsRes = await EC2Client.send(
        new TerminateInstancesCommand(opts)
    );

    return { res: deleteInstancesTagsRes };
}
