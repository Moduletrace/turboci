import { azureComputeRequest, getAzureResourceGroup } from "../../client";
import type { AZURE_VM } from "../../types";

type Params = {
    deployment_name: string;
    name: string;
    tags?: { [k: string]: string };
};

export default async function ({ deployment_name, name, tags }: Params) {
    const rg = getAzureResourceGroup(deployment_name);

    const current = await azureComputeRequest<AZURE_VM>(
        `/resourceGroups/${rg}/providers/Microsoft.Compute/virtualMachines/${name}`
    );

    const res = await azureComputeRequest<AZURE_VM>(
        `/resourceGroups/${rg}/providers/Microsoft.Compute/virtualMachines/${name}`,
        "PATCH",
        { tags: { ...current.data?.tags, ...tags } }
    );

    return { server: res.data };
}
