import Hetzner from "../../../../platforms/hetzner";
import type { TCIGlobalConfig } from "../../../../types";
import { AppNames } from "../../../../utils/app-names";
import grabAppNames from "../../../../utils/grab-app-names";

type Params = {
    config: TCIGlobalConfig;
};

export default async function ({ config }: Params) {
    const deploymentName = config.deployment_name;

    const { defaultFirewallName, loadBalancerFirewallName } = grabAppNames({
        name: deploymentName,
    });

    const existingDefaultFirewall = await Hetzner.firewalls.list({
        name: defaultFirewallName,
    });

    if (!existingDefaultFirewall.firewalls?.[0]?.id) {
        await Hetzner.firewalls.create({
            name: defaultFirewallName,
            labels: {
                [AppNames["TurboCILabelNameKey"]]: deploymentName,
            },
            rules: [
                {
                    port: "22",
                    description: "Allow SSH",
                    direction: "in",
                    protocol: "tcp",
                    source_ips: ["0.0.0.0/0", "::/0"],
                },
            ],
        });
    }

    const existingLoadBalancerFirewall = await Hetzner.firewalls.list({
        name: loadBalancerFirewallName,
    });

    if (!existingLoadBalancerFirewall.firewalls?.[0]?.id) {
        await Hetzner.firewalls.create({
            name: loadBalancerFirewallName,
            labels: {
                [AppNames["TurboCILabelNameKey"]]: deploymentName,
            },
            rules: [
                // {
                //     port: "22",
                //     description: "Allow SSH",
                //     direction: "in",
                //     protocol: "tcp",
                //     source_ips: ["0.0.0.0/0", "::/0"],
                // },
                {
                    port: "80",
                    description: "Allow HTTP traffic",
                    direction: "in",
                    protocol: "tcp",
                    source_ips: ["0.0.0.0/0", "::/0"],
                },
                {
                    port: "443",
                    description: "Allow HTTPS traffic",
                    direction: "in",
                    protocol: "tcp",
                    source_ips: ["0.0.0.0/0", "::/0"],
                },
            ],
        });
    }

    return true;
}
