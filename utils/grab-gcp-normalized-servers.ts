import { AppNames } from "./app-names";
import grabAppNames from "./grab-app-names";
import type {
    NormalizedServerObject,
    ParsedDeploymentServiceConfig,
    TCIGlobalConfig,
} from "@/types";
import { _n } from "./numberfy";
import TurboCIGCP from "@/platforms/gcp";

type Params = {
    service: ParsedDeploymentServiceConfig;
    instances?: number;
    grab_children?: boolean;
    target_deployment: TCIGlobalConfig;
};

export default async function grabGCPNormalizedServers({
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

    const zone = target_deployment.location!;

    const serversRes = await TurboCIGCP.servers.list({
        zone,
        labels: {
            [AppNames["TurboCILabelServiceNameKey"]]: finalServiceName,
        },
    });

    const normalizedServerChunks = serversRes.servers?.map((srv) => ({
        private_ip: srv.networkInterfaces?.[0]?.networkIP || undefined,
        public_ip:
            srv.networkInterfaces?.[0]?.accessConfigs?.[0]?.natIP || undefined,
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
            if (!child) continue;

            const { finalServiceName: childServiceName } = grabAppNames({
                name: target_deployment.deployment_name,
                serviceName: child.service_name,
            });

            const childServersRes = await TurboCIGCP.servers.list({
                zone,
                labels: {
                    [AppNames["TurboCILabelServiceNameKey"]]: childServiceName,
                },
            });

            const normalizedChildServerChunks = childServersRes.servers?.map(
                (srv) => ({
                    private_ip:
                        srv.networkInterfaces?.[0]?.networkIP || undefined,
                    public_ip:
                        srv.networkInterfaces?.[0]?.accessConfigs?.[0]?.natIP ||
                        undefined,
                }),
            );

            if (normalizedChildServerChunks?.[0]) {
                servers.push(...normalizedChildServerChunks);
            }
        }
    }

    return servers;
}
