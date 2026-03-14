import getGCPClient from "../../client";
import { gcpGetProject } from "../../types";

type Params = {
    zone: string;
    name: string;
    labels: { [k: string]: string };
};

export default async function ({ zone, name, labels }: Params) {
    const { GCPCompute } = await getGCPClient();
    const project = gcpGetProject();

    // Get current label fingerprint (required by GCP setLabels API)
    const currentInstance = await GCPCompute.instances.get({
        project,
        zone,
        instance: name,
    });

    const labelFingerprint = currentInstance.data.labelFingerprint || "";

    const res = await GCPCompute.instances.setLabels({
        project,
        zone,
        instance: name,
        requestBody: {
            labels,
            labelFingerprint,
        },
    });

    return { operation: res.data };
}
