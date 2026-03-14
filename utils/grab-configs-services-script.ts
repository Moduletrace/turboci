import type {
    ServiceScriptObject,
    TCIConfigServiceConfig,
    TCIGlobalConfig,
} from "@/types";

type HandleParams = {
    config: TCIGlobalConfig;
    service: TCIConfigServiceConfig;
    serviceName: string;
};

type Params = {
    handle: (
        params: HandleParams
    ) => Promise<{ sh: string; work_dir?: string }>;
};

export default async function grabConfigsServicesScript({
    handle,
}: Params): Promise<ServiceScriptObject[]> {
    const configs = global.CONFIGS;

    if (!configs) {
        console.error(`Couldn't grab configs`);
        process.exit(1);
    }

    let shArr: ServiceScriptObject[] = [];

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

            const handled = await handle({ config, service, serviceName });

            shArr.push({
                sh: handled.sh,
                service_name: serviceName,
                deployment_name: config.deployment_name,
                work_dir: handled.work_dir,
            });
        }
    }

    return shArr;
}
