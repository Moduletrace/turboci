import slugify from "@/utils/slugify";
import hetznerQuery from "../../query";
import type { HETZNER_VOLUME } from "../../types";

type Params = {
    name: string;
    location: string;
    server_id?: string | number;
    size: number;
    labels?: { [k: string]: any };
};

export default async function (params: Params) {
    const res = await hetznerQuery<HETZNER_VOLUME>({
        path: "volumes",
        body: {
            ...params,
            name: slugify(params.name, "-"),
            automount: false,
        },
        options: { method: "POST" },
    });

    return {
        volume: res?.volume,
        error: res?.error,
    };
}
