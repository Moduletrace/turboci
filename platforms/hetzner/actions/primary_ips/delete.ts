import hetznerQuery from "../../query";

type Params = {
    primary_ip_id: string | number;
};

export default async function (params: Params) {
    const res = await hetznerQuery({
        path: "primary_ips",
        id: params.primary_ip_id,
        options: {
            method: "DELETE",
        },
    });

    return { primary_ip: res?.primary_ip };
}
