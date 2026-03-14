import Hetzner from "@/platforms/hetzner";
import { AppNames } from "./app-names";
import grabAppNames from "./grab-app-names";
import type {
    NormalizedServerObject,
    ParsedDeploymentServiceConfig,
    TCIGlobalConfig,
} from "@/types";
import { _n } from "./numberfy";

type Params = {
    service: ParsedDeploymentServiceConfig;
    instances?: number;
    grab_children?: boolean;
    target_deployment: TCIGlobalConfig;
};

export default async function grabHetznerNormalizedServers({
    service,
    instances,
    grab_children,
    target_deployment,
}: Params): Promise<NormalizedServerObject[] | undefined> {
    const { finalServiceName } = grabAppNames({
        name: target_deployment.deployment_name,
        serviceName: service.service_name,
    });

    let servers: NormalizedServerObject[] = [];

    if (!_n(instances)) {
        return undefined;
    }

    const serversRes = await Hetzner.servers.list({
        label_selector: `${AppNames["TurboCILabelServiceNameKey"]}==${finalServiceName}`,
    });

    const normalizedServerChunks = serversRes.servers?.map((srv) => ({
        private_ip: srv.private_net?.[0]?.ip,
        public_ip: srv.public_net?.ipv4?.ip,
    }));

    if (normalizedServerChunks?.[0]) {
        servers.push(...normalizedServerChunks);
    }

    if (grab_children) {
        const children = target_deployment.services.filter(
            (c) => c.parent_service_name == service.service_name,
        );

        for (let c = 0; c < children.length; c++) {
            const child = children[c];

            if (!child) {
                continue;
            }

            const { finalServiceName: childServiceName } = grabAppNames({
                name: target_deployment.deployment_name,
                serviceName: child.service_name,
            });

            const childServersRes = await Hetzner.servers.list({
                label_selector: `${AppNames["TurboCILabelServiceNameKey"]}==${childServiceName}`,
            });

            const normalizedChildServerChunks = childServersRes.servers?.map(
                (srv) => ({
                    private_ip: srv.private_net?.[0]?.ip,
                    public_ip: srv.public_net?.ipv4?.ip,
                }),
            );

            if (normalizedChildServerChunks?.[0]) {
                servers.push(...normalizedChildServerChunks);
            }
        }
    }

    return servers;
}
