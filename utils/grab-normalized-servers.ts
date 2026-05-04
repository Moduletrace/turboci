import type {
    CloudProviders,
    NormalizedServerObject,
    ParsedDeploymentServiceConfig,
    TCIGlobalConfig,
} from "@/types";
import { _n } from "./numberfy";
import grabAWSNormalizedServers from "./grab-aws-normalized-servers";
import grabHetznerNormalizedServers from "./grab-hetzner-normalized-servers";
import grabGCPNormalizedServers from "./grab-gcp-normalized-servers";
import grabAzureNormalizedServers from "./grab-azure-normalized-servers";

type Params = {
    provider: (typeof CloudProviders)[number]["value"];
    service: ParsedDeploymentServiceConfig;
    grab_children?: boolean;
    target_deployment: TCIGlobalConfig;
};

export default async function grabNormalizedServers({
    provider,
    service,
    grab_children,
    target_deployment,
}: Params): Promise<NormalizedServerObject[] | undefined> {
    let servers: NormalizedServerObject[] = [];

    switch (provider) {
        case "hetzner":
            return await grabHetznerNormalizedServers({
                service,
                target_deployment,
                grab_children,
            });
        case "aws":
            return await grabAWSNormalizedServers({
                service,
                target_deployment,
                grab_children,
            });
        case "gcp":
            return await grabGCPNormalizedServers({
                service,
                target_deployment,
                grab_children,
            });
        case "azure":
            return await grabAzureNormalizedServers({
                service,
                target_deployment,
                grab_children,
            });

        default:
            break;
    }

    return servers;
}
