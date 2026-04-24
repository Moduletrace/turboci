import setupHetznerVolumes from "./functions/setup-hetzner-volumes";

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
                isSuccess = await setupHetznerVolumes({ config });
                break;
            case "aws":
                break;
            case "gcp":
                break;
            case "azure":
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
