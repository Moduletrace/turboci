import Hetzner from "../../../../platforms/hetzner";
import type { DefaultDeploymentParams } from "../../../../types";
import grabAppNames from "../../../../utils/grab-app-names";
import grabSSHRelayServer from "@/functions/server/ssh_relay/grab-ssh-relay-server";
import _ from "lodash";
import setupHetznerServerInitInstances from "./setup-hetzner-server-init-instances";
import setupHetznerServerTrimExcessServers from "./setup-hetzner-server-trim-excess-servers";
import setupHetznerServerSetupNewPrivateServers from "./setup-hetzner-server-setup-new-private-servers";

export default async function ({
    service,
    deployment,
}: DefaultDeploymentParams) {
    const deploymentName = deployment.deployment_name;

    const sshRelayServer = await grabSSHRelayServer({ deployment });

    if (!sshRelayServer?.ip) {
        console.error(
            `No SSH Relay Server Found for setting up Hetzner Server!`,
        );
        process.exit(1);
    }

    const { appNetworkName } = grabAppNames({
        name: deploymentName,
        serviceName: service.service_name,
    });

    const defaultNetwork = (
        await Hetzner.networks.list({ name: appNetworkName })
    ).networks?.[0];

    const networkId = defaultNetwork?.id;

    if (!defaultNetwork || !networkId) {
        console.error(
            `Deployment network not found for service ${service.service_name}`,
        );
        process.exit(1);
    }

    /**
     * # Setup Servers
     */
    const { new_private_server_ips } = await setupHetznerServerInitInstances({
        defaultNetwork,
        deployment,
        service,
        serviceName: service.service_name,
    });

    /**
     * # Trim Excess Servers
     */
    await setupHetznerServerTrimExcessServers({
        deployment,
        service,
        serviceName: service.service_name,
    });

    /**
     * # Initialize new Private Servers for NAT and Relay
     */
    await setupHetznerServerSetupNewPrivateServers({
        defaultNetwork,
        deployment,
        new_private_server_ips,
    });

    return true;
}
