import { azureNetworkRequest, getAzureResourceGroup } from "../../client";
import type { AZURE_PUBLIC_IP } from "../../types";

type Params = {
    deployment_name: string;
    name: string;
};

export default async function ({ deployment_name, name }: Params) {
    const rg = getAzureResourceGroup(deployment_name);

    const res = await azureNetworkRequest<AZURE_PUBLIC_IP>(
        `/resourceGroups/${rg}/providers/Microsoft.Network/publicIPAddresses/${name}`
    );

    return { public_ip: res.status === 404 ? null : res.data };
}
