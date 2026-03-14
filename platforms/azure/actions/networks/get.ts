import { azureNetworkRequest, getAzureResourceGroup } from "../../client";
import type { AZURE_VNET } from "../../types";

type Params = {
    deployment_name: string;
    network_name: string;
};

export default async function ({ deployment_name, network_name }: Params) {
    const rg = getAzureResourceGroup(deployment_name);

    const res = await azureNetworkRequest<AZURE_VNET>(
        `/resourceGroups/${rg}/providers/Microsoft.Network/virtualNetworks/${network_name}`
    );

    return { network: res.status === 404 ? null : res.data };
}
