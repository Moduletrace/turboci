import hetznerQuery from "../../query";
import type { HETZNER_SERVER_TYPE } from "../../types";

type Params = {
    name?: string;
    page?: number;
    per_page?: number;
};

export default async function (params?: Params) {
    const res = await hetznerQuery<HETZNER_SERVER_TYPE>({
        path: "server_types",
        query_params: { ...params },
    });

    return { meta: res?.meta, server_types: res?.server_types };
}
