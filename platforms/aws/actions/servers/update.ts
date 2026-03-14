import {
    CreateTagsCommand,
    type CreateTagsCommandInput,
    type Tag,
} from "@aws-sdk/client-ec2";
import { AWSEC2Client } from "../../clients/ec2";

export type AWSListServersParams = {
    region: string;
    tags: Tag[];
    instance_id: string | string[];
};

export default async function ({
    tags,
    instance_id,
    region,
}: AWSListServersParams) {
    let opts: CreateTagsCommandInput = {
        Resources: Array.isArray(instance_id) ? instance_id : [instance_id],
        Tags: tags,
    };

    const EC2Client = AWSEC2Client({ region });

    const updateInstancesTagsRes = await EC2Client.send(
        new CreateTagsCommand(opts)
    );

    return { res: updateInstancesTagsRes };
}
