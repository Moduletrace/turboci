import _ from "lodash";
import hetznerQuery from "../../query";
import type { HETZNER_NETWORK } from "../../types";

type Params = {
    network_id: string | number;
    name?: string;
    expose_routes_to_vswitch?: boolean;
};

export default async function (params: Params) {
    const res = await hetznerQuery<HETZNER_NETWORK>({
        path: "networks",
        id: params.network_id,
        body: { ..._.omit(params, ["network_id"]) },
        options: {
            method: "PUT",
        },
    });

    return { network: res?.network };
}
