import type { DownSetupParams } from ".";
import dropAwsNetwork from "./functions/drop-aws-network";
import dropHetznerNetwork from "./functions/drop-hetzner-network";

export default async function (params?: DownSetupParams) {
    const configs = global.CONFIGS;

    if (!configs) {
        console.error(`Couldn't grab configs`);
        process.exit(1);
    }

    if (params?.service_name) {
        return true;
    }

    let isSuccess = true;

    for (let i = 0; i < configs.length; i++) {
        const config = configs[i];

        if (!config) {
            console.error(`Couldn't grab config!`);
            process.exit(1);
        }

        if (
            params?.deployment_name &&
            config.deployment_name !== params.deployment_name
        ) {
            continue;
        }

        const provider = config.provider;

        switch (provider) {
            case "hetzner":
                isSuccess = await dropHetznerNetwork({ config });
                break;
            case "aws":
                isSuccess = await dropAwsNetwork({ config });
                break;

            default:
                isSuccess = false;
                break;
        }

        if (isSuccess) {
        } else {
            console.error(
                `Network drop failed for \`${config.deployment_name}\` failed!`
            );
        }
    }

    return isSuccess;
}
