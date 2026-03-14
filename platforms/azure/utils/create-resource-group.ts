import { azureRequest, getAzureResourceGroup } from "../client";

type Params = {
    deployment_name: string;
    location: string;
};

export default async function createResourceGroup({
    deployment_name,
    location,
}: Params) {
    const rg = getAzureResourceGroup(deployment_name);

    try {
        const res = await azureRequest(
            `/resourceGroups/${rg}`,
            "PUT",
            { location },
            "2021-04-01"
        );

        return { resource_group: res.data };
    } catch (e: any) {
        if (e?.message?.includes("409") || e?.message?.includes("already exists")) {
            return { resource_group: null };
        }
        throw e;
    }
}
