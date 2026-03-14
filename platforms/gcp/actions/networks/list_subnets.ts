import getGCPClient from "../../client";
import { gcpGetProject } from "../../types";

type Params = {
    region: string;
    network_name?: string;
};

export default async function ({ region, network_name }: Params) {
    const { GCPCompute } = await getGCPClient();
    const project = gcpGetProject();

    const filter = network_name
        ? `network = "projects/${project}/global/networks/${network_name}"`
        : undefined;

    const res = await GCPCompute.subnetworks.list({
        project,
        region,
        filter,
    });

    return { subnets: res.data.items || [] };
}
