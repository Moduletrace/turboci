import type { TCIGlobalConfig } from "@/types";
import dropNetwork from "./drop-network";
import dropServices from "./drop-services";
import dropSshKey from "./drop-ssh-key";
import dropRelayServer from "./drop-relay-server";
import dropFirewalls from "./drop-firewalls";

export type DownSetupParams = {
    deployments?: TCIGlobalConfig[];
    deployment_name?: string;
    service_name?: string;
};

export default async function (params?: DownSetupParams) {
    /**
     * # Drop Services
     */
    global.ORA_SPINNER.text = params?.service_name
        ? `Dropping Service \`${params.service_name}\``
        : `Dropping Services ...`;
    global.ORA_SPINNER.start();

    const dropServicesRes = await dropServices(params);

    if (dropServicesRes) {
        global.ORA_SPINNER.succeed(`Services Removed Successfully!`);
    } else {
        console.error(`Services Removal Failed!`);
        process.exit(1);
    }

    /**
     * # Drop Relay Servers
     */
    if (!params?.service_name) {
        global.ORA_SPINNER.text = `Dropping Relay Server ...`;
        global.ORA_SPINNER.start();

        const dropRelayServers = await dropRelayServer(params);

        if (dropRelayServers) {
            global.ORA_SPINNER.succeed(`Relay Server Removed Successfully!`);
        } else {
            console.error(`Relay Server Removal Failed!`);
            process.exit(1);
        }
    }

    /**
     * # Drop Firewalls
     */
    if (!params?.service_name) {
        global.ORA_SPINNER.text = `Dropping Firewall rules ...`;
        global.ORA_SPINNER.start();

        const dropFirewallsRes = await dropFirewalls();

        if (dropFirewallsRes) {
            global.ORA_SPINNER.succeed(`Firewall Rules Successfully!`);
        } else {
            console.error(`Firewalls Removal Failed!`);
            process.exit(1);
        }
    }

    /**
     * # Drop Networks
     */
    if (!params?.service_name) {
        global.ORA_SPINNER.text = `Removing Networks ...`;
        global.ORA_SPINNER.start();

        const dropNtwk = await dropNetwork(params);

        if (dropNtwk) {
            global.ORA_SPINNER.succeed(`Networks Removed Successfully!`);
        } else {
            console.error(`Networks Removal Failed!`);
            process.exit(1);
        }
    }

    /**
     * # Drop SSH Keys
     */
    if (!params?.service_name) {
        global.ORA_SPINNER.text = `Dropping SSH Keys ...`;
        global.ORA_SPINNER.start();

        const dropSSHKey = await dropSshKey(params);

        if (dropSSHKey) {
            global.ORA_SPINNER.succeed(`SSH Key Removed Successfully!`);
        } else {
            console.error(`SSH Keys Removal Failed!`);
            process.exit(1);
        }
    }
}
