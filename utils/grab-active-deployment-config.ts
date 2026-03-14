import type { ParsedDeploymentServiceConfig, TCIGlobalConfig } from "@/types";

type Params = {
    deployment: TCIGlobalConfig;
    service?: ParsedDeploymentServiceConfig;
};

type Return = {
    active_deployment?: TCIGlobalConfig;
    active_service?: ParsedDeploymentServiceConfig;
};

export default function ({ deployment, service }: Params): Return {
    const active_deployment = global.ACTIVE_CONFIGS?.find(
        (c) => c.deployment_name == deployment.deployment_name
    );

    if (service && active_deployment) {
        const active_service = active_deployment.services.find(
            (s) => s.service_name == service.service_name
        );

        return { active_deployment, active_service };
    }

    return { active_deployment };
}
