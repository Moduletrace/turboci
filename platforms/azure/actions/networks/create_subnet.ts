import { azureNetworkRequest, getAzureResourceGroup } from "../../client";
import type { AZURE_SUBNET } from "../../types";

type Params = {
    deployment_name: string;
    vnet_name: string;
    subnet_name: string;
    address_prefix: string;
    nsg_id?: string;
};

export default async function ({
    deployment_name,
    vnet_name,
    subnet_name,
    address_prefix,
    nsg_id,
}: Params) {
    const rg = getAzureResourceGroup(deployment_name);

    const properties: any = { addressPrefix: address_prefix };

    if (nsg_id) {
        properties.networkSecurityGroup = { id: nsg_id };
    }

    const res = await azureNetworkRequest<AZURE_SUBNET>(
        `/resourceGroups/${rg}/providers/Microsoft.Network/virtualNetworks/${vnet_name}/subnets/${subnet_name}`,
        "PUT",
        { properties }
    );

    return { subnet: res.data };
}
