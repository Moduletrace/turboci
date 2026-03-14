import slugify from "@/utils/slugify";
import hetznerQuery from "../../query";
import type { HETZNER_EXISTING_SERVER, HetznerServerStatus } from "../../types";

type Params = {
    name?: string;
    /** Eg. id:asc,name:asc */
    sort?: string;
    label_selector?: string;
    status?: (typeof HetznerServerStatus)[number];
    // page?: number;
    // per_page?: number;
};

export default async function (params?: Params) {
    const res = await hetznerQuery<HETZNER_EXISTING_SERVER>({
        path: "servers",
        query_params: {
            ...params,
            name: params?.name ? slugify(params?.name, "-") : undefined,
        },
    });

    let finalServers = res?.servers;

    if (!finalServers?.[0]) {
        return { meta: res?.meta, servers: undefined };
    }

    if (
        res?.meta?.pagination?.total_entries &&
        res?.meta.pagination.per_page &&
        res.meta.pagination.total_entries > res.meta.pagination.per_page
    ) {
        const pages = Math.ceil(
            res.meta.pagination.total_entries / res.meta.pagination.per_page
        );

        for (let i = 0; i < pages; i++) {
            if (i == 0) continue;

            const newPageRes = await hetznerQuery<HETZNER_EXISTING_SERVER>({
                path: "servers",
                query_params: {
                    ...params,
                    name: params?.name ? slugify(params?.name, "-") : undefined,
                    page: i + 1,
                } as Params,
            });

            if (newPageRes?.servers?.[0]) {
                finalServers.push(...newPageRes.servers);
            }
        }
    }

    return { meta: res?.meta, servers: res?.servers };
}
