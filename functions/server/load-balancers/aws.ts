import TurboCIAWS from "@/platforms/aws";
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

    let servers: NormalizedServerObject[] = [];

    for (let i = 0; i < loadBalancers.length; i++) {
        const loadBalancerService = loadBalancers[i];
        if (!loadBalancerService) continue;

        const { finalServiceName } = grabAppNames({
            name: deployment.deployment_name,
            serviceName: loadBalancerService.service_name,
        });

        const loadBalancerServers = await TurboCIAWS.servers.list({
            tag: { [AppNames["TurboCILabelServiceNameKey"]]: finalServiceName },
            region: deployment.location!,
        });

        if (loadBalancerServers.servers?.[0]) {
            for (let k = 0; k < loadBalancerServers.servers.length; k++) {
                const srv = loadBalancerServers.servers[k];
                servers.push({
                    private_ip: srv?.PrivateIpAddress,
                    public_ip: srv?.PublicIpAddress,
                });
            }
        }
    }

    return servers;
}
