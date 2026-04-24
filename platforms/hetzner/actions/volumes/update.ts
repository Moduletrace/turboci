import _ from "lodash";
import hetznerQuery from "../../query";
import type { HETZNER_VOLUME } from "../../types";

type Params = {
    volume_id: string | number;
    name?: string;
    labels?: { [k: string]: any };
};

export default async function (params?: Params) {
    const res = await hetznerQuery<HETZNER_VOLUME>({
        path: "volumes",
        body: { ..._.omit(params, ["volume_id"]) },
        options: {
            method: "PUT",
        },
        id: params?.volume_id,
    });

    return { volume: res?.volume };
}
