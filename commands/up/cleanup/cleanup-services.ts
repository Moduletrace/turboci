import grabActiveConfig from "@/utils/grab-active-config";
import cleanupServicesAndDeployments from "./functions/cleanup-services-and-deployments";
import _ from "lodash";

export default async function () {
    const currentConfigs = global.CONFIGS;
    const previousConfigs = grabActiveConfig();

    if (!currentConfigs || !previousConfigs) {
        return true;
    }

    for (let i = 0; i < previousConfigs.length; i++) {
        const prevConf = previousConfigs[i];
        if (!prevConf) continue;

        const currentConf = currentConfigs.find(
            (cnf) => cnf.deployment_name == prevConf.deployment_name
        );

        if (!currentConf?.deployment_name) {
            console.log(`Dropping Deployment \`${prevConf.deployment_name}\``);

            await cleanupServicesAndDeployments({
                deployment_name: prevConf.deployment_name,
                deployments: previousConfigs,
            });
            continue;
        }

        const services = prevConf.services;

        for (let k = 0; k < services.length; k++) {
            const service = services[k];
            if (!service) continue;
            const serviceName = service.service_name;
            const targetService = currentConf.services.find(
                (s) => s.service_name == serviceName
            );

            if (!targetService) {
                console.log(`Dropping Service \`${serviceName}\``);

                await cleanupServicesAndDeployments({
                    deployment_name: prevConf.deployment_name,
                    service_name: serviceName,
                    deployments: previousConfigs,
                });
            }
        }
    }

    return true;
}
