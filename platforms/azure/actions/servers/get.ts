import { azureComputeRequest, getAzureResourceGroup } from "../../client";
import type { AZURE_VM } from "../../types";

type Params = {
    deployment_name: string;
    name: string;
};

export default async function ({ deployment_name, name }: Params) {
    const rg = getAzureResourceGroup(deployment_name);

    const res = await azureComputeRequest<AZURE_VM>(
        `/resourceGroups/${rg}/providers/Microsoft.Compute/virtualMachines/${name}`
    );

    return { server: res.status === 404 ? null : res.data };
}
