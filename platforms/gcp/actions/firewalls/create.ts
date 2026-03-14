import getGCPClient from "../../client";
import { gcpGetProject, gcpNetworkUrl } from "../../types";

type AllowedRule = {
    protocol: string;
    ports?: string[];
};

type Params = {
    name: string;
    network_name: string;
    allowed: AllowedRule[];
    source_ranges?: string[];
    target_tags?: string[];
    description?: string;
};

export default async function ({
    name,
    network_name,
    allowed,
    source_ranges,
    target_tags,
    description,
}: Params) {
    const { GCPCompute } = await getGCPClient();
    const project = gcpGetProject();

    const res = await GCPCompute.firewalls.insert({
        project,
        requestBody: {
            name,
            network: gcpNetworkUrl(network_name),
            allowed: allowed.map((rule) => ({
                IPProtocol: rule.protocol,
                ports: rule.ports,
            })),
            sourceRanges: source_ranges,
            targetTags: target_tags,
            description,
            direction: "INGRESS",
        },
    });

    return { firewall: res.data };
}
