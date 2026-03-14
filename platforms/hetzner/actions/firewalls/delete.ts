import hetznerQuery from "../../query";

type Params = {
    firewall_id: string | number;
};

export default async function (params: Params) {
    const res = await hetznerQuery({
        path: "firewalls",
        id: params.firewall_id,
        options: {
            method: "DELETE",
        },
    });

    return { firewall: res?.firewall };
}
