import hetznerQuery from "../../query";
import type { HETZNER_VOLUME } from "../../types";

type Params = {
    volume_id: string | number;
};

export default async function (params: Params) {
    const res = await hetznerQuery<HETZNER_VOLUME>({
        path: "volumes",
        id: params.volume_id,
    });

    return { volume: res?.volume };
}
