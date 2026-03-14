import type { ParsedDeploymentServiceConfig, TCIGlobalConfig } from "@/types";
import _ from "lodash";
import path from "path";
import parseEnv from "../parse-env";

type Params = {
    deployment: Omit<TCIGlobalConfig, "services">;
    service?: ParsedDeploymentServiceConfig;
};

export default function grabSHEnvs({ deployment, service }: Params) {
    let env: { [k: string]: string } = {};

    const deploymentEnvs = deployment.env;
    const deploymentEnvFile = deployment.env_file;

    if (deploymentEnvs) {
        env = _.merge(env, deploymentEnvs);
    }

    if (deploymentEnvFile) {
        const envFileVars = readEnvFile({ filePath: deploymentEnvFile });
        env = _.merge(env, envFileVars);
    }

    if (service) {
        const serviceEnvs = service.env;
        const serviceEnvFile = service.env_file;

        if (serviceEnvs) {
            env = _.merge(env, serviceEnvs);
        }

        if (serviceEnvFile) {
            const envFileVars = readEnvFile({ filePath: serviceEnvFile });
            env = _.merge(env, envFileVars);
        }
    }

    let envSh = ``;

    const ENV_KEYS = Object.keys(env);

    for (let i = 0; i < ENV_KEYS.length; i++) {
        const env_key = ENV_KEYS[i];
        if (!env_key) continue;
        const env_value = env[env_key];
        if (!env_value) continue;

        if (env_value.match(/\"/)) {
            console.error(`Please omit \`\"\` from all env variables`);
            process.exit(1);
        }

        envSh += `export ${env_key}="${env_value}"\n`;
    }

    envSh += `\n`;

    return envSh;
}

function readEnvFile({ filePath }: { filePath: string }):
    | {
          [k: string]: string;
      }
    | undefined {
    const finalFilePath = path.resolve(process.cwd(), filePath);

    return parseEnv(finalFilePath);
}
