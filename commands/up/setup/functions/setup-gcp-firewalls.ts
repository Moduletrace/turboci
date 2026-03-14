import type { TCIGlobalConfig } from "../../../../types";
import grabAppNames from "../../../../utils/grab-app-names";
import TurboCIGCP from "@/platforms/gcp";
import { AppNames } from "@/utils/app-names";

type Params = {
    config: TCIGlobalConfig;
};

export default async function ({ config }: Params) {
    const deploymentName = config.deployment_name;

    const { defaultFirewallName, loadBalancerFirewallName, appNetworkName } =
        grabAppNames({
            name: deploymentName,
        });

    const existingDefaultFirewall = await TurboCIGCP.firewalls.get({
        name: defaultFirewallName,
    });

    if (!existingDefaultFirewall.firewall?.name) {
        await TurboCIGCP.firewalls.create({
            name: defaultFirewallName,
            network_name: appNetworkName,
            allowed: [{ protocol: "tcp", ports: ["22"] }],
            source_ranges: ["0.0.0.0/0"],
            target_tags: ["turboci-default", "turboci-relay"],
            description: "Allow SSH",
        });
    }

    const existingLoadBalancerFirewall = await TurboCIGCP.firewalls.get({
        name: loadBalancerFirewallName,
    });

    if (!existingLoadBalancerFirewall.firewall?.name) {
        await TurboCIGCP.firewalls.create({
            name: loadBalancerFirewallName,
            network_name: appNetworkName,
            allowed: [
                { protocol: "tcp", ports: ["80"] },
                { protocol: "tcp", ports: ["443"] },
            ],
            source_ranges: ["0.0.0.0/0"],
            target_tags: ["turboci-lb"],
            description: "Allow HTTP/HTTPS traffic",
        });
    }

    // Allow all internal traffic within the VPC
    const allowAllInternalName = `${defaultFirewallName}-internal`;
    const existingInternalFirewall = await TurboCIGCP.firewalls.get({
        name: allowAllInternalName,
    });

    if (!existingInternalFirewall.firewall?.name) {
        await TurboCIGCP.firewalls.create({
            name: allowAllInternalName,
            network_name: appNetworkName,
            allowed: [{ protocol: "all" }],
            source_ranges: ["10.0.0.0/8"],
            description: "Allow all internal VPC traffic",
        });
    }

    return true;
}
