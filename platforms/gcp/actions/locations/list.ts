import getGCPClient from "../../client";
import { gcpGetProject } from "../../types";

export default async function () {
    const { GCPCompute } = await getGCPClient();
    const project = gcpGetProject();

    const res = await GCPCompute.regions.list({ project });

    return { locations: res.data.items || [] };
}
