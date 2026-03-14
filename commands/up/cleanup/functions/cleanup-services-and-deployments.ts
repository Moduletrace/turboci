import pullDownDeployment from "@/commands/down/setup";
import type { TCIConfig, TCIGlobalConfig } from "@/types";

type Params = {
    deployment_name: string;
    deployments: TCIGlobalConfig[];
    service_name?: string;
};

export default async function ({
    deployment_name,
    service_name,
    deployments,
}: Params) {
    if (deployment_name && service_name) {
        await pullDownDeployment({
            deployment_name,
            service_name,
            deployments,
        });

        return true;
    } else {
        await pullDownDeployment({
            deployment_name,
            deployments,
        });

        return true;
    }
}
