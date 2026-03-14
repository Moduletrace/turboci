import { azureNetworkRequest, getAzureResourceGroup } from "../../client";
import type { AZURE_NSG } from "../../types";

type Params = {
    deployment_name: string;
};

export default async function ({ deployment_name }: Params) {
    const rg = getAzureResourceGroup(deployment_name);

    const res = await azureNetworkRequest<{ value: AZURE_NSG[] }>(
        `/resourceGroups/${rg}/providers/Microsoft.Network/networkSecurityGroups`
    );

    return { firewalls: res.data?.value || [] };
}
