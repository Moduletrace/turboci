import _ from "lodash";
import hetznerQuery from "../../query";
import type { HETZNER_NETWORK } from "../../types";

type Params = {
    name?: string;
    /** Eg. id:asc,name:asc */
    sort?: string;
    label_selector?: string;
    page?: number;
    per_page?: number;
};

export default async function (params?: Params) {
    const res = await hetznerQuery<HETZNER_NETWORK>({
        path: "networks",
        query_params: { ...params },
    });

    return { meta: res?.meta, networks: res?.networks };
}
