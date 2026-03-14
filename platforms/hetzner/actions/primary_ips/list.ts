import _ from "lodash";
import hetznerQuery from "../../query";
import type { HETZNER_FIREWALL, HETZNER_PRIMARY_IPS } from "../../types";
import slugify from "@/utils/slugify";

type Params = {
    name?: string;
    /** Eg. id:asc,name:asc */
    sort?: string;
    label_selector?: string;
    page?: number;
    per_page?: number;
};

export default async function (params?: Params) {
    const res = await hetznerQuery<HETZNER_PRIMARY_IPS>({
        path: "primary_ips",
        query_params: {
            ...params,
            name: slugify(params?.name, "-"),
        },
    });

    return res;
}
