import type { TCIConfigServiceConfig, TCIGlobalConfig } from "@/types";
import grabDeploymentServices from "./grab-deployment-services";

type HandleParams = {
    config: TCIGlobalConfig;
    service: TCIConfigServiceConfig;
    serviceName: string;
};

type Params = {
    handle: (params: HandleParams) => Promise<boolean>;
};

export default async function handleConfigsServices({ handle }: Params) {
    const configs = global.CONFIGS;

    if (!configs) {
        console.error(`Couldn't grab configs`);
        process.exit(1);
    }

    let isSuccess = true;

    for (let i = 0; i < configs.length; i++) {
        const config = configs[i];

        if (!config) {
            console.error(`Couldn't grab config!`);
            process.exit(1);
        }

        const services = config.services;

        for (let k = 0; k < services.length; k++) {
            const service = services[k];

            if (!service) continue;

            const serviceName = service.service_name;

            if (!service) {
                console.error(`Service ${serviceName} not found!`);
                process.exit(1);
            }

            isSuccess = await handle({ config, service, serviceName });
        }
    }

    return isSuccess;
}
