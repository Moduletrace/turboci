import _ from "lodash";
import hetznerQuery from "../../query";
import type { HETZNER_SSH_KEY } from "../../types";

type Params = {
    ssh_key_id: string | number;
    name?: string;
    labels?: { [k: string]: any };
};

export default async function (params?: Params) {
    const res = await hetznerQuery<HETZNER_SSH_KEY>({
        path: "ssh_keys",
        body: { ..._.omit(params, ["ssh_key_id"]) },
        options: {
            method: "PUT",
        },
        id: params?.ssh_key_id,
    });

    return { ssh_key: res?.ssh_key };
}
