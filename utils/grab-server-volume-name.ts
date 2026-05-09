import type {
    ParsedDeploymentServiceConfig,
    TCIConfigDeployment,
} from "@/types";

type Params = {
    config: Omit<TCIConfigDeployment, "services">;
    service: ParsedDeploymentServiceConfig;
    server_index: number;
    volume_index: number;
};

export default function grabServerVolumeName({
    config,
    service,
    server_index,
    volume_index,
}: Params) {
    const firewall_final_name = `turboci_${config.deployment_name}_${service.service_name}_${server_index}_vol_${volume_index}`;
    return firewall_final_name;
}
