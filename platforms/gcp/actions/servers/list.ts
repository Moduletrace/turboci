import getGCPClient from "../../client";
import { gcpGetProject } from "../../types";

type Params = {
    zone: string;
    name?: string;
    labels?: { [k: string]: string };
};

export default async function ({ zone, name, labels }: Params) {
    const { GCPCompute } = await getGCPClient();
    const project = gcpGetProject();

    const filterParts: string[] = [];

    if (labels) {
        for (const [key, value] of Object.entries(labels)) {
            filterParts.push(`(labels.${key} = "${value}")`);
        }
    }

    if (name) {
        filterParts.push(`(name = "${name}")`);
    }

    const res = await GCPCompute.instances.list({
        project,
        zone,
        filter: filterParts.length > 0 ? filterParts.join(" AND ") : undefined,
    });

    return { servers: res.data.items || [] };
}
