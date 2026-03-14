import { AppNames } from "@/utils/app-names";
import TurboCIAWS from "@/platforms/aws";
import type { TCIGlobalConfig } from "../../../../types";

type Params = {
    config: TCIGlobalConfig;
};

export default async function ({ config }: Params) {
    try {
        const deploymentName = config.deployment_name;

        const existingFirewallRulesRes = await TurboCIAWS.firewalls.list({
            region: config.location!,
            tags: {
                [AppNames["TurboCILabelNameKey"]]: deploymentName,
            },
        });

        const existingFirewallRules = existingFirewallRulesRes.firewalls;

        if (existingFirewallRules) {
            for (let i = 0; i < existingFirewallRules.length; i++) {
                const firewallRule = existingFirewallRules[i];

                if (!firewallRule?.GroupId) continue;
                if (firewallRule.GroupName == "default") continue;

                const dropFirewall = await TurboCIAWS.firewalls.delete({
                    region: config.location!,
                    group_id: firewallRule.GroupId,
                });
            }
        }

        return true;
    } catch (error: any) {
        console.error(error.message);
        process.exit(1);
    }
}
