import _ from "lodash";
import prepareDefault from "./functions/prepare-default";
import grabNormalizedServers from "@/utils/grab-normalized-servers";
import type { DefaultDeploymentParams, ResponseObject } from "@/types";
import prepareGit from "./functions/prepare-git";

export default async function ({
    deployment,
    service,
}: DefaultDeploymentParams): Promise<ResponseObject> {
    const configs = global.CONFIGS;

    if (!configs) {
        console.error(`Couldn't grab configs`);
        process.exit(1);
    }

    const provider = deployment.provider;

    const finalInstances =
        typeof service.instances == "number" ? service.instances : 1;

    const servers = await grabNormalizedServers({
        provider,
        instances: finalInstances,
        service,
        target_deployment: deployment,
    });

    if (!servers?.[0]) {
        return {
            success: true,
        };
    }

    for (let i = 0; i < servers.length; i++) {
        const server = servers[i];

        if (!server) continue;

        const configServers =
            global.CONFIGS?.[global.CURRENT_DEPLOYMENT_INDEX]?.services[
                global.CURRENT_SERVICE_INDEX
            ]?.servers;

        if (configServers) {
            global.CONFIGS?.[global.CURRENT_DEPLOYMENT_INDEX]?.services[
                global.CURRENT_SERVICE_INDEX
            ]?.servers?.push(server);
        } else {
            global.CONFIGS![global.CURRENT_DEPLOYMENT_INDEX]!.services[
                global.CURRENT_SERVICE_INDEX
            ]!.servers = [server];
        }
    }

    const prepare_default_res = await prepareDefault({
        servers,
        deployment,
        service,
    });

    if (!prepare_default_res.success) {
        console.error(
            `Server Preparation for \`${deployment.deployment_name}\` failed!${prepare_default_res.msg ? ` ${prepare_default_res.msg}` : ""}`,
        );
        process.exit(1);
    }

    const prepare_git_res = await prepareGit({
        servers,
        deployment,
        service,
    });

    return {
        success: true,
    };
}
