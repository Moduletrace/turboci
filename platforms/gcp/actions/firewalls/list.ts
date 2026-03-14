import getGCPClient from "../../client";
import { gcpGetProject } from "../../types";

type Params = {
    name?: string;
    network_name?: string;
};

export default async function (params?: Params) {
    const { GCPCompute } = await getGCPClient();
    const project = gcpGetProject();

    const filterParts: string[] = [];

    if (params?.name) {
        filterParts.push(`name = "${params.name}"`);
    }

    if (params?.network_name) {
        filterParts.push(
            `network = "projects/${project}/global/networks/${params.network_name}"`
        );
    }

    const res = await GCPCompute.firewalls.list({
        project,
        filter: filterParts.length > 0 ? filterParts.join(" AND ") : undefined,
    });

    return { firewalls: res.data.items || [] };
}
