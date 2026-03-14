import hetznerQuery from "../../query";
import type { HETZNER_EXISTING_SERVER } from "../../types";

type Params = {
    server_id: string | number;
};

export default async function (params: Params) {
    const res = await hetznerQuery<HETZNER_EXISTING_SERVER>({
        path: "servers",
        id: params.server_id,
    });

    return { server: res?.server };
}
