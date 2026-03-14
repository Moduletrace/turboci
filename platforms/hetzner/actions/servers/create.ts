import slugify from "@/utils/slugify";
import hetznerQuery from "../../query";
import type {
    HETZNER_CREATE_SERVER_BODY_PUBLIC_NET,
    HETZNER_EXISTING_SERVER,
    HetznerLocations,
} from "../../types";
import type { HetznerDatacenters } from "../../types/datacenters";
import type { HetznerImages } from "../../types/images";
import type { HetznerServerTypes } from "../../types/server-types";

type Params = {
    name: string;
    server_type: (typeof HetznerServerTypes)[number]["name"];
    location?: (typeof HetznerLocations)[number]["name"];
    datacenter?: (typeof HetznerDatacenters)[number]["name"];
    image?: (typeof HetznerImages)[number]["name"];
    start_after_create?: boolean;
    placement_group?: number;
    ssh_keys?: string[];
    volumes?: number[];
    networks?: number[];
    firewalls?: { firewall: number }[];
    user_data?: string;
    labels?: { [k: string]: any };
    automount?: boolean;
    public_net?: HETZNER_CREATE_SERVER_BODY_PUBLIC_NET;
};

export default async function (params: Params) {
    const res = await hetznerQuery<HETZNER_EXISTING_SERVER>({
        path: "servers",
        body: {
            ...params,
            name: slugify(params.name, "-"),
        },
        options: {
            method: "POST",
        },
    });

    return {
        server: res?.server,
        error: res?.error,
    };
}
