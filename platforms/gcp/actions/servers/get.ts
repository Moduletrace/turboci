import getGCPClient from "../../client";
import { gcpGetProject } from "../../types";

type Params = {
    zone: string;
    name: string;
};

export default async function ({ zone, name }: Params) {
    const { GCPCompute } = await getGCPClient();
    const project = gcpGetProject();

    try {
        const res = await GCPCompute.instances.get({
            project,
            zone,
            instance: name,
        });
        return { server: res.data };
    } catch (e: any) {
        if (e?.code === 404 || e?.response?.status === 404) {
            return { server: null };
        }
        throw e;
    }
}
