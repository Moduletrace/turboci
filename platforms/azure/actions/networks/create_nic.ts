import { azureNetworkRequest, getAzureResourceGroup } from "../../client";
import type { AZURE_NIC } from "../../types";

type Params = {
    deployment_name: string;
    name: string;
    location: string;
    subnet_id: string;
    public_ip_id?: string;
    nsg_id?: string;
    enable_ip_forwarding?: boolean;
    tags?: { [k: string]: string };
};

export default async function ({
    deployment_name,
    name,
    location,
    subnet_id,
    public_ip_id,
    nsg_id,
    enable_ip_forwarding = false,
    tags,
}: Params) {
    const rg = getAzureResourceGroup(deployment_name);

    const ipConfig: any = {
        name: "ipconfig1",
        properties: {
            subnet: { id: subnet_id },
            privateIPAllocationMethod: "Dynamic",
        },
    };

    if (public_ip_id) {
        ipConfig.properties.publicIPAddress = { id: public_ip_id };
    }

    const body: any = {
        location,
        tags,
        properties: {
            enableIPForwarding: enable_ip_forwarding,
            ipConfigurations: [ipConfig],
        },
    };

    if (nsg_id) {
        body.properties.networkSecurityGroup = { id: nsg_id };
    }

    const res = await azureNetworkRequest<AZURE_NIC>(
        `/resourceGroups/${rg}/providers/Microsoft.Network/networkInterfaces/${name}`,
        "PUT",
        body
    );

    return { nic: res.data };
}
