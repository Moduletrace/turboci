import { azureNetworkRequest, getAzureResourceGroup } from "../../client";
import type { AZURE_ROUTE_TABLE } from "../../types";

type Params = {
    deployment_name: string;
    name: string;
    location: string;
    next_hop_ip: string;
    tags?: { [k: string]: string };
};

export default async function ({
    deployment_name,
    name,
    location,
    next_hop_ip,
    tags,
}: Params) {
    const rg = getAzureResourceGroup(deployment_name);

    const res = await azureNetworkRequest<AZURE_ROUTE_TABLE>(
        `/resourceGroups/${rg}/providers/Microsoft.Network/routeTables/${name}`,
        "PUT",
        {
            location,
            tags,
            properties: {
                routes: [
                    {
                        name: "turboci-nat-route",
                        properties: {
                            addressPrefix: "0.0.0.0/0",
                            nextHopType: "VirtualAppliance",
                            nextHopIpAddress: next_hop_ip,
                        },
                    },
                ],
            },
        }
    );

    return { route_table: res.data };
}
