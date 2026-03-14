import type { TurbociControlReturn } from "@/types";
import grabActiveConfig from "@/utils/grab-active-config";
import hetzner from "./servers/hetzner";
import grabDirNames from "@/utils/grab-dir-names";

export const ControlGetQueries = ["servers", "networks"] as const;

type Params = {
    deployment_name: string;
    query: (typeof ControlGetQueries)[number];
    service_name?: string;
    relay_server_only?: boolean;
};

export default async function ({
    deployment_name,
    query,
    service_name,
    relay_server_only,
}: Params): Promise<TurbociControlReturn | undefined> {
    const activeConfig = global.ACTIVE_CONFIGS || grabActiveConfig();
    const { rootDir } = grabDirNames();

    if (!activeConfig) {
        console.error(
            `Stack is not up. Please run stack using \`turboci up\` in direvtory \`${rootDir}\``
        );
        return undefined;
    }

    const targetDeployment = activeConfig.find(
        (d) => d.deployment_name == deployment_name
    );

    if (!targetDeployment?.deployment_name) {
        console.error(`\`${deployment_name}\` deployment doesn't exist`);
        return undefined;
    }

    switch (query) {
        case "servers":
            switch (targetDeployment.provider) {
                case "hetzner":
                    return await hetzner({
                        targetDeployment,
                        service_name,
                        relay_server_only,
                    });

                default:
                    return undefined;
            }

        default:
            return undefined;
    }
}
