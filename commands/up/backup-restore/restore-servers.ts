import _ from "lodash";
import type { DefaultDeploymentParams, ResponseObject } from "@/types";
import restoreMariaDBGalera from "./restore-mariadb-galera";

export default async function ({
    deployment,
    service,
}: DefaultDeploymentParams): Promise<ResponseObject> {
    const configs = global.CONFIGS;

    if (!configs) {
        console.error(`Couldn't grab configs`);
        process.exit(1);
    }

    if (service.type == "mariadb-galera") {
        const was_server_deleted =
            global.ACTIVE_SERVICE_INFO[deployment.deployment_name]?.[
                service.service_name
            ]?.service_deleted;

        if (was_server_deleted) {
            await restoreMariaDBGalera({ deployment, service });
        }
    }

    return {
        success: true,
    };
}
