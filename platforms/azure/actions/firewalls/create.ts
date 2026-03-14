import { azureNetworkRequest, getAzureResourceGroup } from "../../client";
import type { AZURE_NSG, AZURE_NSG_RULE } from "../../types";

type NSGRuleInput = {
    name: string;
    protocol: string;
    destinationPortRange: string;
    sourceAddressPrefix: string;
    destinationAddressPrefix: string;
    access: string;
    priority: number;
    direction: string;
    sourcePortRange?: string;
};

type Params = {
    deployment_name: string;
    name: string;
    location: string;
    rules?: NSGRuleInput[];
    tags?: { [k: string]: string };
};

export default async function ({
    deployment_name,
    name,
    location,
    rules = [],
    tags,
}: Params) {
    const rg = getAzureResourceGroup(deployment_name);

    const securityRules: AZURE_NSG_RULE[] = rules.map((rule) => ({
        name: rule.name,
        properties: {
            protocol: rule.protocol,
            sourcePortRange: rule.sourcePortRange || "*",
            destinationPortRange: rule.destinationPortRange,
            sourceAddressPrefix: rule.sourceAddressPrefix,
            destinationAddressPrefix: rule.destinationAddressPrefix,
            access: rule.access,
            priority: rule.priority,
            direction: rule.direction,
        },
    }));

    const res = await azureNetworkRequest<AZURE_NSG>(
        `/resourceGroups/${rg}/providers/Microsoft.Network/networkSecurityGroups/${name}`,
        "PUT",
        {
            location,
            tags,
            properties: {
                securityRules,
            },
        }
    );

    return { firewall: res.data };
}
