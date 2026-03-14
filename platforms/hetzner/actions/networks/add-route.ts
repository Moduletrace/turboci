import _ from "lodash";
import hetznerQuery from "../../query";
import type { HETZNER_NETWORK, HETZNER_NETWORK_ROUTE } from "../../types";

type Params = {
    network_id: string | number;
    route: HETZNER_NETWORK_ROUTE;
};

export default async function (params: Params) {
    const res = await hetznerQuery<HETZNER_NETWORK>({
        path: "networks",
        id: params.network_id,
        body: { ...params.route },
        options: {
            method: "POST",
        },
        action: "add_route",
    });

    return { action: res?.action };
}
