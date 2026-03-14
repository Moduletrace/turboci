import { azureNetworkRequest, getAzureResourceGroup } from "../../client";

type Params = {
    deployment_name: string;
    network_name: string;
};

export default async function ({ deployment_name, network_name }: Params) {
    const rg = getAzureResourceGroup(deployment_name);

    const res = await azureNetworkRequest(
        `/resourceGroups/${rg}/providers/Microsoft.Network/virtualNetworks/${network_name}`,
        "DELETE"
    );

    return { status: res.status };
}
