import getGCPClient from "../../client";
import { gcpGetProject } from "../../types";

type Params = {
    name?: string;
};

export default async function (params?: Params) {
    const { GCPCompute } = await getGCPClient();
    const project = gcpGetProject();

    const res = await GCPCompute.networks.list({
        project,
        filter: params?.name ? `name = "${params.name}"` : undefined,
    });

    return { networks: res.data.items || [] };
}
