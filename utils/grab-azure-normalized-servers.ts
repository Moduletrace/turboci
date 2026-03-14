import { AppNames } from "./app-names";
import grabAppNames from "./grab-app-names";
import type {
    NormalizedServerObject,
    ParsedDeploymentServiceConfig,
    TCIGlobalConfig,
} from "@/types";
import { _n } from "./numberfy";
import TurboCIAzure from "@/platforms/azure";
import {
    getAzureResourceGroup,
    azureNetworkRequest,
} from "@/platforms/azure/client";
import type { AZURE_VM } from "@/platforms/azure/types";

type Params = {
    service: ParsedDeploymentServiceConfig;
    instances?: number;
    grab_children?: boolean;
    target_deployment: TCIGlobalConfig;
};

async function getServerIPs(
    deployment_name: string,
    vm: AZURE_VM,
): Promise<{ private_ip?: string; public_ip?: string }> {
    const rg = getAzureResourceGroup(deployment_name);
    const nicName = `${vm.name}-nic`;

    try {
        const nicRes = await azureNetworkRequest<any>(
            `/resourceGroups/${rg}/providers/Microsoft.Network/networkInterfaces/${nicName}`,
        );
        const privateIP =
            nicRes.data?.properties?.ipConfigurations?.[0]?.properties
                ?.privateIPAddress;
        const pipId =
            nicRes.data?.properties?.ipConfigurations?.[0]?.properties
                ?.publicIPAddress?.id;

        let publicIP: string | undefined;
        if (pipId) {
            const pipName = `${vm.name}-pip`;
            const pipRes = await azureNetworkRequest<any>(
                `/resourceGroups/${rg}/providers/Microsoft.Network/publicIPAddresses/${pipName}`,
            );
            publicIP = pipRes.data?.properties?.ipAddress;
        }

        return { private_ip: privateIP, public_ip: publicIP };
    } catch (e) {
        return {};
    }
}

export default async function grabAzureNormalizedServers({
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

    const serversRes = await TurboCIAzure.servers.list({
        deployment_name: target_deployment.deployment_name,
        tags: {
            [AppNames["TurboCILabelServiceNameKey"]]: finalServiceName,
        },
    });

    for (const srv of serversRes.servers || []) {
        const ips = await getServerIPs(target_deployment.deployment_name, srv);
        servers.push(ips);
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

            const childServersRes = await TurboCIAzure.servers.list({
                deployment_name: target_deployment.deployment_name,
                tags: {
                    [AppNames["TurboCILabelServiceNameKey"]]: childServiceName,
                },
            });

            for (const srv of childServersRes.servers || []) {
                const ips = await getServerIPs(
                    target_deployment.deployment_name,
                    srv,
                );
                servers.push(ips);
            }
        }
    }

    return servers;
}
