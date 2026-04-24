import type { TCIConfigDeployment } from "@/types";

type Params = {
    volume_name: string;
    config: Omit<TCIConfigDeployment, "services">;
};

export default function grabVolumeName({ config, volume_name }: Params) {
    const firewall_final_name = `turboci_${config.deployment_name}_${volume_name}_volume`;
    return firewall_final_name;
}
