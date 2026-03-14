import getGCPClient from "../../client";
import { gcpGetProject } from "../../types";
import type { compute_v1 } from "googleapis";

type Params = {
    name: string;
    allowed?: { protocol: string; ports?: string[] }[];
    source_ranges?: string[];
    target_tags?: string[];
    description?: string;
};

export default async function ({
    name,
    allowed,
    source_ranges,
    target_tags,
    description,
}: Params) {
    const { GCPCompute } = await getGCPClient();
    const project = gcpGetProject();

    const requestBody: compute_v1.Schema$Firewall = {};

    if (allowed) {
        requestBody.allowed = allowed.map((rule) => ({
            IPProtocol: rule.protocol,
            ports: rule.ports,
        }));
    }

    if (source_ranges) requestBody.sourceRanges = source_ranges;
    if (target_tags) requestBody.targetTags = target_tags;
    if (description) requestBody.description = description;

    const res = await GCPCompute.firewalls.patch({
        project,
        firewall: name,
        requestBody,
    });

    return { operation: res.data };
}
