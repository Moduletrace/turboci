import hetznerQuery from "../../query";
import type { HETZNER_PRIMARY_IPS } from "../../types";

type Params = {
    primary_ip_id: string | number;
};

export default async function (params: Params) {
    const res = await hetznerQuery<HETZNER_PRIMARY_IPS>({
        path: "primary_ips",
        id: params.primary_ip_id,
    });

    return { primary_ip: res?.primary_ip };
}
