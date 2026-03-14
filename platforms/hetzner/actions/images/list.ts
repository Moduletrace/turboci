import hetznerQuery from "../../query";
import type { HETZNER_OS_IMAGE } from "../../types";

type Params = {
    filter_fn?: (images: HETZNER_OS_IMAGE[]) => Promise<HETZNER_OS_IMAGE[]>;
};

export default async function (params?: Params) {
    const res = await hetznerQuery<HETZNER_OS_IMAGE>({
        path: "images",
    });

    return {
        meta: res?.meta,
        images:
            params?.filter_fn && res?.images
                ? await params.filter_fn(res?.images)
                : res?.images,
    };
}
