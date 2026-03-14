import { azureNetworkRequest, getAzureResourceGroup } from "../../client";

type Params = {
    deployment_name: string;
    name: string;
};

export default async function ({ deployment_name, name }: Params) {
    const rg = getAzureResourceGroup(deployment_name);

    const res = await azureNetworkRequest(
        `/resourceGroups/${rg}/providers/Microsoft.Network/publicIPAddresses/${name}`,
        "DELETE"
    );

    return { status: res.status };
}
