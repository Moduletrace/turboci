import { Command } from "commander";
import turbociInit from "../../utils/init";
import cleanup from "./cleanup";
import chalk from "chalk";
import log from "./log";
import generalSetup from "./setup/general-setup";
import { AppNames } from "@/utils/app-names";
import type {
    CommanderDefaultOptions,
    DeploymentAndServicesToUpdate,
    TCIGlobalConfig,
} from "@/types";
import grabSSHRelayServer from "@/functions/server/ssh_relay/grab-ssh-relay-server";
import validateDeploymentSyntax from "./setup/utils/validate-deployment-syntax";
import preDeployment from "@/utils/pre-deployment";
import loadEnvs from "@/utils/load-envs";
import loadEnvFile from "@/utils/load-env-file";
import yamlReplaceEnvs from "@/utils/yaml-replace-envs";
import handleDeploymentService from "./(functions)/handle-deployment-service";
import isServiceLoadBalancerType from "./setup/utils/is-service-load-balancer-type";

function collectSkippedServices(value: string, previous: string[]) {
    return previous.concat([value]);
}

export default function () {
    return new Command("up")
        .description("Fire up stack")
        .option(
            AppNames["SkipServiceFlag"],
            "Specify services to skip",
            collectSkippedServices,
            [],
        )
        .option(
            AppNames["TargetServicesFlag"],
            "Specify services to handle",
            collectSkippedServices,
            [],
        )
        .action(async (options: CommanderDefaultOptions) => {
            console.log(chalk.white(chalk.bold(`Starting process ...`)));

            await turbociInit();

            const deployments = global.CONFIGS;

            if (!deployments) {
                console.error(`Couldn't grab deployments`);
                process.exit(1);
            }

            const deployments_and_services_to_update: DeploymentAndServicesToUpdate[] =
                [];

            for (let i = 0; i < deployments.length; i++) {
                const deployment = deployments[i];
                if (!deployment) continue;
                await validateDeploymentSyntax({ deployment });
            }

            await generalSetup();

            for (let i = 0; i < deployments.length; i++) {
                const deployment = deployments[i];

                if (!deployment) continue;

                global.CURRENT_DEPLOYMENT_INDEX = i;
                global.NEW_SERVERS = [];

                if (deployment.pre_deployment) {
                    await preDeployment({ deployment });
                }

                if (deployment.env) {
                    loadEnvs({ envs: deployment.env });
                }

                if (deployment.env_file) {
                    loadEnvFile({ file_path: deployment.env_file });
                }

                const final_deployment = JSON.parse(
                    yamlReplaceEnvs(JSON.stringify(deployment)),
                ) as TCIGlobalConfig;

                const services = final_deployment?.services;

                if (!services) continue;

                const relayServer = await grabSSHRelayServer({
                    deployment: final_deployment,
                    init: true,
                });

                console.log("=====================================");

                console.log(
                    `Handling ${chalk.green(
                        chalk.bold(final_deployment.deployment_name),
                    )} deployment ...`,
                );

                const load_balancers = services.filter((s) =>
                    isServiceLoadBalancerType({ service: s }),
                );

                deployments_and_services_to_update[i] = {
                    deployment: final_deployment,
                    services: [],
                    skipped_services: [],
                };

                for (let s = 0; s < services.length; s++) {
                    const service = services[s];
                    if (!service) continue;

                    await handleDeploymentService({
                        deployment: final_deployment,
                        deployment_index: i,
                        deployments_and_services_to_update,
                        load_balancers,
                        options,
                        service,
                        service_index: s,
                        services,
                    });

                    /**
                     * Run again if `global.RERUN_SERVICE` is
                     * set
                     */
                    if (global.RERUN_SERVICE) {
                        await handleDeploymentService({
                            deployment: final_deployment,
                            deployment_index: i,
                            deployments_and_services_to_update,
                            load_balancers,
                            options,
                            service,
                            service_index: s,
                            services,
                        });
                    }

                    delete global.ACTIVE_SERVICE_INFO[
                        final_deployment.deployment_name
                    ]?.[service.service_name];
                }
            }

            await cleanup({ deployments_and_services_to_update });
            console.log("=====================================");
            await log();

            const uptime = process.uptime();
            const uptimeInSecs = Math.floor(uptime);
            const uptimeInMins = (uptime / 60).toFixed(2);
            console.log(
                chalk.white(
                    chalk.bold(
                        `\nProcess Completed in ${uptimeInSecs.toLocaleString()} secs / ${uptimeInMins} mins\n`,
                    ),
                ),
            );

            global.ORA_SPINNER.stop();
            process.exit();
        });
}
