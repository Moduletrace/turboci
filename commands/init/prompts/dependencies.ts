import inquirer from "inquirer";
import {
    TCIServiceDependecyTypes,
    type TCIConfigDeployment,
    type TCIConfigServiceConfig,
} from "../../../types";
import _ from "lodash";

export default async function dependenciesPrompt(
    deployment: TCIConfigDeployment,
    serviceName: string,
    addDependency?: boolean,
) {
    const newDeployment = _.cloneDeep(deployment);

    const targetService = newDeployment.services[serviceName];

    let addDependencyPersistentParam = false;

    const defaultOptions = [
        {
            value: "--New Dependency--",
        },
        {
            value: "--Done--",
        },
    ];

    let existingDependencyIndex: number | undefined;

    function doesDependencyExist(answs: any): boolean {
        if (answs.dependency_type == "--Skip--") return false;
        if (answs.add_dependencies == "n") return false;
        if (answs.new_dependency?.match(/./)) {
            return true;
        }
        if (defaultOptions[0]?.value == answs.dependency) return true;
        if (defaultOptions[1]?.value == answs.dependency) return false;
        if (answs.dependency?.match(/./)) return true;
        return false;
    }

    function grabExistingDependencyIndex(dependency: string) {
        const depIndex = newDeployment.services[serviceName]?.dependencies?.[
            "apt"
        ]?.findIndex((dep) => dep == dependency);
        if (typeof depIndex == "number" && depIndex >= 0) {
            existingDependencyIndex = depIndex;
            return depIndex;
        }
        return undefined;
    }

    const answers = await inquirer.prompt([
        {
            type: "select",
            name: "add_dependencies",
            message: "Add Dependencies?",
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
                if (addDependency) return false;
                return true;
            },
        },
        {
            type: "select",
            name: "dependency_type",
            message: "Dependency Type",
            choices: [
                ...TCIServiceDependecyTypes.map((dt) => ({
                    value: dt.value,
                    name: dt.title,
                })),
                {
                    value: "--Skip--",
                },
            ],
            when: (answers) => {
                if (answers.add_dependencies == "n") return false;
                addDependencyPersistentParam = true;
                return true;
            },
        },
        {
            type: "select",
            name: "dependency",
            message: "Dependencies",
            choices: (answers) => {
                const dependencyType =
                    answers.dependency_type as (typeof TCIServiceDependecyTypes)[number]["value"];

                return [
                    ...(targetService?.dependencies?.[dependencyType]
                        ? targetService.dependencies[dependencyType].map(
                              (dep) => ({
                                  value: dep,
                              }),
                          )
                        : []),
                    ...defaultOptions,
                ];
            },
            when: (answers) => {
                if (answers.add_dependencies == "n") return false;
                if (answers.dependency_type == "--Skip--") return false;
                return true;
            },
        },
        {
            type: "input",
            name: "check_existing_dependency",
            message: "Checking existing dependency ...",
            when: (answers) => {
                grabExistingDependencyIndex(answers.dependency);
                return false;
            },
        },
        {
            type: "select",
            name: "delete_dependency",
            message: "Delete Dependency?",
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
                if (typeof existingDependencyIndex == "number") return true;
                return false;
            },
        },
        {
            type: "input",
            name: "new_dependency",
            message: "Dependency Name",
            when: (answers) => {
                if (answers.delete_dependency == "y") return false;
                return doesDependencyExist(answers);
            },
            default: (answers: any) => {
                const dependencyType =
                    answers.dependency_type as (typeof TCIServiceDependecyTypes)[number]["value"];

                if (typeof existingDependencyIndex !== "number") return;

                return newDeployment.services[serviceName]?.dependencies?.[
                    dependencyType
                ]?.[existingDependencyIndex];
            },
        },
    ]);

    if (doesDependencyExist(answers)) {
        const newDependencyType =
            answers.dependency_type as (typeof TCIServiceDependecyTypes)[number]["value"];

        let newDependencies: string[] = _.cloneDeep(
            newDeployment.services[serviceName]?.dependencies?.[
                newDependencyType
            ] || [],
        );

        if (
            answers.delete_dependency == "y" &&
            typeof existingDependencyIndex == "number"
        ) {
            newDependencies.splice(existingDependencyIndex, 1);
        } else if (typeof existingDependencyIndex == "number") {
            newDependencies[existingDependencyIndex] = answers.new_dependency;
        } else {
            newDependencies = [
                ...(newDeployment.services[serviceName]?.dependencies?.[
                    newDependencyType
                ] || []),
                answers.new_dependency,
            ];
        }

        newDeployment.services[serviceName] = {
            ...newDeployment.services[serviceName],
            dependencies: {
                ...newDeployment.services[serviceName]?.dependencies,
                [newDependencyType]: newDependencies,
            },
        } as TCIConfigServiceConfig;

        return await dependenciesPrompt(
            newDeployment,
            serviceName,
            addDependencyPersistentParam,
        );
    }

    return newDeployment;
}
