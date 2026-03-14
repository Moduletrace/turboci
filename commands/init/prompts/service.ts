import inquirer from "inquirer";
import { TCIServiceTypes, type TCIConfigDeployment } from "../../../types";
import _ from "lodash";
import grabServerTypes from "../../../functions/platforms/grab-server-types";
import grabServerOperatingSystemTypes from "../../../functions/platforms/grab-server-os-types";
import mapDirsPrompt from "./map-dirs";
import dependenciesPrompt from "./dependencies";
import type { HetznerImages } from "@/platforms/hetzner/types/images";
import hetznerGrabServerType from "@/platforms/hetzner/utils/grab-server-type";

export default async function servicePrompt(deployment: TCIConfigDeployment) {
    let newDeployment = _.cloneDeep(deployment);

    const defaultOptions = [
        {
            value: "--New Service--",
        },
        {
            value: "--Done--",
        },
    ];

    function doesServiceExist(answs: any): boolean {
        if (answs.new_service_name?.match(/./)) return true;
        if (defaultOptions.find((d) => d.value == answs.service)) return false;
        if (answs.service?.match(/./)) return true;
        return false;
    }

    function grabServiceName(answers: any): string {
        return answers.new_service_name || answers.service;
    }

    const answers = await inquirer.prompt([
        {
            type: "select",
            name: "service",
            message: "Services",
            choices: () => {
                return [
                    ...Object.keys(newDeployment.services).map((srv) => ({
                        value: srv,
                    })),
                    ...defaultOptions,
                ];
            },
        },
        {
            type: "input",
            name: "new_service_name",
            message: "New Service Name",
            required: true,
            validate(value) {
                if (value.match(/[^a-z\_0-9]/))
                    return "Invalid name. Allowed characters are a-z, 0-9 and _";
                return true;
            },
            when: (answers) => {
                if (answers.service == defaultOptions[1]?.value) return false;
                if (answers.service == defaultOptions[0]?.value) return true;
                return false;
            },
        },
        {
            type: "select",
            name: "service_type",
            message: "Service Type",
            choices: TCIServiceTypes.map((srvTyp) => ({
                name: srvTyp.title,
                value: srvTyp.value,
            })),
            default: (answers: any) => {
                return newDeployment.services[grabServiceName(answers)]?.type;
            },
            when: (answers) => {
                if (!doesServiceExist(answers)) return false;
                return true;
            },
        },

        {
            type: "select",
            name: "service_server_type",
            message: "Service Server Type",
            choices: async (answers) => {
                return (
                    await grabServerTypes({
                        provider: newDeployment.provider,
                        location: newDeployment.location as any,
                    })
                ).map((sty) => ({
                    value: sty.value,
                    name: `${sty.name} | ${sty.description}`,
                }));
            },
            default: async (answers: any) => {
                const passedServerType =
                    newDeployment.services[grabServiceName(answers)]
                        ?.server_type;

                const targetServerType = await hetznerGrabServerType({
                    server_type: passedServerType,
                });

                return targetServerType;
            },
            when: (answers) => {
                return doesServiceExist(answers);
            },
        },

        {
            type: "select",
            name: "service_operating_system",
            message: "Service Operating System",
            choices: async (answers) => {
                return (
                    await grabServerOperatingSystemTypes({
                        provider: newDeployment.provider,
                        server_type: answers.service_server_type,
                    })
                ).map((sty) => ({
                    value: sty.value,
                    name: `${sty.name}`,
                }));
            },
            default: (answers: any) => {
                const srv = newDeployment.services[grabServiceName(answers)];
                const finalOS = (srv?.os ||
                    "debian-11") as (typeof HetznerImages)[number]["name"];
                return finalOS;
            },
            when: (answers) => {
                return doesServiceExist(answers);
            },
        },
        {
            type: "input",
            name: "service_instances",
            message: "Instances",
            default: (answers: any) => {
                return (
                    newDeployment.services[
                        grabServiceName(answers)
                    ]?.instances?.toString() || "1"
                );
            },
            when: (answers) => {
                return doesServiceExist(answers);
            },
        },
        {
            type: "input",
            name: "env_file",
            message: "Env File",
            default: (answers: any) => {
                return newDeployment.services[grabServiceName(answers)]
                    ?.env_file;
            },
            when: (answers) => {
                return doesServiceExist(answers);
            },
        },
    ]);

    const finalNewServiceName = answers.new_service_name || answers.service;

    if (doesServiceExist(answers)) {
        // newDeployment = await envsPrompt(newDeployment, finalNewServiceName);
        newDeployment = await mapDirsPrompt(newDeployment, finalNewServiceName);
        newDeployment = await dependenciesPrompt(
            newDeployment,
            finalNewServiceName,
        );

        newDeployment.services[finalNewServiceName] = {
            ...newDeployment.services[finalNewServiceName],
            os: answers.service_operating_system,
            type: answers.service_type,
            server_type: answers.service_server_type,
            env_file: answers.env_file,
            instances: Number.isInteger(Number(answers.service_instances))
                ? Number(answers.service_instances)
                : 1,
        };

        return await servicePrompt(newDeployment);
    }

    return newDeployment;
}
