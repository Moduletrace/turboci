import { azureNetworkRequest, getAzureResourceGroup } from "../../client";
import type { AZURE_VNET } from "../../types";

type Params = {
    deployment_name: string;
    network_name: string;
    location: string;
    address_prefix?: string;
    tags?: { [k: string]: string };
};

export default async function ({
    deployment_name,
    network_name,
    location,
    address_prefix = "10.0.0.0/16",
    tags,
}: Params) {
    const rg = getAzureResourceGroup(deployment_name);

    const res = await azureNetworkRequest<AZURE_VNET>(
        `/resourceGroups/${rg}/providers/Microsoft.Network/virtualNetworks/${network_name}`,
        "PUT",
        {
            location,
            tags,
            properties: {
                addressSpace: {
                    addressPrefixes: [address_prefix],
                },
            },
        }
    );

    return { network: res.status === 404 ? null : res.data };
}
