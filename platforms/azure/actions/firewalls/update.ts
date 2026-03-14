import { azureNetworkRequest, getAzureResourceGroup } from "../../client";
import type { AZURE_NSG } from "../../types";

type Params = {
    deployment_name: string;
    name: string;
    tags?: { [k: string]: string };
};

export default async function ({ deployment_name, name, tags }: Params) {
    const rg = getAzureResourceGroup(deployment_name);

    const current = await azureNetworkRequest<AZURE_NSG>(
        `/resourceGroups/${rg}/providers/Microsoft.Network/networkSecurityGroups/${name}`
    );

    const res = await azureNetworkRequest<AZURE_NSG>(
        `/resourceGroups/${rg}/providers/Microsoft.Network/networkSecurityGroups/${name}`,
        "PUT",
        {
            ...current.data,
            tags: { ...current.data?.tags, ...tags },
        }
    );

    return { firewall: res.data };
}
