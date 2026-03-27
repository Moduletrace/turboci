import type { TCIConfigServiceConfig, TCIServiceTypes } from "@/types";

type Params = {
    service: TCIConfigServiceConfig;
};

export default function isServiceLoadBalancerType({ service }: Params) {
    const service_type = service.type || "default";

    const is_load_balancer_type = (
        [
            "load_balancer",
            "haproxy",
            "proxysql",
        ] as (typeof TCIServiceTypes)[number]["value"][]
    ).includes(service_type);

    return is_load_balancer_type;
}
