import type {
    CommanderDefaultOptions,
    DeploymentAndServicesToUpdate,
    ParsedDeploymentServiceConfig,
    TCIGlobalConfig,
} from "@/types";
import checkSkippedService from "@/utils/check-skipped-service";
import chalk from "chalk";
import setup from "../setup";
import prepare from "../prepare";
import run from "../run";
import updateLoadBalancersAfterServiceChange from "../update-load-balancers-after-service-change";
import isServiceLoadBalancerType from "../setup/utils/is-service-load-balancer-type";

type Params = {
    service: ParsedDeploymentServiceConfig;
    deployment: TCIGlobalConfig;
    deployments_and_services_to_update: DeploymentAndServicesToUpdate[];
    deployment_index: number;
    service_index: number;
    options: CommanderDefaultOptions;
    load_balancers: ParsedDeploymentServiceConfig[];
    services: ParsedDeploymentServiceConfig[];
};

export default async function handleDeploymentService({
    service,
    deployment,
    deployments_and_services_to_update,
    deployment_index,
    options,
    load_balancers,
    service_index,
    services,
}: Params) {
    const is_service_skipped = checkSkippedService({
        deployment,
        service,
        options,
    });

    if (is_service_skipped) {
        deployments_and_services_to_update[
            deployment_index
        ]?.skipped_services.push(service);
        return;
    }

    console.log(chalk.grey("-------------------------------------"));

    console.log(
        `|- Handling ${chalk.white(
            chalk.italic(chalk.bold(service.service_name)),
        )} service ...`,
    );

    global.CURRENT_SERVICE_INDEX = service_index;

    await setup({ deployment, service });
    await prepare({ deployment, service });
    await run({ deployment, service });

    const nextService = services[service_index + 1];
    const isNextServiceLoadBalancer =
        nextService && isServiceLoadBalancerType({ service: nextService });

    if (
        load_balancers?.[0] &&
        !isServiceLoadBalancerType({ service }) &&
        !isNextServiceLoadBalancer &&
        global.UPDATE_LOAD_BALANCERS
        // &&
        // !global.UPDATED_LOAD_BALANCERS[
        //     deployment.deployment_name
        // ]
    ) {
        const isServiceAttachedToALoadBalancer = load_balancers.find((lb) => {
            const targets =
                lb.type === "haproxy"
                    ? lb.haproxy?.target_services
                    : lb.type === "proxysql"
                      ? lb.proxysql?.target_services
                      : lb.type === "maxscale"
                        ? lb.maxscale?.target_services
                        : lb.target_services;
            return Boolean(
                targets?.find(
                    (trgSrv) => trgSrv.service_name === service.service_name,
                ),
            );
        });

        if (!isServiceAttachedToALoadBalancer) {
            global.UPDATE_LOAD_BALANCERS = false;
            return;
        }

        await updateLoadBalancersAfterServiceChange({
            deployment,
            load_balancers,
            service,
            services,
        });

        global.UPDATE_LOAD_BALANCERS = false;
        global.UPDATED_LOAD_BALANCERS[deployment.deployment_name] = true;
    }
}
