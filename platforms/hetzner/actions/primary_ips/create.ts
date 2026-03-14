import slugify from "@/utils/slugify";
import hetznerQuery from "../../query";
import type { HETZNER_PRIMARY_IPS } from "../../types";

type Params = {
    name: string;
    labels?: { [k: string]: string };
};

export default async function (params: Params) {
    const res = await hetznerQuery<HETZNER_PRIMARY_IPS>({
        path: "primary_ips",
        body: { ...params, name: slugify(params.name, "-") },
        options: {
            method: "POST",
        },
    });

    return { primary_ip: res?.primary_ip };
}
