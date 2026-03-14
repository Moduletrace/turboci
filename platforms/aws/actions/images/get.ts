import { DescribeImagesCommand } from "@aws-sdk/client-ec2";
import { AWSEC2Client } from "../../clients/ec2";

type Params = {
    region: string;
    ami: string;
};

export default async function ({ region, ami }: Params) {
    const EC2Client = AWSEC2Client({ region });

    const { Images } = await EC2Client.send(
        new DescribeImagesCommand({
            ImageIds: [ami],
        })
    );

    return { image: Images?.[0] };
}
