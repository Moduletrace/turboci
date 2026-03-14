import type { TCIGlobalConfig } from "../../../../types";
import grabAppNames from "../../../../utils/grab-app-names";
import TurboCIAzure from "@/platforms/azure";
import { AppNames } from "@/utils/app-names";

type Params = {
    config: TCIGlobalConfig;
};

export default async function ({ config }: Params) {
    const deploymentName = config.deployment_name;

    const {
        defaultFirewallName,
        loadBalancerFirewallName,
        allowAllFirewallName,
    } = grabAppNames({ name: deploymentName });

    const location = config.location!;

    if (!location) {
        console.error(
            `Azure firewall setup requires a \`location\` parameter for deployment`,
        );
        process.exit(1);
    }

    const existingDefaultFirewall = await TurboCIAzure.firewalls.get({
        deployment_name: deploymentName,
        name: defaultFirewallName,
    });

    if (!existingDefaultFirewall.firewall?.name) {
        await TurboCIAzure.firewalls.create({
            deployment_name: deploymentName,
            name: defaultFirewallName,
            location,
            rules: [
                {
                    name: "allow-ssh",
                    protocol: "Tcp",
                    destinationPortRange: "22",
                    sourceAddressPrefix: "*",
                    destinationAddressPrefix: "*",
                    access: "Allow",
                    priority: 100,
                    direction: "Inbound",
                },
                {
                    name: "allow-internal",
                    protocol: "*",
                    destinationPortRange: "*",
                    sourceAddressPrefix: "10.0.0.0/8",
                    destinationAddressPrefix: "*",
                    access: "Allow",
                    priority: 200,
                    direction: "Inbound",
                },
            ],
            tags: { [AppNames["TurboCILabelNameKey"]]: deploymentName },
        });
    }

    const existingLoadBalancerFirewall = await TurboCIAzure.firewalls.get({
        deployment_name: deploymentName,
        name: loadBalancerFirewallName,
    });

    if (!existingLoadBalancerFirewall.firewall?.name) {
        await TurboCIAzure.firewalls.create({
            deployment_name: deploymentName,
            name: loadBalancerFirewallName,
            location,
            rules: [
                {
                    name: "allow-http",
                    protocol: "Tcp",
                    destinationPortRange: "80",
                    sourceAddressPrefix: "*",
                    destinationAddressPrefix: "*",
                    access: "Allow",
                    priority: 100,
                    direction: "Inbound",
                },
                {
                    name: "allow-https",
                    protocol: "Tcp",
                    destinationPortRange: "443",
                    sourceAddressPrefix: "*",
                    destinationAddressPrefix: "*",
                    access: "Allow",
                    priority: 110,
                    direction: "Inbound",
                },
                {
                    name: "allow-ssh",
                    protocol: "Tcp",
                    destinationPortRange: "22",
                    sourceAddressPrefix: "*",
                    destinationAddressPrefix: "*",
                    access: "Allow",
                    priority: 120,
                    direction: "Inbound",
                },
            ],
            tags: { [AppNames["TurboCILabelNameKey"]]: deploymentName },
        });
    }

    const existingAllowAllFirewall = await TurboCIAzure.firewalls.get({
        deployment_name: deploymentName,
        name: allowAllFirewallName,
    });

    if (!existingAllowAllFirewall.firewall?.name) {
        await TurboCIAzure.firewalls.create({
            deployment_name: deploymentName,
            name: allowAllFirewallName,
            location,
            rules: [
                {
                    name: "allow-all-internal",
                    protocol: "*",
                    destinationPortRange: "*",
                    sourceAddressPrefix: "10.0.0.0/8",
                    destinationAddressPrefix: "*",
                    access: "Allow",
                    priority: 100,
                    direction: "Inbound",
                },
                {
                    name: "allow-ssh",
                    protocol: "Tcp",
                    destinationPortRange: "22",
                    sourceAddressPrefix: "*",
                    destinationAddressPrefix: "*",
                    access: "Allow",
                    priority: 200,
                    direction: "Inbound",
                },
            ],
            tags: { [AppNames["TurboCILabelNameKey"]]: deploymentName },
        });
    }

    return true;
}
