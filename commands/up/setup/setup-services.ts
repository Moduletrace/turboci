import _ from "lodash";
import setupHetznerServer from "./functions/setup-hetzner-server";
import type { DefaultDeploymentParams } from "@/types";
import setupAwsServer from "./functions/setup-aws-server";
import setupGcpServer from "./functions/setup-gcp-server";
import setupAzureServer from "./functions/setup-azure-server";

export default async function ({
    deployment,
    service,
}: DefaultDeploymentParams) {
    const configs = global.CONFIGS;

    if (!configs) {
        console.error(`Couldn't grab configs`);
        process.exit(1);
    }

    let isSuccess = true;
    const provider = deployment.provider;

    switch (provider) {
        case "hetzner":
            isSuccess = await setupHetznerServer({
                service,
                deployment,
            });
            break;
        case "aws":
            isSuccess = await setupAwsServer({
                service,
                deployment,
            });
            break;
        case "gcp":
            isSuccess = await setupGcpServer({
                service,
                deployment,
            });
            break;
        case "azure":
            isSuccess = await setupAzureServer({
                service,
                deployment,
            });
            break;

        default:
            isSuccess = false;
            break;
    }

    return isSuccess;
}
