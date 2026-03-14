import Hetzner from "@/platforms/hetzner";
import type { HETZNER_EXISTING_SERVER } from "@/platforms/hetzner/types";
import hetznerWaitForServerSSH from "@/platforms/hetzner/utils/wait-for-server-ssh";
import hetznerWaitForServerStart from "@/platforms/hetzner/utils/wait-for-server-start";
import type {
    SSHRelayServerReturn,
    TCIConfig,
    TCIConfigDeployment,
} from "@/types";
import { AppNames } from "@/utils/app-names";
import grabAppNames from "@/utils/grab-app-names";
import syncRemoteDirs from "../sync-remote-dirs";
import grabDirNames from "@/utils/grab-dir-names";
import relayExecSSH from "@/utils/ssh/relay-exec-ssh";
import { execSync } from "child_process";
import hetznerNATRelayServerInitSH from "@/platforms/hetzner/utils/grab-nat-relay-server-init-sh";
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
        deployment,
    });

    const existingRelayServer = await Hetzner.servers.list({
        name: sshRelayServerName,
    });
    const existingServer = existingRelayServer.servers?.[0];

    if (existingServer?.id) {
        const serverReady = await isServerReady(existingServer);

        if (!serverReady) {
            console.log(`SSH Relay server not ready for use!`);
            process.exit(1);
        }

        const publicIP = existingServer?.public_net?.ipv4?.ip;
        const privateIP = existingServer?.private_net?.[0]?.ip;

        if (!publicIP || !privateIP) {
            console.log(`SSH Relay server error!`);
            process.exit(1);
        }

        if (
            !existingServer.labels[AppNames["TurboCILabelServiceNameKey"]] ||
            !existingServer.labels[AppNames["TurboCILabelNameKey"]]
        ) {
            await Hetzner.servers.update({
                server_id: existingServer.id,
                labels: {
                    [AppNames["TurboCILabelNameKey"]]:
                        deployment.deployment_name,
                    [AppNames["TurboCILabelServiceNameKey"]]:
                        relayServerLabelName,
                },
            });
        }

        return {
            ip: publicIP,
            private_ip: privateIP,
        };
    }

    const deploymentNetworkRes = await Hetzner.networks.list({
        name: appNetworkName,
    });

    if (!deploymentNetworkRes.networks?.[0]?.id) {
        console.log(`Deployment Network not created!`);
        process.exit(1);
    }

    const firewall = (
        await Hetzner.firewalls.list({ name: defaultFirewallName })
    )?.firewalls?.[0];

    if (!firewall?.id) {
        console.error(`Default Firewall not found!`);
        process.exit(1);
    }

    const deploymentNetwork = deploymentNetworkRes.networks[0];

    const newSSHRelayServer = await Hetzner.servers.create({
        name: sshRelayServerName,
        server_type:
            (deployment.relay_server_options?.server_type as any | undefined) ||
            "cpx11",
        ssh_keys: [appSSHKeyName],
        labels: {
            [AppNames["TurboCILabelNameKey"]]: deployment.deployment_name,
            [AppNames["TurboCILabelServiceNameKey"]]: relayServerLabelName,
        },
        image: "debian-11",
        location: deployment.location as any,
        networks: [deploymentNetwork.id],
        firewalls: [
            {
                firewall: firewall.id,
            },
        ],
        public_net: {
            enable_ipv4: true,
            enable_ipv6: false,
        },
    });

    const publicIP = newSSHRelayServer.server?.public_net?.ipv4?.ip;
    const privateIP = newSSHRelayServer.server?.private_net?.[0]?.ip;

    if (!newSSHRelayServer.server || !publicIP || !privateIP) {
        console.log(`SSH Relay server could not be created!`);
        process.exit(1);
    }

    const serverReady = await isServerReady(newSSHRelayServer.server);

    if (!serverReady) {
        console.log(`SSH Relay server not ready for use!`);
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

    let cmd = ``;

    cmd += `${hetznerNATRelayServerInitSH({
        ip_range: deploymentNetwork.ip_range,
    })}\n`;

    await relayExecSSH({
        cmd,
        deployment,
    });

    await Bun.sleep(2000);

    const serverReadyAfterInit = await isServerReady(newSSHRelayServer.server);

    if (!serverReadyAfterInit) {
        console.log(`SSH Relay server inital setup failed!`);
        process.exit(1);
    }

    const sync = await syncRemoteDirs({
        dst: relayServerSSHDir,
        src: sshDir,
        ip: publicIP,
    });

    await Hetzner.networks.add_route({
        network_id: deploymentNetwork.id,
        route: {
            destination: "0.0.0.0/0",
            gateway: privateIP,
        },
    });

    try {
        execSync(`ssh-keygen -f "$HOME/.ssh/known_hosts" -R "${publicIP}"`);
    } catch (error) {}

    return {
        ip: publicIP,
        private_ip: privateIP,
    };
}

async function isServerReady(server: HETZNER_EXISTING_SERVER) {
    const isServerStarted = await hetznerWaitForServerStart({
        server,
    });

    if (!isServerStarted) return false;

    const isServerSSHReady = await hetznerWaitForServerSSH({
        server,
    });

    if (!isServerSSHReady) return false;

    return true;
}
