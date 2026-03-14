import AppData from "@/data/app-data";
import type {
    ParsedDeploymentServiceConfig,
    TCIConfigDeployment,
} from "@/types";
import _ from "lodash";
import { _n } from "./numberfy";

type Params = {
    deployment: TCIConfigDeployment;
};

export default function grabDeploymentServices({
    deployment,
}: Params): ParsedDeploymentServiceConfig[] {
    const servicesNames = Object.keys(deployment.services);
    const uniqueServiceNames = Array.from(new Set(servicesNames));

    if (uniqueServiceNames.length < servicesNames.length) {
        console.error(`Service names must be unique for each deployment`);
        process.exit();
    }

    let services: ParsedDeploymentServiceConfig[] = [];

    for (let i = 0; i < uniqueServiceNames.length; i++) {
        const serviceName = uniqueServiceNames[i];
        if (!serviceName) continue;

        let targetService = deployment.services[serviceName];
        if (!targetService) continue;

        if (
            targetService.instances &&
            _n(targetService.instances) > AppData["max_instances"]
        ) {
            console.error(
                `Service \`${serviceName}\` ERROR => Max instances is ${AppData["max_instances"]}`,
            );
            process.exit(1);
        }

        if (
            targetService.clusters &&
            _n(targetService.clusters) > AppData["max_clusters"]
        ) {
            console.error(
                `Service \`${serviceName}\` ERROR => Max cluster size is ${AppData["max_clusters"]}`,
            );
            process.exit(1);
        }

        if (targetService.duplicate_service_name) {
            const duplicateTargetService =
                deployment.services[targetService.duplicate_service_name];
            if (duplicateTargetService) {
                targetService = _.merge(
                    _.cloneDeep(duplicateTargetService),
                    targetService,
                );
            }
        }

        let newService: ParsedDeploymentServiceConfig = {
            ...targetService,
            service_name: serviceName,
        };

        services.push(_.cloneDeep(newService));

        if (targetService.clusters && _n(targetService.clusters) > 1) {
            for (let c = 0; c < targetService.clusters; c++) {
                const clusterServiceName = `${serviceName}_${c}`;

                if (c == 0) continue;

                const newService = {
                    ...targetService,
                    service_name: clusterServiceName,
                    parent_service_name: serviceName,
                };

                delete newService.clusters;

                services.push(_.cloneDeep(newService));
            }
        }
    }

    const reorderedServices = services.sort((a, b) => {
        if (b.type == "default") return 1;
        if (b.type == "docker") return 1;
        if (b.type == "load_balancer") return -1;
        return 1;
    });

    return reorderedServices;
}
