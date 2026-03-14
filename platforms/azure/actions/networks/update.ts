import { azureNetworkRequest, getAzureResourceGroup } from "../../client";
import type { AZURE_VNET } from "../../types";

type Params = {
    deployment_name: string;
    network_name: string;
    tags?: { [k: string]: string };
};

export default async function ({ deployment_name, network_name, tags }: Params) {
    const rg = getAzureResourceGroup(deployment_name);

    // Get current state first
    const current = await azureNetworkRequest<AZURE_VNET>(
        `/resourceGroups/${rg}/providers/Microsoft.Network/virtualNetworks/${network_name}`
    );

    const res = await azureNetworkRequest<AZURE_VNET>(
        `/resourceGroups/${rg}/providers/Microsoft.Network/virtualNetworks/${network_name}`,
        "PUT",
        {
            ...current.data,
            tags: { ...current.data?.tags, ...tags },
        }
    );

    return { network: res.data };
}
