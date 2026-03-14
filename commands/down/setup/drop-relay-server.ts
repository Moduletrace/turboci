import _ from "lodash";
import type { DownSetupParams } from ".";
import dropAwsRelayServer from "./functions/drop-aws-relay-server";
import dropHetznerRelayServer from "./functions/drop-hetzner-relay-server";

export default async function (params?: DownSetupParams) {
    const configs = params?.deployments || global.CONFIGS;

    if (!configs) {
        console.error(`Couldn't grab configs`);
        process.exit(1);
    }

    let isSuccess = false;

    for (let i = 0; i < configs.length; i++) {
        const deployment = configs[i];

        if (!deployment) continue;

        switch (deployment.provider) {
            case "hetzner":
                isSuccess = await dropHetznerRelayServer({ deployment });
                break;

            case "aws":
                isSuccess = await dropAwsRelayServer({ deployment });
                break;

            default:
                isSuccess = false;
                break;
        }
    }

    return isSuccess;
}
