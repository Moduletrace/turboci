import type { TCIConfigServiceConfigLBTarget, TCIGlobalConfig } from "@/types";
import grabNormalizedServers from "@/utils/grab-normalized-servers";
import { _n } from "@/utils/numberfy";
import AppData from "@/data/app-data";
import grabUpstreamNames from "@/utils/grab-upstream-names";

type Params = {
    backup?: boolean;
    target_deployment: TCIGlobalConfig;
    targets: TCIConfigServiceConfigLBTarget[];
    service: TCIConfigServiceConfigLBTarget;
};

export default async function grabNginxUpstreamBlock(params: Params) {
    const { target_deployment, targets, backup, service } = params;

    const { upstream_name } = grabUpstreamNames({
        service_name: service.service_name,
    });

    let cnf = "";
    cnf += `    upstream ${upstream_name} {\n`;

    for (let i = 0; i < targets.length; i++) {
        const target_service = targets[i];
        if (!target_service) continue;
        const service_config = target_deployment.services.find(
            (srv) => srv.service_name == target_service.service_name,
        );
        if (!service_config) continue;

        const finalInstances =
            typeof service_config.instances == "number"
                ? service_config.instances
                : 1;
        const finalClusters =
            typeof service_config.clusters == "number"
                ? service_config.clusters
                : 1;

        const target_service_full_object = target_deployment.services.find(
            (s) => s.service_name == target_service.service_name,
        );

        if (!target_service_full_object) {
            continue;
        }

        const service_servers = await grabNormalizedServers({
            provider: target_deployment.provider,
            service: target_service_full_object,
            instances: finalInstances,
            clusters: finalClusters,
            target_deployment,
            grab_children: true,
        });

        if (!service_servers?.[0]) continue;

        for (let k = 0; k < service_servers.length; k++) {
            const service_server = service_servers[k];
            if (!service_server) continue;

            let text = `server ${service_server.private_ip}`;

            text += `:${target_service.port || 80}`;

            if (!backup) {
                const max_fails = AppData["load_balancer_max_fails"];
                const fail_timeout = AppData["load_balancer_fail_timeout_secs"];

                text += ` max_fails=${max_fails} fail_timeout=${fail_timeout}s`;
            }

            if (target_service.weight && _n(target_service.weight)) {
                text += ` weight=${_n(target_service.weight)}`;
            }

            cnf += `        ${text};\n`;
        }
    }

    cnf += `    }\n\n`;

    return cnf;
}
