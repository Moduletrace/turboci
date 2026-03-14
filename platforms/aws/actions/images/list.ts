import {
    ArchitectureType,
    DescribeImagesCommand,
    type DescribeImagesCommandInput,
    type Image,
} from "@aws-sdk/client-ec2";
import { AWSEC2Client } from "../../clients/ec2";

const OwnersTypes = ["self", "aws-marketplace"] as const;

type Params = {
    region: string;
    owners?: (typeof OwnersTypes)[number][];
    names?: string[];
    architectures?: ArchitectureType[];
};

export default async function ({
    region,
    owners,
    names,
    architectures,
}: Params) {
    const EC2Client = AWSEC2Client({ region });

    const images: Image[] = [];
    let nextToken: string | undefined;

    let opts: DescribeImagesCommandInput = {
        Owners: ["amazon", ...(owners || [])],
        Filters: [
            {
                Name: "state",
                Values: ["available"],
            },
        ],
    };

    if (names) {
        opts.Filters?.push({
            Name: "name",
            Values: names.map((n) => `*${n.toLowerCase()}*`),
        });
    }

    if (architectures) {
        opts.Filters?.push({
            Name: "architecture",
            Values: architectures,
        });
    }

    do {
        const imagesRes = await EC2Client.send(new DescribeImagesCommand(opts));

        imagesRes.Images?.forEach((img) => {
            images.push(img);
        });

        nextToken = imagesRes.NextToken;
    } while (nextToken);

    return { images, options: opts };
}
