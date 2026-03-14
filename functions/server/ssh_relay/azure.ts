import type { SSHRelayServerReturn, TCIConfigDeployment } from "@/types";
import { AppNames } from "@/utils/app-names";
import grabAppNames from "@/utils/grab-app-names";
import syncRemoteDirs from "../sync-remote-dirs";
import grabDirNames from "@/utils/grab-dir-names";
import relayExecSSH from "@/utils/ssh/relay-exec-ssh";
import { execSync } from "child_process";
import TurboCIAzure from "@/platforms/azure";
import {
    getAzureResourceGroup,
    azureNetworkRequest,
} from "@/platforms/azure/client";
import azureWaitForServerStart from "@/platforms/azure/utils/wait-for-server-start";
import azureWaitForServerSSH from "@/platforms/azure/utils/wait-for-server-ssh";
import azureNATRelayServerInitSH from "@/platforms/azure/utils/grab-nat-relay-server-init-sh";
import execSSH from "@/utils/ssh/exec-ssh";
import createResourceGroup from "@/platforms/azure/utils/create-resource-group";

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
        publicSubnetName,
    } = grabAppNames({
        name: deployment.deployment_name,
    });

    const location = deployment.location!;
    const deploymentName = deployment.deployment_name;

    if (!location) {
        console.error(
            `Azure relay setup requires a \`location\` parameter for deployment`,
        );
        process.exit(1);
    }

    // Ensure resource group exists
    await createResourceGroup({ deployment_name: deploymentName, location });

    const existingRelayServer = await TurboCIAzure.servers.get({
        deployment_name: deploymentName,
        name: sshRelayServerName,
    });

    const existingServer = existingRelayServer.server;

    if (existingServer?.name) {
        const rg = getAzureResourceGroup(deploymentName);
        const nicName = `${sshRelayServerName}-nic`;
        const pipName = `${sshRelayServerName}-pip`;

        const nicRes = await azureNetworkRequest<any>(
            `/resourceGroups/${rg}/providers/Microsoft.Network/networkInterfaces/${nicName}`,
        );
        const privateIP =
            nicRes.data?.properties?.ipConfigurations?.[0]?.properties
                ?.privateIPAddress;

        const pipRes = await azureNetworkRequest<any>(
            `/resourceGroups/${rg}/providers/Microsoft.Network/publicIPAddresses/${pipName}`,
        );
        const publicIP = pipRes.data?.properties?.ipAddress;

        if (!publicIP || !privateIP) {
            console.error(`Azure Relay server error - missing IP addresses!`);
            process.exit(1);
        }

        return { ip: publicIP, private_ip: privateIP };
    }

    const deploymentNetworkRes = await TurboCIAzure.networks.get({
        deployment_name: deploymentName,
        network_name: appNetworkName,
    });

    if (!deploymentNetworkRes.network?.name) {
        console.log(`Deployment Network not created!`);
        process.exit(1);
    }

    const firewallRes = await TurboCIAzure.firewalls.get({
        deployment_name: deploymentName,
        name: defaultFirewallName,
    });

    if (!firewallRes.firewall?.id) {
        console.error(`Default Firewall not found!`);
        process.exit(1);
    }

    const rg = getAzureResourceGroup(deploymentName);
    const vnetName = appNetworkName;

    // Get the public subnet
    const publicSubnetRes = await TurboCIAzure.networks.get_subnet({
        deployment_name: deploymentName,
        vnet_name: vnetName,
        subnet_name: publicSubnetName,
    });

    if (!publicSubnetRes.subnet?.id) {
        console.error(`Public subnet not found!`);
        process.exit(1);
    }

    const relayServerType =
        (deployment.relay_server_options?.server_type as string | undefined) ||
        "Standard_B1s";

    const newSSHRelayServerRes = await TurboCIAzure.servers.create({
        deployment_name: deploymentName,
        name: sshRelayServerName,
        location,
        vm_size: relayServerType,
        subnet_id: publicSubnetRes.subnet.id,
        nsg_id: firewallRes.firewall.id,
        public_ip: true,
        enable_ip_forwarding: true,
        tags: {
            [AppNames["TurboCILabelNameKey"]]: deploymentName,
            [AppNames["TurboCILabelServiceNameKey"]]: relayServerLabelName,
        },
    });

    const publicIP = newSSHRelayServerRes.public_ip;
    const privateIP = newSSHRelayServerRes.private_ip;

    if (!publicIP || !privateIP) {
        global.ORA_SPINNER.fail(`Azure Relay server could not be created!`);
        process.exit(1);
    }

    const serverStarted = await azureWaitForServerStart({
        deployment_name: deploymentName,
        name: sshRelayServerName,
    });

    if (!serverStarted) {
        console.error(`Azure Relay server did not start!`);
        process.exit(1);
    }

    const serverSSHReady = await azureWaitForServerSSH({ public_ip: publicIP });
    if (!serverSSHReady) {
        console.error(`Azure Relay server SSH not ready!`);
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

    // Determine VNet address space for NAT
    const vnetCidr =
        deploymentNetworkRes.network.properties?.addressSpace
            ?.addressPrefixes?.[0] || "10.0.0.0/16";

    const initCommands = [azureNATRelayServerInitSH({ ip_range: vnetCidr })];

    await relayExecSSH({ cmd: initCommands, deployment });

    await Bun.sleep(2000);

    const serverReadyAfterInit = await azureWaitForServerSSH({
        public_ip: publicIP,
    });
    if (!serverReadyAfterInit) {
        console.log(`Azure Relay server initial setup failed!`);
        process.exit(1);
    }

    await syncRemoteDirs({ dst: relayServerSSHDir, src: sshDir, ip: publicIP });

    // Associate route table with private subnet for NAT routing
    const privateSubnetName = appNetworkName.replace(
        "_network",
        "_private_subnet",
    );
    const privateSubnetRes = await TurboCIAzure.networks.get_subnet({
        deployment_name: deploymentName,
        vnet_name: vnetName,
        subnet_name: privateSubnetName,
    });

    if (privateSubnetRes.subnet?.id) {
        const routeTableName = `turboci_${deploymentName.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_route_table`;

        const routeTableRes = await TurboCIAzure.networks.create_route_table({
            deployment_name: deploymentName,
            name: routeTableName,
            location,
            next_hop_ip: privateIP,
            tags: { [AppNames["TurboCILabelNameKey"]]: deploymentName },
        });

        if (routeTableRes.route_table?.id) {
            // Update private subnet to use route table
            await azureNetworkRequest(
                `/resourceGroups/${rg}/providers/Microsoft.Network/virtualNetworks/${vnetName}/subnets/${privateSubnetName}`,
                "PUT",
                {
                    properties: {
                        addressPrefix:
                            privateSubnetRes.subnet.properties?.addressPrefix,
                        routeTable: { id: routeTableRes.route_table.id },
                    },
                },
            );
        }
    }

    try {
        execSync(`ssh-keygen -f "$HOME/.ssh/known_hosts" -R "${publicIP}"`);
    } catch (error) {}

    return { ip: publicIP, private_ip: privateIP };
}
