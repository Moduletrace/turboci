import hetznerQuery from "../../query";

type Params = {
    volume_id: string | number;
};

export default async function (params: Params) {
    const res = await hetznerQuery({
        path: "volumes",
        id: params.volume_id,
        options: { method: "DELETE" },
    });

    return { volume: res?.volume };
}
