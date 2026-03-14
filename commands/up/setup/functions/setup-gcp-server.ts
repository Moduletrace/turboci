import type { DefaultDeploymentParams } from "../../../../types";
import grabAppNames from "../../../../utils/grab-app-names";
import grabSSHRelayServer from "@/functions/server/ssh_relay/grab-ssh-relay-server";
import TurboCIGCP from "@/platforms/gcp";
import setupGcpServerInitInstances from "./setup-gcp-server-init-instances";
import setupGcpServerTrimExcessServers from "./setup-gcp-server-trim-excess-servers";
import setupGcpServerSetupNewPrivateServers from "./setup-gcp-server-setup-new-private-servers";

export default async function ({
    service,
    deployment,
}: DefaultDeploymentParams) {
    const deploymentName = deployment.deployment_name;

    const sshRelayServer = await grabSSHRelayServer({ deployment });

    if (!sshRelayServer?.ip) {
        console.error(`No SSH Relay Server Found for setting up GCP Server!`);
        process.exit(1);
    }

    const { appNetworkName } = grabAppNames({
        name: deploymentName,
        serviceName: service.service_name,
    });

    const zone = deployment.location!;

    if (!zone) {
        console.error(
            `GCP server setup requires a \`location\` (zone) parameter`,
        );
        process.exit(1);
    }

    const defaultNetwork = (
        await TurboCIGCP.networks.get({ network_name: appNetworkName })
    ).network;

    if (!defaultNetwork?.name) {
        console.error(
            `Deployment network not found for service ${service.service_name}`,
        );
        process.exit(1);
    }

    const { new_private_server_ips } = await setupGcpServerInitInstances({
        defaultNetwork,
        deployment,
        service,
        serviceName: service.service_name,
        zone,
    });

    await setupGcpServerTrimExcessServers({
        deployment,
        service,
        serviceName: service.service_name,
        zone,
    });

    await setupGcpServerSetupNewPrivateServers({
        deployment,
        new_private_server_ips,
    });

    return true;
}
