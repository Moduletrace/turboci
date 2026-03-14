import { CreateTagsCommand, type Tag } from "@aws-sdk/client-ec2";
import { AWSEC2Client } from "../../clients/ec2";

type Params = {
    region: string;
    vpc_id: string;
    new_name?: string;
};

export default async function ({ region, vpc_id, new_name }: Params) {
    const EC2Client = AWSEC2Client({ region });

    let tags: Tag[] = [];

    if (new_name) {
        tags.push({
            Key: "Name",
            Value: new_name,
        });
    }

    const updateVPCRes = await EC2Client.send(
        new CreateTagsCommand({
            Resources: [vpc_id],
            Tags: tags,
        })
    );

    return { update: updateVPCRes };
}
