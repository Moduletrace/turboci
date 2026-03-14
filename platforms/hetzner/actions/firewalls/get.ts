import hetznerQuery from "../../query";
import type { HETZNER_FIREWALL } from "../../types";

type Params = {
    firewall_id: string | number;
};

export default async function (params: Params) {
    const res = await hetznerQuery<HETZNER_FIREWALL>({
        path: "firewalls",
        id: params.firewall_id,
    });

    return { firewall: res?.firewall };
}
