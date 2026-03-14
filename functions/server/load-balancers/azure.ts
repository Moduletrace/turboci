import TurboCIAzure from "@/platforms/azure";
import {
    getAzureResourceGroup,
    azureNetworkRequest,
} from "@/platforms/azure/client";
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
    const rg = getAzureResourceGroup(deployment.deployment_name);

    let servers: NormalizedServerObject[] = [];

    for (let i = 0; i < loadBalancers.length; i++) {
        const loadBalancerService = loadBalancers[i];
        if (!loadBalancerService) continue;

        const { finalServiceName } = grabAppNames({
            name: deployment.deployment_name,
            serviceName: loadBalancerService.service_name,
        });

        const loadBalancerServers = await TurboCIAzure.servers.list({
            deployment_name: deployment.deployment_name,
            tags: {
                [AppNames["TurboCILabelServiceNameKey"]]: finalServiceName,
            },
        });

        for (const srv of loadBalancerServers.servers || []) {
            const nicName = `${srv.name}-nic`;
            const pipName = `${srv.name}-pip`;

            let privateIP: string | undefined;
            let publicIP: string | undefined;

            try {
                const nicRes = await azureNetworkRequest<any>(
                    `/resourceGroups/${rg}/providers/Microsoft.Network/networkInterfaces/${nicName}`,
                );
                privateIP =
                    nicRes.data?.properties?.ipConfigurations?.[0]?.properties
                        ?.privateIPAddress;
            } catch (e) {}

            try {
                const pipRes = await azureNetworkRequest<any>(
                    `/resourceGroups/${rg}/providers/Microsoft.Network/publicIPAddresses/${pipName}`,
                );
                publicIP = pipRes.data?.properties?.ipAddress;
            } catch (e) {}

            servers.push({ private_ip: privateIP, public_ip: publicIP });
        }
    }

    return servers;
}
