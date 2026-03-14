import { azureNetworkRequest, getAzureResourceGroup } from "../../client";
import type { AZURE_SUBNET } from "../../types";

type Params = {
    deployment_name: string;
    vnet_name: string;
    subnet_name: string;
};

export default async function ({ deployment_name, vnet_name, subnet_name }: Params) {
    const rg = getAzureResourceGroup(deployment_name);

    const res = await azureNetworkRequest<AZURE_SUBNET>(
        `/resourceGroups/${rg}/providers/Microsoft.Network/virtualNetworks/${vnet_name}/subnets/${subnet_name}`
    );

    return { subnet: res.status === 404 ? null : res.data };
}
