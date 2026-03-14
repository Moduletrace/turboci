import setupAwsNetwork from "./functions/setup-aws-network";
import setupGcpNetwork from "./functions/setup-gcp-network";
import setupHetznerNetwork from "./functions/setup-hetzner-network";
import setupAzureNetwork from "./functions/setup-azure-network";

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

        // global.ORA_SPINNER.text = `Setting up network for \`${config.deployment_name}\` deployment ...`;
        // global.ORA_SPINNER.start();

        const provider = config.provider;

        switch (provider) {
            case "hetzner":
                isSuccess = await setupHetznerNetwork({ config });
                break;
            case "aws":
                isSuccess = await setupAwsNetwork({
                    config,
                });
                break;
            case "gcp":
                isSuccess = await setupGcpNetwork({
                    config,
                });
                break;
            case "azure":
                isSuccess = await setupAzureNetwork({
                    config,
                });
                break;

            default:
                isSuccess = false;
                break;
        }

        if (isSuccess) {
            // global.ORA_SPINNER.succeed(
            //     `Network setup for \`${config.deployment_name}\` deployment completed successfully!`
            // );
        } else {
            console.error(
                `Network setup for \`${config.deployment_name}\` failed!`
            );
            process.exit(1);
        }
    }

    return isSuccess;
}
