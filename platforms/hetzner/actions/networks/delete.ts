import hetznerQuery from "../../query";
import type { HETZNER_NETWORK } from "../../types";

type Params = {
    network_id: string | number;
};

export default async function (params: Params) {
    const res = await hetznerQuery<HETZNER_NETWORK>({
        path: "networks",
        id: params.network_id,
        options: {
            method: "DELETE",
        },
    });

    return { network: res?.network };
}
