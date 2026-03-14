import type { TCIGlobalConfig } from "@/types";

type HandleParams = {
    config: TCIGlobalConfig;
};

type Params = {
    handle: (params: HandleParams) => Promise<boolean>;
    configs?: TCIGlobalConfig[];
};

export default async function handleConfigs({
    handle,
    configs: passedConfigs,
}: Params) {
    const configs = passedConfigs || global.CONFIGS;

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

        isSuccess = await handle({ config });
    }

    return isSuccess;
}
