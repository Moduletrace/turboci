import type { TCIGlobalConfig } from "@/types";
import { AppNames } from "@/utils/app-names";

type Params = {
    deployment: TCIGlobalConfig;
};

export default async function validateDeploymentSyntax({ deployment }: Params) {
    /**
     * # AWS Checks
     */
    if (
        deployment.provider == "aws" &&
        (!process.env[AppNames["AWSAccessKeyEnvName"]] ||
            !process.env[AppNames["AWSSecretAccessKeyEnvName"]])
    ) {
        console.error(
            `AWS deployments require \`${AppNames["AWSAccessKeyEnvName"]}\` and \`${AppNames["AWSSecretAccessKeyEnvName"]}\` environment variables.`
        );
        process.exit(1);
    }

    if (deployment.provider == "aws" && !deployment.availability_zone) {
        console.error(
            `AWS deployments need an availability zone. Example \`us-east-1a\``
        );
        process.exit(1);
    }

    /**
     * # Hetzner Checks
     */
    if (
        deployment.provider == "hetzner" &&
        !process.env[AppNames["HetznerAPIKeyEnvName"]]
    ) {
        console.error(
            `Hetzner deployments require \`${AppNames["HetznerAPIKeyEnvName"]}\` environment variable.`
        );
        process.exit(1);
    }

    /**
     * # GCP Checks
     */
    if (
        deployment.provider == "gcp" &&
        (!process.env[AppNames["GCPServiceAccountEmail"]] ||
            !process.env[AppNames["GCPServiceAccountPrivateKey"]] ||
            !process.env[AppNames["GCPProjectID"]])
    ) {
        console.error(
            `GCP deployments require \`${AppNames["GCPServiceAccountEmail"]}\` and \`${AppNames["GCPServiceAccountPrivateKey"]}\` and \`${AppNames["GCPProjectID"]}\` environment variables.`
        );
        process.exit(1);
    }
}
