import type { DefaultDeploymentParams } from "../../../../types";
import grabAppNames from "../../../../utils/grab-app-names";
import grabSSHRelayServer from "@/functions/server/ssh_relay/grab-ssh-relay-server";
import TurboCIAzure from "@/platforms/azure";
import setupAzureServerInitInstances from "./setup-azure-server-init-instances";
import setupAzureServerTrimExcessServers from "./setup-azure-server-trim-excess-servers";
import setupAzureServerSetupNewPrivateServers from "./setup-azure-server-setup-new-private-servers";
import createResourceGroup from "@/platforms/azure/utils/create-resource-group";

export default async function ({
    service,
    deployment,
}: DefaultDeploymentParams) {
    const deploymentName = deployment.deployment_name;

    const sshRelayServer = await grabSSHRelayServer({ deployment });

    if (!sshRelayServer?.ip) {
        console.error(`No SSH Relay Server Found for setting up Azure Server!`);
        process.exit(1);
    }

    const { appNetworkName } = grabAppNames({
        name: deploymentName,
        serviceName: service.service_name,
    });

    const location = deployment.location;

    if (!location) {
        console.error(`Azure server setup requires a \`location\` parameter`);
        process.exit(1);
    }

    // Ensure resource group exists
    await createResourceGroup({ deployment_name: deploymentName, location });

    const defaultNetwork = (
        await TurboCIAzure.networks.get({
            deployment_name: deploymentName,
            network_name: appNetworkName,
        })
    ).network;

    if (!defaultNetwork?.name) {
        console.error(
            `Deployment network not found for service ${service.service_name}`,
        );
        process.exit(1);
    }

    const { new_private_server_ips } = await setupAzureServerInitInstances({
        defaultNetwork,
        deployment,
        service,
        serviceName: service.service_name,
        location,
    });

    await setupAzureServerTrimExcessServers({
        deployment,
        service,
        serviceName: service.service_name,
    });

    await setupAzureServerSetupNewPrivateServers({
        deployment,
        new_private_server_ips,
    });

    return true;
}
