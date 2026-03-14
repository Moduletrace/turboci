import { AppNames } from "@/utils/app-names";
import Hetzner from "../../../../platforms/hetzner";
import type { TCIConfig, TCIGlobalConfig } from "../../../../types";

type Params = {
    config: TCIGlobalConfig;
};

export default async function ({ config }: Params) {
    const deploymentName = config.deployment_name;

    const existingFirewallRules = await Hetzner.firewalls.list({
        label_selector: `${AppNames["TurboCILabelNameKey"]}==${deploymentName}`,
    });

    if (existingFirewallRules.firewalls?.[0]) {
        for (let i = 0; i < existingFirewallRules.firewalls.length; i++) {
            const firewallRule = existingFirewallRules.firewalls[i];
            if (!firewallRule?.id) continue;
            const dropFirewall = await Hetzner.firewalls.delete({
                firewall_id: firewallRule.id,
            });
        }
    }

    return true;
}
