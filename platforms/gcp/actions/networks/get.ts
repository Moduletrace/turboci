import getGCPClient from "../../client";
import { gcpGetProject } from "../../types";

type Params = {
    network_name: string;
};

export default async function ({ network_name }: Params) {
    const { GCPCompute } = await getGCPClient();
    const project = gcpGetProject();

    try {
        const res = await GCPCompute.networks.get({
            project,
            network: network_name,
        });
        return { network: res.data };
    } catch (e: any) {
        if (e?.code === 404 || e?.response?.status === 404) {
            return { network: null };
        }
        throw e;
    }
}
