import { azureNetworkRequest, getAzureResourceGroup } from "../../client";
import type { AZURE_PUBLIC_IP } from "../../types";

type Params = {
    deployment_name: string;
    name: string;
    location: string;
    tags?: { [k: string]: string };
};

export default async function ({ deployment_name, name, location, tags }: Params) {
    const rg = getAzureResourceGroup(deployment_name);

    const res = await azureNetworkRequest<AZURE_PUBLIC_IP>(
        `/resourceGroups/${rg}/providers/Microsoft.Network/publicIPAddresses/${name}`,
        "PUT",
        {
            location,
            tags,
            sku: { name: "Standard" },
            properties: {
                publicIPAllocationMethod: "Static",
            },
        }
    );

    return { public_ip: res.data };
}
