import setupAwsFirewalls from "./functions/setup-aws-firewalls";
import setupHetznerFirewalls from "./functions/setup-hetzner-firewalls";
import setupGcpFirewalls from "./functions/setup-gcp-firewalls";
import setupAzureFirewalls from "./functions/setup-azure-firewalls";

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
                isSuccess = await setupHetznerFirewalls({ config });
                break;
            case "aws":
                isSuccess = await setupAwsFirewalls({ config });
                break;
            case "gcp":
                isSuccess = await setupGcpFirewalls({ config });
                break;
            case "azure":
                isSuccess = await setupAzureFirewalls({ config });
                break;

            default:
                isSuccess = false;
                break;
        }

        if (isSuccess) {
        } else {
            console.error(`Firewalls setup failed!`);
            process.exit(1);
        }
    }

    return isSuccess;
}
