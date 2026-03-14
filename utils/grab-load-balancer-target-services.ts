import type {
    ParsedDeploymentServiceConfig,
    TCIConfigServiceConfigLBTarget,
    TCIGlobalConfig,
} from "@/types";
import chalk from "chalk";
import _ from "lodash";

type Params = {
    load_balancer_service: ParsedDeploymentServiceConfig;
    deployment: TCIGlobalConfig;
};

export default function ({
    deployment,
    load_balancer_service,
}: Params): TCIConfigServiceConfigLBTarget[] | undefined {
    const all_deployment_services = deployment.services;

    const allLoadBalancerServices: TCIConfigServiceConfigLBTarget[] = [];

    if (!load_balancer_service.target_services?.[0]) {
        return undefined;
    }

    for (let i = 0; i < load_balancer_service.target_services.length; i++) {
        const lb_target_service = load_balancer_service.target_services[i];
        if (!lb_target_service) continue;

        if (
            !all_deployment_services.find(
                (s) => s.service_name == lb_target_service?.service_name
            )
        ) {
            console.error(
                `\`${chalk.bold(
                    lb_target_service?.service_name
                )}\` in \`${chalk.bold(
                    load_balancer_service.service_name
                )}\` service does not exist in \`${chalk.bold(
                    deployment.deployment_name
                )}\` deployment!`
            );
            process.exit(1);
        }

        allLoadBalancerServices.push(_.cloneDeep(lb_target_service));
    }

    return allLoadBalancerServices;
}
