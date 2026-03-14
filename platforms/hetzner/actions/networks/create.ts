import hetznerQuery from "../../query";
import type {
    HETZNER_NETWORK,
    HETZNER_NETWORK_ROUTE,
    HETZNER_NETWORK_SUBNET,
} from "../../types";

type Params = {
    name: string;
    ip_range?: string;
    labels?: { [k: string]: string };
    subnets?: HETZNER_NETWORK_SUBNET[];
    routes?: HETZNER_NETWORK_ROUTE[];
    expose_routes_to_vswitch?: boolean;
};

export default async function (params: Params) {
    const res = await hetznerQuery<HETZNER_NETWORK>({
        path: "networks",
        body: { ...params },
        options: {
            method: "POST",
            headers: { "Content-Type": "application/json" },
        },
    });

    return { meta: res?.meta, network: res?.network };
}
