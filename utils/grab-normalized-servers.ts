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
    instances?: number;
    clusters?: number;
    grab_children?: boolean;
    target_deployment: TCIGlobalConfig;
};

export default async function grabNormalizedServers({
    provider,
    service,
    instances,
    clusters,
    grab_children,
    target_deployment,
}: Params): Promise<NormalizedServerObject[] | undefined> {
    let servers: NormalizedServerObject[] = [];

    if (!_n(instances)) {
        return undefined;
    }

    switch (provider) {
        case "hetzner":
            return await grabHetznerNormalizedServers({
                service,
                target_deployment,
                grab_children,
                instances,
            });
        case "aws":
            return await grabAWSNormalizedServers({
                service,
                target_deployment,
                grab_children,
                instances,
            });
        case "gcp":
            return await grabGCPNormalizedServers({
                service,
                target_deployment,
                grab_children,
                instances,
            });
        case "azure":
            return await grabAzureNormalizedServers({
                service,
                target_deployment,
                grab_children,
                instances,
            });

        default:
            break;
    }

    return servers;
}
