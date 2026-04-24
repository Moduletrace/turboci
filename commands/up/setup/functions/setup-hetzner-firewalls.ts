import grabFirewallName from "@/utils/grab-firewall-name";
import Hetzner from "../../../../platforms/hetzner";
import type { TCIGlobalConfig } from "../../../../types";
import { AppNames } from "../../../../utils/app-names";
import grabAppNames from "../../../../utils/grab-app-names";
import type { HETZNER_FIREWALL_RULE } from "@/platforms/hetzner/types";

type Params = {
    config: TCIGlobalConfig;
};

export default async function ({ config }: Params) {
    const deploymentName = config.deployment_name;

    const {
        defaultFirewallName,
        loadBalancerFirewallName,
        dbLoadBalancerFirewallName,
    } = grabAppNames({
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

    const existingDBLoadBalancerFirewall = await Hetzner.firewalls.list({
        name: dbLoadBalancerFirewallName,
    });

    if (!existingDBLoadBalancerFirewall.firewalls?.[0]?.id) {
        await Hetzner.firewalls.create({
            name: dbLoadBalancerFirewallName,
            labels: {
                [AppNames["TurboCILabelNameKey"]]: deploymentName,
            },
            rules: [
                {
                    port: "3306",
                    description: "Allow Mysql traffic",
                    direction: "in",
                    protocol: "tcp",
                    source_ips: ["0.0.0.0/0", "::/0"],
                },
                {
                    port: "5432",
                    description: "Allow PostgreSQL traffic",
                    direction: "in",
                    protocol: "tcp",
                    source_ips: ["0.0.0.0/0", "::/0"],
                },
                {
                    port: "6033",
                    description: "Allow ProxySQL traffic",
                    direction: "in",
                    protocol: "tcp",
                    source_ips: ["0.0.0.0/0", "::/0"],
                },
                {
                    port: "6432",
                    description: "Allow PgBouncer traffic",
                    direction: "in",
                    protocol: "tcp",
                    source_ips: ["0.0.0.0/0", "::/0"],
                },
            ],
        });
    }

    if (config.firewalls) {
        const firewalls = Object.keys(config.firewalls);

        for (let i = 0; i < firewalls.length; i++) {
            const firewall_name = firewalls[i];

            if (!firewall_name) continue;

            const firewall = config.firewalls[firewall_name];

            if (!firewall) continue;

            const final_firewall_name = grabFirewallName({
                config,
                firewall_name,
            });

            const firewall_rules: HETZNER_FIREWALL_RULE[] = [];

            for (let j = 0; j < firewall.ports.length; j++) {
                const port = firewall.ports[j];
                const default_allowed_sources = ["0.0.0.0/0", "::/0"];

                if (!port) continue;

                const port_number = typeof port == "object" ? port.port : port;

                const firewall_rule: HETZNER_FIREWALL_RULE = {
                    description:
                        firewall.description ||
                        `${config.deployment_name} ${firewall_name} firewall`,
                    direction: "in",
                    port: String(port_number),
                    protocol: "tcp",
                    source_ips:
                        typeof port == "object"
                            ? port.allowed_sources
                                ? port.allowed_sources
                                : default_allowed_sources
                            : default_allowed_sources,
                };

                firewall_rules.push(firewall_rule);
            }

            const new_firewall = await Hetzner.firewalls.create({
                name: loadBalancerFirewallName,
                labels: {
                    [AppNames["TurboCILabelNameKey"]]: deploymentName,
                    [AppNames["TurboCILabelFirewallNameKey"]]:
                        final_firewall_name,
                },
                rules: firewall_rules,
            });

            console.log("new_firewall", new_firewall);
        }
    }

    return true;
}
