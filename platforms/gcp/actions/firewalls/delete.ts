import getGCPClient from "../../client";
import { gcpGetProject } from "../../types";

type Params = {
    name: string;
};

export default async function ({ name }: Params) {
    const { GCPCompute } = await getGCPClient();
    const project = gcpGetProject();

    try {
        const res = await GCPCompute.firewalls.delete({
            project,
            firewall: name,
        });
        return { operation: res.data };
    } catch (e: any) {
        if (e?.code === 404 || e?.response?.status === 404) {
            return { operation: null };
        }
        throw e;
    }
}
