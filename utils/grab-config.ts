import { existsSync, readFileSync } from "fs";
import type {
    GrabConfigReturn,
    TCICommandOptions,
    TCIConfig,
    TCIGlobalConfig,
} from "../types";

import { load } from "js-yaml";
import grabDirNames from "./grab-dir-names";
import grabDeploymentServices from "./grab-deployment-services";
import _ from "lodash";
import grabLoadBalancerTargetServices from "./grab-load-balancer-target-services";
import grabAppNames from "./grab-app-names";
import grabServerInstanceName from "./grab-server-instance-name";
import AppData from "@/data/app-data";
import loadEnvs from "./load-envs";
import yamlReplaceEnvs from "./yaml-replace-envs";

type Params = {
    options: TCICommandOptions;
};

export default function grabConfig(
    params?: Params,
): GrabConfigReturn | undefined {
    const { configTS, configYAML } = grabDirNames();

    const configTSObj = (
        existsSync(configTS) ? require(configTS).default : undefined
    ) as TCIConfig | undefined;

    const configYaml = existsSync(configYAML)
        ? readFileSync(configYAML, "utf-8")
        : undefined;
    const configObj = (configYaml ? load(configYaml) : undefined) as
        | TCIConfig
        | undefined;

    const final_config = configTSObj || configObj;

    if (!final_config) {
        console.error(`Couldn't grab config`);
        process.exit(1);
    }

    const config_envs =
        typeof final_config == "object" && !Array.isArray(final_config)
            ? final_config.envs
            : undefined;

    if (config_envs) {
        loadEnvs({ envs: config_envs });
    }

    const config_deployments = Array.isArray(final_config)
        ? final_config
        : final_config?.deployments;

    const deployments = config_deployments?.sort((a, b) => {
        if (a.duplicate_deployment_name && !b.duplicate_deployment_name)
            return 1;
        if (!a.duplicate_deployment_name && b.duplicate_deployment_name)
            return -1;
        return 0;
    });

    if (!deployments) {
        console.error(`Couldn't grab deployments`);
        process.exit(1);
    }

    let parsedDeployments: TCIGlobalConfig[] = [];

    for (let i = 0; i < deployments.length; i++) {
        let deployment = deployments[i];
        if (!deployment?.deployment_name) continue;

        if (deployment.duplicate_deployment_name) {
            const duplicate_deployment = deployments.find(
                (d) =>
                    d.deployment_name == deployment?.duplicate_deployment_name,
            );

            if (duplicate_deployment) {
                const updated_deployment = _.merge(
                    duplicate_deployment,
                    deployment,
                );

                deployment = updated_deployment;
            } else {
                console.error(
                    `duplicate deployment \`${deployment.duplicate_deployment_name}\` doesn't exist in config file`,
                );
                process.exit(1);
            }

            delete deployment.pre_deployment;
        }

        const deployment_services = grabDeploymentServices({ deployment });

        const newParsedDeployment = {
            ..._.omit(deployment, ["services"]),
            services: deployment_services,
        } as TCIGlobalConfig;

        for (let s = 0; s < newParsedDeployment.services.length; s++) {
            const service = newParsedDeployment.services[s];

            const {
                appSSHKeyName,
                finalServiceName,
                loadBalancerFirewallName,
            } = grabAppNames({
                name: deployment.deployment_name,
                serviceName: service?.service_name,
                deployment,
            });

            const serviceInstanceName = grabServerInstanceName({
                index: s,
                serviceName: finalServiceName,
                platform: deployment.provider,
            });

            if (deployment.provider == "hetzner") {
                if (
                    deployment.deployment_name.length >
                    AppData["HetznerNamesMaxLength"]
                ) {
                    console.error(
                        `Deployment \`${deployment.deployment_name}\` name exceeds Hetzner's maximum character limit of \`${AppData["HetznerNamesMaxLength"]}\`.`,
                    );
                    process.exit(1);
                }

                if (
                    serviceInstanceName.length >
                    AppData["HetznerNamesMaxLength"]
                ) {
                    console.error(
                        `Hetzner has a maximum of \`${AppData["HetznerNamesMaxLength"]}\` characters for names. This means the combination of your deployment name and service name exceeds this length. Please trim these names.`,
                    );
                    process.exit(1);
                }
            }

            if (service?.type == "load_balancer") {
                const service_targets = grabLoadBalancerTargetServices({
                    deployment: newParsedDeployment,
                    load_balancer_service: service,
                });

                let newService = { ...service };
                newService.target_services = service_targets;

                newParsedDeployment.services[s] = newService;
            }
        }

        newParsedDeployment.services = deployment_services;

        parsedDeployments.push(_.cloneDeep(newParsedDeployment));
    }

    return { deployments: parsedDeployments };
}
