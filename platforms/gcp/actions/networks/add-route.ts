import getGCPClient from "../../client";
import { gcpGetProject, gcpNetworkUrl } from "../../types";

type Params = {
    route_name: string;
    network_name: string;
    dest_range: string;
    next_hop_instance: string;
    priority?: number;
    tags?: string[];
};

export default async function ({
    route_name,
    network_name,
    dest_range,
    next_hop_instance,
    priority = 1000,
    tags,
}: Params) {
    const { GCPCompute } = await getGCPClient();
    const project = gcpGetProject();

    // Resolve next_hop_instance to a full URL if it's not already
    const nextHopInstanceUrl = next_hop_instance.startsWith("projects/")
        ? `https://www.googleapis.com/compute/v1/${next_hop_instance}`
        : next_hop_instance.startsWith("zones/")
        ? `https://www.googleapis.com/compute/v1/projects/${project}/${next_hop_instance}`
        : next_hop_instance;

    const res = await GCPCompute.routes.insert({
        project,
        requestBody: {
            name: route_name,
            network: gcpNetworkUrl(network_name),
            destRange: dest_range,
            nextHopInstance: nextHopInstanceUrl,
            priority,
            tags,
        },
    });

    return { operation: res.data };
}
