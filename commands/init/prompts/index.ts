import inquirer from "inquirer";
import {
    CloudProviders,
    type TCIConfig,
    type TCIConfigDeployment,
} from "../../../types";
import _ from "lodash";
import servicePrompt from "./service";
import grabServerLocations from "../../../functions/platforms/grab-server-locations";
import writeConfigYaml from "@/utils/write-config";

export default async function (deployments?: TCIConfigDeployment[]) {
    const configs = deployments;

    try {
        const newConfigs = await runPrompt(configs);
        return newConfigs;
    } catch (error: any) {
        console.error(`Init Prompt Error: ${error.message}`);
    }

    return undefined;
}

async function runPrompt(deployments?: TCIConfigDeployment[]) {
    let updatedDeployments: TCIConfigDeployment[] = deployments || [];

    const defaultDeploymentOptions = [
        {
            value: "--New Deployment--",
        },
        {
            value: "--Done--",
        },
    ];

    function doesDeploymentExist(answs: any): boolean {
        if (answs.new_deployment_name?.match(/./)) return true;
        if (defaultDeploymentOptions.find((d) => d.value == answs.deployment))
            return false;
        if (answs.deployment?.match(/./)) return true;
        return false;
    }

    function grabExistingDeployment(
        answers: any,
    ): TCIConfigDeployment | undefined {
        const finalDeploymentName =
            answers.new_deployment_name || answers.deployment;

        const existingDeploymentIndex = deployments?.findIndex(
            (c) => c.deployment_name == finalDeploymentName,
        );

        const existingDeployment =
            typeof existingDeploymentIndex == "number" &&
            existingDeploymentIndex >= 0
                ? deployments?.[existingDeploymentIndex]
                : undefined;

        return existingDeployment;
    }

    function grabDeployment(name: string): TCIConfigDeployment | undefined {
        return updatedDeployments.find((d) => d.deployment_name == name);
    }

    function grabDeploymentName(answs: any): string {
        return answs.new_deployment_name || answs.deployment;
    }

    const answers = await inquirer.prompt([
        {
            type: "select",
            name: "deployment",
            message: "Deployments",
            choices: () => {
                if (deployments?.length) {
                    return [
                        ...deployments.map((config) => ({
                            value: config.deployment_name,
                            description: config.description,
                        })),
                        ...defaultDeploymentOptions,
                    ];
                } else {
                    return defaultDeploymentOptions;
                }
            },
        },
        {
            type: "input",
            name: "new_deployment_name",
            message: "New Deployment Name",
            when: (answers) => {
                if (answers.deployment == defaultDeploymentOptions[0]?.value)
                    return true;
                return false;
            },
            required: true,
            validate(value) {
                if (value.match(/[^a-z\_0-9]/))
                    return "Invalid name. Allowed characters are a-z, 0-9 and _";
                return true;
            },
        },
        {
            type: "input",
            name: "description",
            message: "Deployment description",
            default: (answers: any) => {
                return grabDeployment(grabDeploymentName(answers))?.description;
            },
            when: (answers) => {
                return doesDeploymentExist(answers);
            },
        },
        {
            type: "select",
            name: "platform",
            message: "Deployment platform.",
            choices: CloudProviders.map((clp) => ({
                value: clp.value,
            })),
            default: (answers: any) => {
                return grabDeployment(grabDeploymentName(answers))?.provider;
            },
            when: (answers) => {
                return doesDeploymentExist(answers);
            },
        },
        {
            type: "select",
            name: "location",
            message: "Service Deployment Location",
            choices: async (answers) => {
                return (
                    await grabServerLocations({
                        provider: answers.platform,
                    })
                ).map((sty) => ({
                    value: sty.value,
                    name: `${sty.name} | ${sty.description}`,
                }));
            },
            default: (answers: any) => {
                const existingDeployment = grabExistingDeployment(answers);
                return existingDeployment?.location;
            },
            when: (answers) => {
                return doesDeploymentExist(answers);
            },
        },
    ]);

    switch (answers.platform) {
        case "hetzner":
            if (!process.env.TURBOCI_HETZNER_API_KEY) {
                console.error(
                    `\`TURBOCI_HETZNER_API_KEY\` env variable is missing.`,
                );
                process.exit(1);
            }
            break;
        case "aws":
            if (!process.env.TURBOCI_AWS_API_KEY) {
                console.error(
                    `\`TURBOCI_AWS_API_KEY\` env variable is missing.`,
                );
                process.exit(1);
            }
            break;
        case "gcp":
            if (!process.env.TURBOCI_GCP_API_KEY) {
                console.error(
                    `\`TURBOCI_GCP_API_KEY\` env variable is missing.`,
                );
                process.exit(1);
            }
            break;
        case "azure":
            if (!process.env.TURBOCI_AZURE_API_KEY) {
                console.error(
                    `\`TURBOCI_AZURE_API_KEY\` env variable is missing.`,
                );
                process.exit(1);
            }
            break;

        default:
            break;
    }

    const finalDeploymentName =
        answers.new_deployment_name || answers.deployment;

    const existingDeploymentIndex = deployments?.findIndex(
        (c) => c.deployment_name == finalDeploymentName,
    );

    const existingDeployment = grabExistingDeployment(answers);

    let newDeployment: TCIConfigDeployment = _.merge(existingDeployment, {
        deployment_name: finalDeploymentName,
        provider: answers.platform,
        description: answers.description,
        location: answers.location,
        services: _.merge(existingDeployment?.services, {}),
    } as TCIConfigDeployment);

    if (doesDeploymentExist(answers as any)) {
        newDeployment = await servicePrompt(newDeployment);

        if (
            existingDeployment &&
            typeof existingDeploymentIndex == "number" &&
            existingDeploymentIndex >= 0
        ) {
            updatedDeployments[existingDeploymentIndex] = newDeployment;
        } else {
            updatedDeployments.push(newDeployment);
        }
        return await runPrompt(updatedDeployments);
    }

    return updatedDeployments;
}
