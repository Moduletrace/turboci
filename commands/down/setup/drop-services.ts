import _ from "lodash";
import dropHetznerDefaultServer from "./functions/drop-hetzner-default-server";
import type { DownSetupParams } from ".";
import dropAwsDefaultServer from "./functions/drop-aws-default-server";

export default async function (params?: DownSetupParams) {
    const configs = params?.deployments || global.CONFIGS;

    if (!configs) {
        console.error(`Couldn't grab configs`);
        process.exit(1);
    }

    let isSuccess = true;

    for (let i = 0; i < configs.length; i++) {
        const deployment = configs[i];

        if (!deployment) continue;

        if (
            params?.deployment_name &&
            deployment.deployment_name !== params.deployment_name
        ) {
            console.log(
                `Skipping deployment \`${deployment.deployment_name}\``
            );
            continue;
        }

        const provider = deployment.provider;

        const services = deployment.services;

        for (let k = 0; k < services.length; k++) {
            const service = services[k];

            if (!service) continue;

            const serviceName = service.service_name;

            if (params?.service_name && serviceName !== params.service_name) {
                continue;
            }

            if (!service) {
                console.error(`Service ${serviceName} not found!`);
                process.exit(1);
            }

            switch (provider) {
                case "hetzner":
                    isSuccess = await dropHetznerDefaultServer({
                        service,
                        deployment: _.omit(deployment, ["services"]),
                    });
                    break;
                case "aws":
                    isSuccess = await dropAwsDefaultServer({
                        service,
                        deployment: _.omit(deployment, ["services"]),
                    });
                    break;

                default:
                    isSuccess = false;
                    break;
            }
        }
    }

    return isSuccess;
}
