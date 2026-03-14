import hetznerQuery from "../../query";

type Params = {
    ssh_key_id: string | number;
};

export default async function (params: Params) {
    const res = await hetznerQuery({
        path: "ssh_keys",
        id: params.ssh_key_id,
        options: {
            method: "DELETE",
        },
    });

    return { ssh_key: res?.ssh_key };
}
