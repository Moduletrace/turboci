import inquirer from "inquirer";
import _ from "lodash";
import grabActiveConfig from "@/utils/grab-active-config";
import { ControlGetQueries } from "@/functions/get";
import turboci from "@/index";
import type { TurbociControlServer } from "@/types";
import chalk from "chalk";

const Actions = ["get", "exec", "terminal"] as const;

export default async function () {
    const deployments = grabActiveConfig();

    if (!deployments?.[0]) {
        console.error(
            `No Active Deployments. Run a deployment using \`turboci up\``
        );
        process.exit(1);
    }

    function grabDeployment(deployment_name: string) {
        const deployment = deployments?.find(
            (d) => d.deployment_name == deployment_name
        );

        if (!deployment) {
            console.error(`Deployment \`${deployment_name}\` not found!`);
            process.exit(1);
        }

        return deployment;
    }

    let allServers: TurbociControlServer[] | undefined;

    try {
        const answers = await inquirer.prompt([
            {
                type: "select",
                name: "deployment_name",
                message: "Select a deployment",
                choices: () => {
                    return [
                        ...deployments.map((config) => ({
                            value: config.deployment_name,
                        })),
                    ];
                },
            },
            {
                type: "select",
                name: "action",
                message: "Select an action",
                choices: () => {
                    return [
                        ...Actions.map((action) => ({
                            value: action,
                        })),
                    ];
                },
                default: "get",
            },
            {
                type: "select",
                name: "service_name",
                message(answs) {
                    if (answs.action == "get") {
                        return "Select an service (optional)";
                    }
                    return "Select an service";
                },
                choices(answs) {
                    const deployment = grabDeployment(answs.deployment_name);

                    const opts = deployment.services.map((srv) => ({
                        value: srv.service_name,
                    }));

                    if (answs.action == "get") {
                        return [{ value: "--No-Service--" }, ...opts];
                    }
                    return [
                        { value: "__relay", name: "Relay Server" },
                        ...opts,
                    ];
                },
            },
            {
                type: "select",
                name: "get_action",
                message: "What to get?",
                choices(answs) {
                    return [
                        ...ControlGetQueries.map((q) => ({
                            value: q,
                        })),
                    ];
                },
                when(answs) {
                    if (answs.action == "get") return true;
                    return false;
                },
            },
            {
                type: "select",
                name: "server",
                message(answs) {
                    if (answs.action == "get") {
                        return "Select servers (optional)";
                    }
                    return "Select servers";
                },
                async choices(answs) {
                    const serversRes = await turboci.get({
                        query: "servers",
                        deployment_name: answs.deployment_name,
                        service_name:
                            answs.service_name == "--No-Service--" ||
                            answs.service_name == "__relay"
                                ? undefined
                                : answs.service_name,
                        relay_server_only: answs.service_name == "__relay",
                    });

                    if (serversRes?.servers) {
                        allServers = serversRes.servers;

                        const opts = serversRes.servers.map((srv) => {
                            let srvDesc =
                                srv.service_name == "__relay"
                                    ? `Relay Server`
                                    : `service_name: ${srv.service_name}`;
                            let srvValue = `${srv.private_ip}`;

                            if (srv.public_ip) {
                                srvDesc += ` | public_ip: ${srv.public_ip}`;
                                // srvValue += ` | public_ip: ${srv.public_ip}`;
                            }

                            return {
                                value: srvValue,
                                description: srvDesc,
                            };
                        });

                        if (answs.service_name == "__relay") {
                            return opts;
                        }

                        return [{ value: "--All-Servers--" }, ...opts];
                    }

                    console.error(`No Server Found!`);
                    process.exit(1);
                },
                when(answs) {
                    // if (answs.service_name == "__relay") return false;
                    if (answs.get_action == "servers") return true;
                    if (answs.action == "exec") return true;
                    if (answs.action == "terminal") return true;
                    return false;
                },
            },
            {
                type: "input",
                name: "exec_cmd",
                message: "Enter Command to execute",
                when(answs) {
                    if (answs.action == "exec") return true;
                    return false;
                },
            },
        ]);

        console.log(answers);

        if (answers.action == "terminal" && answers.server) {
            const targetServer = allServers?.find(
                (s) => s.private_ip == answers.server
            );

            if (targetServer) {
                const execRes = await turboci.terminal({
                    server: targetServer,
                });
            }
        }

        if (answers.action == "exec" && answers.exec_cmd) {
            const targetServer =
                answers.server == "--All-Servers--"
                    ? allServers
                    : allServers?.find((s) => s.private_ip == answers.server);

            if (!targetServer) {
                console.error(`No target Server(s) Found for exec!`);
                process.exit(1);
            }

            global.ORA_SPINNER.text = `Executing Command on ${
                Array.isArray(targetServer)
                    ? targetServer.map((s) => s.private_ip).join(",")
                    : targetServer.private_ip
            } ...`;
            global.ORA_SPINNER.start();

            try {
                const execRes = await turboci.exec({
                    cmd: `${answers.exec_cmd}`,
                    deployment_name: answers.deployment_name,
                    server: targetServer,
                    relay_server: answers.service_name == "__relay",
                });

                global.ORA_SPINNER.stop();

                console.log("\n\n");
                console.log(`${chalk.bold(chalk.white(`Exec Result:`))}\n`);
                console.log(
                    `${chalk.bold(
                        chalk.white(
                            `========================================================`
                        )
                    )}\n`
                );
                console.log(execRes);
                console.log(
                    `\n${chalk.bold(
                        chalk.white(
                            `========================================================`
                        )
                    )}\n`
                );
            } catch (error) {
                global.ORA_SPINNER.fail("Exec Command Failed!");
                global.ORA_SPINNER.stop();
            }
        }
    } catch (error: any) {
        console.error(`Init Prompt Error: ${error.message}`);
    }

    return undefined;
}
