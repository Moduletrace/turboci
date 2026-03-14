import Hetzner from "@/platforms/hetzner";
import type { TCIGlobalConfig, TurbociControlReturn } from "@/types";
import { AppNames } from "@/utils/app-names";
import grabAppNames from "@/utils/grab-app-names";
import grabSSHRelayServer from "@/functions/server/ssh_relay/grab-ssh-relay-server";

type Params = {
    targetDeployment: TCIGlobalConfig;
    service_name?: string;
    relay_server_only?: boolean;
};

export default async function ({
    targetDeployment,
    service_name,
    relay_server_only,
}: Params): Promise<TurbociControlReturn | undefined> {
    if (relay_server_only) {
        const relayServer = await grabSSHRelayServer({
            deployment: targetDeployment,
        });

        if (!relayServer?.ip) return;

        return {
            servers: [
                {
                    deployment_name: targetDeployment.deployment_name,
                    private_ip: relayServer.private_ip,
                    public_ip: relayServer.ip,
                    service_name: "__relay",
                },
            ],
        };
    }

    if (service_name) {
        const targetService = targetDeployment.services.find(
            (s) => s.service_name == service_name,
        );
        if (!targetService?.service_name) {
            console.error(`\`${service_name}\` service doesn't exist`);
            return undefined;
        }

        const { finalServiceName } = grabAppNames({
            name: targetDeployment.deployment_name,
            serviceName: targetService.service_name,
        });

        const targetServers = await Hetzner.servers.list({
            label_selector: `${AppNames["TurboCILabelServiceNameKey"]}==${finalServiceName}`,
        });

        return {
            servers: targetServers.servers?.map((s) => ({
                private_ip: s.private_net?.[0]?.ip,
                public_ip: s.public_net?.ipv4?.ip,
                service_name,
                deployment_name: targetDeployment.deployment_name,
            })),
        };
    } else {
        const targetServers = await Hetzner.servers.list({
            label_selector: `${AppNames["TurboCILabelNameKey"]}==${targetDeployment.deployment_name}`,
        });

        return {
            servers: targetServers.servers?.map((s) => {
                const sub_service_name =
                    s.labels?.[AppNames["TurboCILabelServiceNameKey"]];

                const targetService = targetDeployment.services.find(
                    (s) =>
                        sub_service_name ==
                        grabAppNames({
                            name: targetDeployment.deployment_name,
                            serviceName: s.service_name,
                        }).finalServiceName,
                );

                return {
                    private_ip: s.private_net?.[0]?.ip,
                    public_ip: s.public_net?.ipv4?.ip,
                    service_name: targetService?.service_name || "__relay",
                    deployment_name: targetDeployment.deployment_name,
                };
            }),
        };
    }
}
