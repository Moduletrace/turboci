import { azureComputeRequest, getAzureResourceGroup } from "../../client";
import type { AZURE_VM } from "../../types";

type Params = {
    deployment_name: string;
    tags?: { [k: string]: string };
};

export default async function ({ deployment_name, tags }: Params) {
    const rg = getAzureResourceGroup(deployment_name);

    const res = await azureComputeRequest<{ value: AZURE_VM[] }>(
        `/resourceGroups/${rg}/providers/Microsoft.Compute/virtualMachines`
    );

    let servers = res.data?.value || [];

    if (tags) {
        servers = servers.filter((vm) => {
            if (!vm.tags) return false;
            return Object.entries(tags).every(
                ([key, value]) => vm.tags?.[key] === value
            );
        });
    }

    return { servers };
}
