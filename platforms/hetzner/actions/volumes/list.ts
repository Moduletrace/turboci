import slugify from "@/utils/slugify";
import hetznerQuery from "../../query";
import type { HETZNER_VOLUME } from "../../types";

type Params = {
    name?: string;
    /**
     * Eg. id:asc,name:asc
     */
    sort?: string;
    label_selector?: string;
};

export default async function (params?: Params) {
    const res = await hetznerQuery<HETZNER_VOLUME>({
        path: "volumes",
        query_params: {
            ...params,
            name: params?.name ? slugify(params?.name, "-") : undefined,
        },
    });

    let volumes = res?.volumes;

    if (!volumes?.[0]) {
        return {
            meta: res?.meta,
            volumes: undefined,
        };
    }

    if (
        res?.meta?.pagination?.total_entries &&
        res?.meta.pagination.per_page &&
        res.meta.pagination.total_entries > res.meta.pagination.per_page
    ) {
        const pages = Math.ceil(
            res.meta.pagination.total_entries / res.meta.pagination.per_page,
        );

        for (let i = 0; i < pages; i++) {
            if (i == 0) continue;

            const newPageRes = await hetznerQuery<HETZNER_VOLUME>({
                path: "volumes",
                query_params: {
                    ...params,
                    name: params?.name ? slugify(params?.name, "-") : undefined,
                    page: i + 1,
                } as Params,
            });

            if (newPageRes?.volumes?.[0]) {
                volumes.push(...newPageRes.volumes);
            }
        }
    }

    return { meta: res?.meta, volumes: res?.volumes };
}
