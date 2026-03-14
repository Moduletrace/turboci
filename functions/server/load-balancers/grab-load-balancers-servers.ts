import type {
    NormalizedServerObject,
    TCIConfig,
    TCIGlobalConfig,
} from "@/types";
import hetzner from "./hetzner";
import aws from "./aws";

type Params = {
    deployment: TCIGlobalConfig;
};

export default async function grabLoadBalancersServers({
    deployment,
}: Params): Promise<NormalizedServerObject[] | undefined> {
    switch (deployment.provider) {
        case "hetzner":
            return await hetzner({ deployment });
        case "aws":
            return await aws({ deployment });

        default:
            break;
    }

    return;
}
