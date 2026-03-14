import { AppNames } from "@/utils/app-names";
import { EC2Client } from "@aws-sdk/client-ec2";

type AWSEC2ClientParams = {
    region: string;
};

export function AWSEC2Client({ region }: AWSEC2ClientParams) {
    const client = new EC2Client({
        region,
        credentials: {
            accessKeyId: process.env[AppNames["AWSAccessKeyEnvName"]] || "",
            secretAccessKey:
                process.env[AppNames["AWSSecretAccessKeyEnvName"]] || "",
        },
    });

    return client;
}
