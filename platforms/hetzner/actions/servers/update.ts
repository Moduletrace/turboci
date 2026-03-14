import _ from "lodash";
import hetznerQuery from "../../query";
import type { HETZNER_EXISTING_SERVER } from "../../types";

type Params = {
    server_id: string | number;
    name?: string;
    labels?: { [k: string]: any };
};

export default async function (params?: Params) {
    const res = await hetznerQuery<HETZNER_EXISTING_SERVER>({
        path: "servers",
        body: { ..._.omit(params, ["server_id"]) },
        options: {
            method: "PUT",
        },
        id: params?.server_id,
    });

    return { server: res?.server };
}
