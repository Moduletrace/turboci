import _ from "lodash";
import hetznerQuery from "../../query";
import type { HETZNER_NETWORK } from "../../types";
import slugify from "@/utils/slugify";

type Params = {
    firewall_id: string | number;
    name?: string;
    labels?: { [k: string]: string };
};

export default async function (params: Params) {
    const res = await hetznerQuery<HETZNER_NETWORK>({
        path: "firewalls",
        id: params.firewall_id,
        body: {
            ..._.omit(params, ["firewall_id"]),
            name: params?.name ? slugify(params?.name, "-") : undefined,
        },
        options: {
            method: "PUT",
        },
    });

    return { firewall: res?.firewall };
}
