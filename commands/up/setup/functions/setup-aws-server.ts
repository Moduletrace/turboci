import type { DefaultDeploymentParams } from "../../../../types";
import grabAppNames from "../../../../utils/grab-app-names";
import grabSSHRelayServer from "@/functions/server/ssh_relay/grab-ssh-relay-server";
import _ from "lodash";
import TurboCIAWS from "@/platforms/aws";
import setupAwsServerInitInstances from "./setup-aws-server-init-instances";
import setupAwsServerTrimExcessServers from "./setup-aws-server-trim-excess-servers";
import setupAwsServerSetupNewPrivateServers from "./setup-aws-server-setup-new-private-servers";

export default async function ({
    service,
    deployment,
}: DefaultDeploymentParams) {
    const deploymentName = deployment.deployment_name;

    const sshRelayServer = await grabSSHRelayServer({ deployment });

    if (!sshRelayServer?.ip) {
        console.error(`No SSH Relay Server Found for setting up AWS Server!`);
        process.exit(1);
    }

    const { appNetworkName } = grabAppNames({
        name: deploymentName,
        serviceName: service.service_name,
    });

    const region = deployment.location;

    if (!region) {
        console.error(
            `AWS newtwork setup requires a \`location\` parameter for service deployment`,
        );
        process.exit(1);
    }

    const defaultNetwork = (
        await TurboCIAWS.networks.list({ network_name: appNetworkName, region })
    ).networks?.[0];

    const networkId = defaultNetwork?.VpcId;

    if (!defaultNetwork || !networkId) {
        console.error(
            `Deployment network not found for service ${service.service_name}`,
        );
        process.exit(1);
    }

    /**
     * # Setup Servers
     */
    const { new_private_server_ips } = await setupAwsServerInitInstances({
        defaultNetwork,
        deployment,
        service,
        serviceName: service.service_name,
        region,
    });

    /**
     * # Trim Excess Servers
     */
    await setupAwsServerTrimExcessServers({
        deployment,
        service,
        serviceName: service.service_name,
    });

    /**
     * # Initialize new Private Servers for NAT and Relay
     */
    await setupAwsServerSetupNewPrivateServers({
        defaultNetwork,
        deployment,
        new_private_server_ips,
    });

    return true;
}
