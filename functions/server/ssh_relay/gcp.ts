import type { SSHRelayServerReturn, TCIConfigDeployment } from "@/types";
import { AppNames } from "@/utils/app-names";
import grabAppNames from "@/utils/grab-app-names";
import syncRemoteDirs from "../sync-remote-dirs";
import grabDirNames from "@/utils/grab-dir-names";
import relayExecSSH from "@/utils/ssh/relay-exec-ssh";
import { execSync } from "child_process";
import TurboCIGCP from "@/platforms/gcp";
import {
    gcpGetProject,
    gcpGetRegionFromZone,
    gcpNetworkUrl,
    gcpInstanceUrl,
} from "@/platforms/gcp/types";
import gcpWaitForServerStart from "@/platforms/gcp/utils/wait-for-server-start";
import gcpWaitForServerSSH from "@/platforms/gcp/utils/wait-for-server-ssh";
import gcpNATRelayServerInitSH from "@/platforms/gcp/utils/grab-nat-relay-server-init-sh";
import execSSH from "@/utils/ssh/exec-ssh";

type Params = {
    deployment: Omit<TCIConfigDeployment, "services">;
};

export default async function ({
    deployment,
}: Params): Promise<SSHRelayServerReturn> {
    const {
        sshRelayServerName,
        appSSHKeyName,
        appNetworkName,
        defaultFirewallName,
        relayServerLabelName,
    } = grabAppNames({
        name: deployment.deployment_name,
    });

    const zone = deployment.location!;
    const region = gcpGetRegionFromZone(zone);
    const project = gcpGetProject();

    if (!zone) {
        console.error(
            `GCP relay setup requires a \`location\` (zone) parameter for deployment`,
        );
        process.exit(1);
    }

    const existingRelayServer = await TurboCIGCP.servers.get({
        zone,
        name: sshRelayServerName,
    });

    const existingServer = existingRelayServer.server;

    if (existingServer?.name) {
        if (existingServer.status === "TERMINATED") {
            global.ORA_SPINNER.fail(
                `Relay server still in \`TERMINATED\` status.`,
            );
            console.error(`An existing Relay server is not yet cleaned up.`);
            process.exit(1);
        }

        const publicIP =
            existingServer.networkInterfaces?.[0]?.accessConfigs?.[0]?.natIP;
        const privateIP = existingServer.networkInterfaces?.[0]?.networkIP;

        if (!publicIP || !privateIP) {
            console.error(`GCP Relay server error - missing IP addresses!`);
            process.exit(1);
        }

        const hasLabels =
            existingServer.labels?.[AppNames["TurboCILabelServiceNameKey"]] &&
            existingServer.labels?.[AppNames["TurboCILabelNameKey"]];

        if (!hasLabels) {
            await TurboCIGCP.servers.update({
                zone,
                name: existingServer.name,
                labels: {
                    ...existingServer.labels,
                    [AppNames["TurboCILabelNameKey"]]:
                        deployment.deployment_name,
                    [AppNames["TurboCILabelServiceNameKey"]]:
                        relayServerLabelName,
                },
            });
        }

        return { ip: publicIP, private_ip: privateIP };
    }

    const deploymentNetworkRes = await TurboCIGCP.networks.get({
        network_name: appNetworkName,
    });

    if (!deploymentNetworkRes.network?.name) {
        console.log(`Deployment Network not created!`);
        process.exit(1);
    }

    const deploymentNetwork = deploymentNetworkRes.network;

    // Find the subnet CIDR for NAT setup
    const subnetsRes = await TurboCIGCP.networks.list_subnets({ region });
    const deploymentSubnet =
        subnetsRes.subnets?.find(
            (s) =>
                s.name === `${appNetworkName.replace("_network", "")}_subnet`,
        ) || subnetsRes.subnets?.[0];

    const subnetCidr = deploymentSubnet?.ipCidrRange || "10.0.0.0/20";

    const relayServerType =
        (deployment.relay_server_options?.server_type as string | undefined) ||
        "e2-micro";

    const newSSHRelayServerRes = await TurboCIGCP.servers.create({
        zone,
        name: sshRelayServerName,
        instance_type: relayServerType,
        labels: {
            [AppNames["TurboCILabelNameKey"]]: deployment.deployment_name,
            [AppNames["TurboCILabelServiceNameKey"]]: relayServerLabelName,
        },
        tags: ["turboci-relay", "turboci-default"],
        network_name: appNetworkName,
        subnet_name: deploymentSubnet?.name || undefined,
        public_ip: true,
        can_ip_forward: true,
    });

    const newSSHRelayServer = newSSHRelayServerRes.server;
    const publicIP =
        newSSHRelayServer?.networkInterfaces?.[0]?.accessConfigs?.[0]?.natIP;
    const privateIP = newSSHRelayServer?.networkInterfaces?.[0]?.networkIP;

    if (!newSSHRelayServer?.name || !publicIP || !privateIP) {
        global.ORA_SPINNER.fail(`GCP Relay server could not be created!`);
        process.exit(1);
    }

    const serverStarted = await gcpWaitForServerStart({
        name: sshRelayServerName,
        zone,
    });
    if (!serverStarted) {
        console.error(`GCP Relay server did not start!`);
        process.exit(1);
    }

    const serverSSHReady = await gcpWaitForServerSSH({
        name: sshRelayServerName,
        zone,
        public_ip: publicIP,
    });
    if (!serverSSHReady) {
        console.error(`GCP Relay server SSH not ready!`);
        process.exit(1);
    }

    const {
        sshDir,
        relayServerSSHDir,
        relayServerBunScriptsDir,
        relayShDir,
        relayConfigDir,
    } = grabDirNames();

    await execSSH({
        cmd: [
            `mkdir -p ${relayServerSSHDir}\n`,
            `mkdir -p ${relayServerBunScriptsDir}\n`,
            `mkdir -p ${relayConfigDir}\n`,
            `mkdir -p ${relayShDir}\n`,
        ],
        ip: publicIP,
    });

    const initCommands = [gcpNATRelayServerInitSH({ ip_range: subnetCidr })];

    await relayExecSSH({ cmd: initCommands, deployment });

    await Bun.sleep(2000);

    const serverReadyAfterInit = await gcpWaitForServerSSH({
        name: sshRelayServerName,
        zone,
        public_ip: publicIP,
    });

    if (!serverReadyAfterInit) {
        console.log(`GCP Relay server initial setup failed!`);
        process.exit(1);
    }

    await syncRemoteDirs({ dst: relayServerSSHDir, src: sshDir, ip: publicIP });

    // Create GCP route to use relay as NAT gateway
    const routeName = `turboci-${deployment.deployment_name.replace(/_/g, "-")}-nat-route`;
    const relayInstanceUrl = `zones/${zone}/instances/${sshRelayServerName}`;

    await TurboCIGCP.networks.add_route({
        route_name: routeName,
        network_name: appNetworkName,
        dest_range: "0.0.0.0/0",
        next_hop_instance: relayInstanceUrl,
        priority: 800,
        tags: ["turboci-private"],
    });

    try {
        execSync(`ssh-keygen -f "$HOME/.ssh/known_hosts" -R "${publicIP}"`);
    } catch (error) {}

    return { ip: publicIP, private_ip: privateIP };
}
