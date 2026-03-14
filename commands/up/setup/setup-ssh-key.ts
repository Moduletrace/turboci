import setupAwsSshKey from "./functions/setup-aws-ssh-key";
import setupHetznerSSHKey from "./functions/setup-hetzner-ssh-key";
import setupGcpSshKey from "./functions/setup-gcp-ssh-key";
import setupAzureSshKey from "./functions/setup-azure-ssh-key";

export default async function () {
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

        const provider = config.provider;

        switch (provider) {
            case "hetzner":
                isSuccess = await setupHetznerSSHKey({ config });
                break;
            case "aws":
                isSuccess = await setupAwsSshKey({ config });
                break;
            case "gcp":
                isSuccess = await setupGcpSshKey({ config });
                break;
            case "azure":
                isSuccess = await setupAzureSshKey({ config });
                break;

            default:
                isSuccess = false;
                break;
        }

        if (!isSuccess) {
            console.error(
                `SSH Key setup for \`${config.deployment_name}\` failed!`,
            );
            process.exit(1);
        }
    }

    return isSuccess;
}
