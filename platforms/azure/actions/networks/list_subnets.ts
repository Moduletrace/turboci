import { azureNetworkRequest, getAzureResourceGroup } from "../../client";
import type { AZURE_SUBNET } from "../../types";

type Params = {
    deployment_name: string;
    vnet_name: string;
};

export default async function ({ deployment_name, vnet_name }: Params) {
    const rg = getAzureResourceGroup(deployment_name);

    const res = await azureNetworkRequest<{ value: AZURE_SUBNET[] }>(
        `/resourceGroups/${rg}/providers/Microsoft.Network/virtualNetworks/${vnet_name}/subnets`
    );

    return { subnets: res.data?.value || [] };
}
