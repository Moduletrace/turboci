import _ from "lodash";
import hetznerQuery from "../../query";
import type { HETZNER_NETWORK } from "../../types";
import slugify from "@/utils/slugify";

type Params = {
    primary_ip_id: string | number;
    name?: string;
    labels?: { [k: string]: string };
};

export default async function (params: Params) {
    const res = await hetznerQuery<HETZNER_NETWORK>({
        path: "primary_ips",
        id: params.primary_ip_id,
        body: {
            ..._.omit(params, ["primary_ip_id"]),
            name: params?.name ? slugify(params?.name, "-") : undefined,
        },
        options: {
            method: "PUT",
        },
    });

    return { primary_ip: res?.primary_ip };
}
