import type { DownSetupParams } from ".";
import dropAwsSshKey from "./functions/drop-aws-ssh-key";
import dropHetznerSSHKey from "./functions/drop-hetzner-ssh-key";

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
                isSuccess = await dropHetznerSSHKey({ config });
                break;
            case "aws":
                isSuccess = await dropAwsSshKey({ config });
                break;

            default:
                isSuccess = false;
                break;
        }

        if (isSuccess) {
        } else {
            console.error(
                `SSH Key dropped \`${config.deployment_name}\` failed!`
            );
            process.exit(1);
        }
    }

    return isSuccess;
}
