import slugify from "@/utils/slugify";
import hetznerQuery from "../../query";
import type {
    HETZNER_FIREWALL,
    HETZNER_FIREWALL_APPLIED_TO,
    HETZNER_FIREWALL_RULE,
} from "../../types";

type Params = {
    name: string;
    labels?: { [k: string]: string };
    rules?: HETZNER_FIREWALL_RULE[];
    apply_to?: HETZNER_FIREWALL_APPLIED_TO[];
};

export default async function (params: Params) {
    const res = await hetznerQuery<HETZNER_FIREWALL>({
        path: "firewalls",
        body: { ...params, name: slugify(params.name, "-") },
        options: {
            method: "POST",
        },
    });

    return { firewall: res?.firewall };
}
