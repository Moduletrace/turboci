import getGCPClient from "../../client";
import { gcpGetProject, gcpNetworkUrl } from "../../types";

type Params = {
    subnet_name: string;
    network_name: string;
    region: string;
    ip_cidr_range?: string;
};

export default async function ({
    subnet_name,
    network_name,
    region,
    ip_cidr_range = "10.0.0.0/20",
}: Params) {
    const { GCPCompute } = await getGCPClient();
    const project = gcpGetProject();

    await GCPCompute.subnetworks.insert({
        project,
        region,
        requestBody: {
            name: subnet_name,
            network: gcpNetworkUrl(network_name),
            ipCidrRange: ip_cidr_range,
        },
    });

    // Fetch the created subnet
    let subnet = null;
    for (let i = 0; i < 15; i++) {
        try {
            const getRes = await GCPCompute.subnetworks.get({
                project,
                region,
                subnetwork: subnet_name,
            });
            if (getRes.data?.name) {
                subnet = getRes.data;
                break;
            }
        } catch (_e) {}
        await Bun.sleep(2000);
    }

    return { subnet };
}
