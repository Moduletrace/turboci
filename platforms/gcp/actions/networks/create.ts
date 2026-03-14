import getGCPClient from "../../client";
import { gcpGetProject } from "../../types";

type Params = {
    name: string;
    labels?: { [k: string]: string };
};

export default async function ({ name, labels }: Params) {
    const { GCPCompute } = await getGCPClient();
    const project = gcpGetProject();

    await GCPCompute.networks.insert({
        project,
        requestBody: {
            name,
            autoCreateSubnetworks: false,
            routingConfig: { routingMode: "REGIONAL" },
        },
    });

    // Fetch the created network
    let network = null;
    for (let i = 0; i < 15; i++) {
        try {
            const getRes = await GCPCompute.networks.get({ project, network: name });
            if (getRes.data?.name) {
                network = getRes.data;
                break;
            }
        } catch (_e) {}
        await Bun.sleep(2000);
    }

    return { network };
}
