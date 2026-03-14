import { azureNetworkRequest, getAzureResourceGroup } from "../../client";
import type { AZURE_VNET } from "../../types";

type Params = {
    deployment_name: string;
};

export default async function ({ deployment_name }: Params) {
    const rg = getAzureResourceGroup(deployment_name);

    const res = await azureNetworkRequest<{ value: AZURE_VNET[] }>(
        `/resourceGroups/${rg}/providers/Microsoft.Network/virtualNetworks`
    );

    return { networks: res.data?.value || [] };
}
