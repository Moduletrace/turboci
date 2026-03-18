import type { TCIConfigServiceConfigLBTarget, TCIGlobalConfig } from "@/types";
import { _n } from "@/utils/numberfy";
import grabUpstreamNames from "@/utils/grab-upstream-names";
import grabNginxTargetServiceUpstreamBlock from "./grab-nginx-target-service-upstream-block";

type Params = {
    backup?: boolean;
    target_deployment: TCIGlobalConfig;
    service: TCIConfigServiceConfigLBTarget;
};

export default async function grabNginxUpstreamBlock(params: Params) {
    const { target_deployment, backup, service } = params;

    const { upstream_name } = grabUpstreamNames({
        service_name: service.service_name,
        port: service.port,
    });

    let cnf = "";
    cnf += `    upstream ${upstream_name} {\n`;

    if (service) {
        cnf += await grabNginxTargetServiceUpstreamBlock({
            target_deployment,
            target_service: service,
            backup,
        });
    }

    cnf += `    }\n\n`;

    return cnf;
}
