import TurboCIGCP from "@/platforms/gcp";
import type { NormalizedServerObject, TCIGlobalConfig } from "@/types";
import { AppNames } from "@/utils/app-names";
import grabAppNames from "@/utils/grab-app-names";

type Params = {
    deployment: TCIGlobalConfig;
};

export default async function ({
    deployment,
}: Params): Promise<NormalizedServerObject[] | undefined> {
    const services = deployment.services;
    const loadBalancers = services.filter((srv) => srv.type == "load_balancer");
    const zone = deployment.location!;

    let servers: NormalizedServerObject[] = [];

    for (let i = 0; i < loadBalancers.length; i++) {
        const loadBalancerService = loadBalancers[i];
        if (!loadBalancerService) continue;

        const { finalServiceName } = grabAppNames({
            name: deployment.deployment_name,
            serviceName: loadBalancerService.service_name,
        });

        const loadBalancerServers = await TurboCIGCP.servers.list({
            zone,
            labels: {
                [AppNames["TurboCILabelServiceNameKey"]]: finalServiceName,
            },
        });

        if (loadBalancerServers.servers?.[0]) {
            for (let k = 0; k < loadBalancerServers.servers.length; k++) {
                const srv = loadBalancerServers.servers[k];
                servers.push({
                    private_ip:
                        srv?.networkInterfaces?.[0]?.networkIP || undefined,
                    public_ip:
                        srv?.networkInterfaces?.[0]?.accessConfigs?.[0]
                            ?.natIP || undefined,
                });
            }
        }
    }

    return servers;
}
