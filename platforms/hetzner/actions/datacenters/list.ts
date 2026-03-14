import hetznerQuery from "../../query";
import type {
    HETZNER_LOCATION,
    HETZNER_NEW_SERVER_DATACENTER,
} from "../../types";

type Params = {
    name?: string;
    /** Allowed: id id:asc id:desc name name:asc name:desc */
    sort?: string;
    page?: number;
    per_page?: number;
};

export default async function (params?: Params) {
    const res = await hetznerQuery<HETZNER_NEW_SERVER_DATACENTER>({
        path: "datacenters",
        query_params: { ...params },
    });

    return {
        meta: res?.meta,
        datacenters: res?.datacenters,
        recommendation: res?.recommendation,
    };
}
