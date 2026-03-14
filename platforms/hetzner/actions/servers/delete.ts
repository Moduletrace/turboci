import hetznerQuery from "../../query";

type Params = {
    server_id: string | number;
};

export default async function (params: Params) {
    const res = await hetznerQuery({
        path: "servers",
        id: params.server_id,
        options: {
            method: "DELETE",
        },
    });

    return { server: res?.server };
}
