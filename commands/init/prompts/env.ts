// import inquirer from "inquirer";
// import { type TCIConfig, type TCIConfigServiceConfig } from "../../../types";
// import _ from "lodash";

// export default async function envsPrompt(
//     deployment: TCIConfig,
//     serviceName: string
// ) {
//     const newDeployment = _.cloneDeep(deployment);

//     const targetService = newDeployment.services[serviceName];

//     const defaultOptions = [
//         {
//             value: "--New Environment Variable--",
//         },
//         {
//             value: "--Done--",
//         },
//     ];

//     function doesEnvExist(answs: any): boolean {
//         if (answs.new_env?.match(/./)) {
//             return true;
//         }
//         if (defaultOptions[0]?.value == answs.env) return true;
//         if (defaultOptions[1]?.value == answs.env) return false;
//         if (answs.env?.match(/./)) return true;
//         return false;
//     }

//     const answers = await inquirer.prompt([
//         {
//             type: "select",
//             name: "env",
//             message: "Environment Variables",
//             choices: () => {
//                 return [
//                     ...(targetService?.env
//                         ? Object.keys(targetService.env).map((key) => ({
//                               value: `${key}=${targetService.env?.[key]}`,
//                           }))
//                         : []),
//                     ...defaultOptions,
//                 ];
//             },
//         },
//         {
//             type: "input",
//             name: "check_existing_env",
//             message: "Checking existing environment variable ...",
//             when: (answers) => {
//                 return false;
//             },
//         },
//         {
//             type: "select",
//             name: "delete_env",
//             message: "Delete Env Variable?",
//             choices: [
//                 {
//                     value: "n",
//                     name: "No",
//                 },
//                 {
//                     value: "y",
//                     name: "Yes",
//                 },
//             ],
//             when: (answers) => {
//                 const existingEnv = targetService?.env;
//                 if (existingEnv) return true;
//                 return false;
//             },
//         },
//         {
//             type: "input",
//             name: "new_env",
//             message: "Environment Variable",
//             when: (answers) => {
//                 return doesEnvExist(answers);
//             },
//             default: (answers: any) => {
//                 if (typeof existingEnvIndex !== "number") return;
//                 return newDeployment.services[serviceName]?.env?.[
//                     existingEnvIndex
//                 ];
//             },
//         },
//     ]);

//     if (doesEnvExist(answers)) {
//         let newEnvVariables: string[] = _.cloneDeep(
//             newDeployment.services[serviceName]?.env || []
//         );

//         if (answers.delete_env == "y" && typeof existingEnvIndex == "number") {
//             newEnvVariables.splice(existingEnvIndex, 1);
//         } else if (typeof existingEnvIndex == "number") {
//             newEnvVariables[existingEnvIndex] = answers.new_env;
//         } else {
//             newEnvVariables = [
//                 ...(newDeployment.services[serviceName]?.env || []),
//                 answers.new_env,
//             ];
//         }

//         newDeployment.services[serviceName] = {
//             ...newDeployment.services[serviceName],
//             env: newEnvVariables,
//         } as TCIConfigServiceConfig;

//         return await envsPrompt(newDeployment, serviceName);
//     }

//     return newDeployment;
// }
