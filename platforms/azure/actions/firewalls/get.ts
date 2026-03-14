import { azureNetworkRequest, getAzureResourceGroup } from "../../client";
import type { AZURE_NSG } from "../../types";

type Params = {
    deployment_name: string;
    name: string;
};

export default async function ({ deployment_name, name }: Params) {
    const rg = getAzureResourceGroup(deployment_name);

    const res = await azureNetworkRequest<AZURE_NSG>(
        `/resourceGroups/${rg}/providers/Microsoft.Network/networkSecurityGroups/${name}`
    );

    return { firewall: res.status === 404 ? null : res.data };
}
