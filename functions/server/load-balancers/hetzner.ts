import Hetzner from "@/platforms/hetzner";
import type {
    NormalizedServerObject,
    TCIConfig,
    TCIGlobalConfig,
} from "@/types";
import { AppNames } from "@/utils/app-names";
import grabAppNames from "@/utils/grab-app-names";
import grabDeploymentServices from "@/utils/grab-deployment-services";

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

        const loadBalancerServers = await Hetzner.servers.list({
            label_selector: `${AppNames["TurboCILabelServiceNameKey"]}==${finalServiceName}`,
        });

        if (loadBalancerServers.servers?.[0]) {
            for (let k = 0; k < loadBalancerServers.servers.length; k++) {
                const srv = loadBalancerServers.servers[k];
                servers.push({
                    private_ip: srv?.private_net?.[0]?.ip,
                    public_ip: srv?.public_net?.ipv4?.ip,
                });
            }
        }
    }

    return servers;
}
