import hetznerQuery from "../../query";
import type { HETZNER_SSH_KEY, HetznerServerStatus } from "../../types";

type Params = {
    name?: string;
    /** Eg. id:asc,name:asc */
    sort?: string;
    label_selector?: string;
    status?: (typeof HetznerServerStatus)[number];
    fingerprint?: string;
    page?: number;
    per_page?: number;
};

export default async function (params?: Params) {
    const res = await hetznerQuery<HETZNER_SSH_KEY>({
        path: "ssh_keys",
        query_params: { ...params },
    });

    return { meta: res?.meta, ssh_keys: res?.ssh_keys };
}
