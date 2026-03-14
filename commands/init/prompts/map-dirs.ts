import inquirer from "inquirer";
import {
    type TCIConfigDeployment,
    type TCIConfigServiceConfig,
} from "../../../types";
import _ from "lodash";

export default async function mapDirsPrompt(
    deployment: TCIConfigDeployment,
    serviceName: string,
) {
    const newDeployment = _.cloneDeep(deployment);

    const targetService = newDeployment.services[serviceName];

    const defaultOptions = [
        {
            value: "--New Dir Mapping--",
        },
        {
            value: "--Done--",
        },
    ];

    let existingDirMappingIndex: number | undefined;

    function doesMappingExist(answs: any): boolean {
        if (answs.src?.match(/./) || answs.dst?.match(/./)) {
            return true;
        }
        if (defaultOptions[0]?.value == answs.dir_mapping) return true;
        if (defaultOptions[1]?.value == answs.dir_mapping) return false;
        if (answs.dir_mapping?.match(/./)) return true;
        return false;
    }

    function grabExistingMappingIndex(dir_mapping: string) {
        const srcDirArr = dir_mapping.split(` => `);
        const dirMapIndex = newDeployment.services[
            serviceName
        ]?.dir_mappings?.findIndex(
            (m) => m.src == srcDirArr[0] && m.dst == srcDirArr[1],
        );
        if (typeof dirMapIndex == "number" && dirMapIndex >= 0) {
            existingDirMappingIndex = dirMapIndex;
            return dirMapIndex;
        }
        return undefined;
    }

    const answers = await inquirer.prompt([
        {
            type: "select",
            name: "dir_mapping",
            message: "Directory Mappings",
            choices: () => {
                return [
                    ...(targetService?.dir_mappings
                        ? targetService.dir_mappings.map((dirMap) => ({
                              value: `${dirMap.src} => ${dirMap.dst}`,
                          }))
                        : []),
                    ...defaultOptions,
                ];
            },
        },
        {
            type: "input",
            name: "check_existing_mapping",
            message: "Delete Mapping?",
            when: (answers) => {
                grabExistingMappingIndex(answers.dir_mapping);
                return false;
            },
        },
        {
            type: "select",
            name: "delete_mapping",
            message: "Delete Mapping?",
            choices: [
                {
                    value: "n",
                    name: "No",
                },
                {
                    value: "y",
                    name: "Yes",
                },
            ],
            when: (answers) => {
                if (typeof existingDirMappingIndex == "number") return true;
                return false;
            },
        },
        {
            type: "input",
            name: "src",
            message: "Source Directory",
            required: true,
            when: (answers) => {
                if (answers.delete_mapping == "y") return false;
                return doesMappingExist(answers);
            },
            default: (answers: any) => {
                const mapIndex = grabExistingMappingIndex(answers.dir_mapping);
                if (typeof mapIndex !== "number") return;
                return newDeployment.services[serviceName]?.dir_mappings?.[
                    mapIndex
                ]?.src;
            },
        },
        {
            type: "input",
            name: "dst",
            message: "Destination Directory",
            required: true,
            when: (answers) => {
                if (answers.delete_mapping == "y") return false;
                return doesMappingExist(answers);
            },
            default: (answers: any) => {
                const mapIndex = grabExistingMappingIndex(answers.dir_mapping);
                if (typeof mapIndex !== "number") return;
                return newDeployment.services[serviceName]?.dir_mappings?.[
                    mapIndex
                ]?.dst;
            },
        },
    ]);

    if (doesMappingExist(answers)) {
        let newMappings = _.cloneDeep(
            newDeployment.services[serviceName]?.dir_mappings || [],
        );

        if (
            answers.delete_mapping == "y" &&
            typeof existingDirMappingIndex == "number"
        ) {
            newMappings.splice(existingDirMappingIndex, 1);
        } else if (typeof existingDirMappingIndex == "number") {
            newMappings[existingDirMappingIndex] = {
                src: answers.src,
                dst: answers.dst,
            };
        } else {
            newMappings = [
                ...(newDeployment.services[serviceName]?.dir_mappings || []),
                { src: answers.src, dst: answers.dst },
            ];
        }

        newDeployment.services[serviceName] = {
            ...newDeployment.services[serviceName],
            dir_mappings: newMappings,
        } as TCIConfigServiceConfig;

        return await mapDirsPrompt(newDeployment, serviceName);
    }

    return newDeployment;
}
