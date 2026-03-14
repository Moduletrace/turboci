import { Command } from "commander";
import setup from "./setup";
import turbociInit from "../../utils/init";
import prepare from "./prepare";
import cleanup from "./cleanup";
import run from "./run";
import chalk from "chalk";
import log from "./log";
import generalSetup from "./setup/general-setup";
import updateLoadBalancersAfterServiceChange from "./update-load-balancers-after-service-change";
import { AppNames } from "@/utils/app-names";
import type {
    CommanderDefaultOptions,
    DeploymentAndServicesToUpdate,
} from "@/types";
import checkSkippedService from "@/utils/check-skipped-service";
import grabSSHRelayServer from "@/functions/server/ssh_relay/grab-ssh-relay-server";
import validateDeploymentSyntax from "./setup/utils/validate-deployment-syntax";
import preDeployment from "@/utils/pre-deployment";

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
                const services = deployment?.services;

                if (!deployment || !services) continue;

                global.CURRENT_DEPLOYMENT_INDEX = i;
                global.NEW_SERVERS = [];

                if (deployment.pre_deployment) {
                    await preDeployment({ deployment });
                }

                const relayServer = await grabSSHRelayServer({
                    deployment,
                    init: true,
                });

                console.log("=====================================");

                console.log(
                    `Handling ${chalk.green(
                        chalk.bold(deployment.deployment_name),
                    )} deployment ...`,
                );

                const load_balancers = services.filter(
                    (s) => s.type == "load_balancer",
                );

                deployments_and_services_to_update[i] = {
                    deployment,
                    services: [],
                    skipped_services: [],
                };

                for (let s = 0; s < services.length; s++) {
                    const service = services[s];
                    if (!service) continue;

                    const is_service_skipped = checkSkippedService({
                        deployment,
                        service,
                        options,
                    });

                    if (is_service_skipped) {
                        deployments_and_services_to_update[
                            i
                        ]?.skipped_services.push(service);
                        continue;
                    }

                    console.log(
                        chalk.grey("-------------------------------------"),
                    );

                    console.log(
                        `|- Handling ${chalk.white(
                            chalk.italic(chalk.bold(service.service_name)),
                        )} service ...`,
                    );

                    global.CURRENT_SERVICE_INDEX = s;

                    await setup({ deployment, service });
                    await prepare({ deployment, service });
                    await run({ deployment, service });

                    const nextService = services[s + 1];
                    const isNextServiceLoadBalancer =
                        nextService && nextService.type == "load_balancer";

                    if (
                        load_balancers?.[0] &&
                        service.type !== "load_balancer" &&
                        !isNextServiceLoadBalancer &&
                        global.UPDATE_LOAD_BALANCERS
                        // &&
                        // !global.UPDATED_LOAD_BALANCERS[
                        //     deployment.deployment_name
                        // ]
                    ) {
                        const isServiceAttachedToALoadBalancer =
                            load_balancers.find((lb) =>
                                Boolean(
                                    lb.target_services?.find(
                                        (trgSrv) =>
                                            trgSrv.service_name ==
                                            service.service_name,
                                    ),
                                ),
                            );

                        if (!isServiceAttachedToALoadBalancer) {
                            global.UPDATE_LOAD_BALANCERS = false;
                            continue;
                        }

                        await updateLoadBalancersAfterServiceChange({
                            deployment,
                            load_balancers,
                            service,
                            services,
                        });

                        global.UPDATE_LOAD_BALANCERS = false;
                        global.UPDATED_LOAD_BALANCERS[
                            deployment.deployment_name
                        ] = true;
                    }
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
