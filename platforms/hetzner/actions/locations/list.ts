import hetznerQuery from "../../query";
import type { HETZNER_LOCATION } from "../../types";

type Params = { name?: string };

export default async function (params?: Params) {
    const res = await hetznerQuery<HETZNER_LOCATION>({
        path: "locations",
        query_params: { ...params },
    });

    return { meta: res?.meta, locations: res?.locations };
}
