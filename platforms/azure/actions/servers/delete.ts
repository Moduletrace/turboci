import {
    azureComputeRequest,
    azureNetworkRequest,
    getAzureResourceGroup,
} from "../../client";

type Params = {
    deployment_name: string;
    name: string;
};

export default async function ({ deployment_name, name }: Params) {
    const rg = getAzureResourceGroup(deployment_name);

    // Delete VM
    await azureComputeRequest(
        `/resourceGroups/${rg}/providers/Microsoft.Compute/virtualMachines/${name}`,
        "DELETE"
    );

    // Clean up NIC and PublicIP
    const nicName = `${name}-nic`;
    const pipName = `${name}-pip`;

    // Wait a moment for VM deletion to register
    await Bun.sleep(3000);

    try {
        await azureNetworkRequest(
            `/resourceGroups/${rg}/providers/Microsoft.Network/networkInterfaces/${nicName}`,
            "DELETE"
        );
    } catch (_e) {}

    try {
        await azureNetworkRequest(
            `/resourceGroups/${rg}/providers/Microsoft.Network/publicIPAddresses/${pipName}`,
            "DELETE"
        );
    } catch (_e) {}

    return {};
}
