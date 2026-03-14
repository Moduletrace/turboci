import { AppNames } from "./app-names";
import grabAppNames from "./grab-app-names";
import type {
    NormalizedServerObject,
    ParsedDeploymentServiceConfig,
    TCIGlobalConfig,
} from "@/types";
import { _n } from "./numberfy";
import TurboCIAWS from "@/platforms/aws";

type Params = {
    service: ParsedDeploymentServiceConfig;
    instances?: number;
    grab_children?: boolean;
    target_deployment: TCIGlobalConfig;
};

export default async function grabAWSNormalizedServers({
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

    const awsServersRes = await TurboCIAWS.servers.list({
        region: target_deployment.location!,
        tag: {
            [AppNames["TurboCILabelServiceNameKey"]]: finalServiceName,
        },
    });

    const awsNormalizedServerChunks = awsServersRes.servers?.map((srv) => ({
        private_ip: srv.PrivateIpAddress,
        public_ip: srv.PublicIpAddress,
    }));

    if (awsNormalizedServerChunks?.[0]) {
        servers.push(...awsNormalizedServerChunks);
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

            const childServersRes = await TurboCIAWS.servers.list({
                region: target_deployment.location!,
                tag: {
                    [AppNames["TurboCILabelServiceNameKey"]]: childServiceName,
                },
            });

            const normalizedChildServerChunks = childServersRes.servers?.map(
                (srv) => ({
                    private_ip: srv.PrivateIpAddress,
                    public_ip: srv.PublicIpAddress,
                }),
            );

            if (normalizedChildServerChunks?.[0]) {
                servers.push(...normalizedChildServerChunks);
            }
        }
    }

    return servers;
}
