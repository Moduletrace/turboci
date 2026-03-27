import isServiceLoadBalancerType from "@/commands/up/setup/utils/is-service-load-balancer-type";
import Hetzner from "@/platforms/hetzner";
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

    const loadBalancers = services.filter((srv) =>
        isServiceLoadBalancerType({ service: srv }),
    );

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
                    service: loadBalancerService,
                });
            }
        }
    }

    // const publicIPServers = services.filter(
    //     (srv) =>
    //         srv.enable_public_ip &&
    //         !isServiceLoadBalancerType({ service: srv }),
    // );

    // for (let i = 0; i < publicIPServers.length; i++) {
    //     const publicIPService = publicIPServers[i];
    //     if (!publicIPService) continue;

    //     const { finalServiceName } = grabAppNames({
    //         name: deployment.deployment_name,
    //         serviceName: publicIPService.service_name,
    //     });

    //     const publicIPHetznerServers = await Hetzner.servers.list({
    //         label_selector: `${AppNames["TurboCILabelServiceNameKey"]}==${finalServiceName}`,
    //     });

    //     if (publicIPHetznerServers.servers?.[0]) {
    //         for (let k = 0; k < publicIPHetznerServers.servers.length; k++) {
    //             const srv = publicIPHetznerServers.servers[k];
    //             servers.push({
    //                 private_ip: srv?.private_net?.[0]?.ip,
    //                 public_ip: srv?.public_net?.ipv4?.ip,
    //             });
    //         }
    //     }
    // }

    return servers;
}
