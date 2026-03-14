import hetznerQuery from "../../query";
import type { HETZNER_SSH_KEY } from "../../types";

type Params = {
    ssh_key_id: string | number;
};

export default async function (params: Params) {
    const res = await hetznerQuery<HETZNER_SSH_KEY>({
        path: "ssh_keys",
        id: params.ssh_key_id,
    });

    return { ssh_key: res?.ssh_key };
}
