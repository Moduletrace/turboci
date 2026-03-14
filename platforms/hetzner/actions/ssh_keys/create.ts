import hetznerQuery from "../../query";
import type { HETZNER_SSH_KEY } from "../../types";

type Params = {
    name: string;
    public_key: string;
    labels?: { [k: string]: any };
};

export default async function (params?: Params) {
    const res = await hetznerQuery<HETZNER_SSH_KEY>({
        path: "ssh_keys",
        body: { ...params },
        options: {
            method: "POST",
        },
    });

    return { ssh_key: res?.ssh_key };
}
