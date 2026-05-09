import _ from "lodash";
import hetznerQuery from "../../query";
import type { HETZNER_ACTION_RES } from "../../types";

type Params = {
    volume_id: string | number;
};

export default async function (params?: Params) {
    const res = await hetznerQuery<HETZNER_ACTION_RES>({
        path: "volumes",
        body: { ..._.omit(params, ["volume_id"]) },
        options: {
            method: "POST",
        },
        id: params?.volume_id,
        action: "detach",
    });

    return {
        action: res?.action,
        error: res?.error,
    };
}
