import type { TCIConfigDeployment } from "@/types";

type Params = {
    firewall_name: string;
    config: Omit<TCIConfigDeployment, "services">;
};

export default function grabFirewallName({ config, firewall_name }: Params) {
    const firewall_final_name = `turboci_${config.deployment_name}_${firewall_name}_firewall`;
    return firewall_final_name;
}
