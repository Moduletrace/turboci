import {
    azureComputeRequest,
    azureNetworkRequest,
    getAzureResourceGroup,
} from "../../client";
import type { AZURE_VM } from "../../types";
import { existsSync, readFileSync } from "fs";
import grabDirNames from "@/utils/grab-dir-names";

type Params = {
    deployment_name: string;
    name: string;
    location: string;
    vm_size?: string;
    subnet_id: string;
    nsg_id?: string;
    public_ip?: boolean;
    enable_ip_forwarding?: boolean;
    tags?: { [k: string]: string };
    image_publisher?: string;
    image_offer?: string;
    image_sku?: string;
};

export default async function ({
    deployment_name,
    name,
    location,
    vm_size = "Standard_B1s",
    subnet_id,
    nsg_id,
    public_ip = false,
    enable_ip_forwarding = false,
    tags,
    image_publisher = "debian",
    image_offer = "debian-12",
    image_sku = "12-gen2",
}: Params) {
    const rg = getAzureResourceGroup(deployment_name);
    const { sshPublicKeyFile } = grabDirNames();

    let sshPublicKey = "";
    if (existsSync(sshPublicKeyFile)) {
        sshPublicKey = readFileSync(sshPublicKeyFile, "utf-8").trim();
    }

    // Cloud-init script to enable root SSH access (matches AWS UserData pattern)
    const cloudInitScript = `#!/bin/bash
mkdir -p /root/.ssh
chmod 700 /root/.ssh
echo "${sshPublicKey}" >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys
chown -R root:root /root/.ssh
sed -i 's/^disable_root: true/disable_root: false/' /etc/cloud/cloud.cfg 2>/dev/null || true
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin yes/' /etc/ssh/sshd_config
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
export DEBIAN_FRONTEND=noninteractive
apt-get update -y && apt-get install -y rsync
systemctl restart sshd || service ssh restart
`;

    const customData = Buffer.from(cloudInitScript).toString("base64");

    const pipName = `${name}-pip`;
    const nicName = `${name}-nic`;

    let publicIpId: string | undefined;
    let assignedPublicIP: string | undefined;

    // Step 1: Create public IP if needed
    if (public_ip) {
        const pipRes = await azureNetworkRequest<any>(
            `/resourceGroups/${rg}/providers/Microsoft.Network/publicIPAddresses/${pipName}`,
            "PUT",
            {
                location,
                tags,
                sku: { name: "Standard" },
                properties: { publicIPAllocationMethod: "Static" },
            }
        );
        publicIpId = pipRes.data?.id;

        // Wait for public IP to be provisioned
        for (let i = 0; i < 20; i++) {
            const checkRes = await azureNetworkRequest<any>(
                `/resourceGroups/${rg}/providers/Microsoft.Network/publicIPAddresses/${pipName}`
            );
            const state = checkRes.data?.properties?.provisioningState;
            if (state === "Succeeded") {
                assignedPublicIP = checkRes.data?.properties?.ipAddress;
                publicIpId = checkRes.data?.id;
                break;
            }
            if (state === "Failed") break;
            await Bun.sleep(3000);
        }
    }

    // Step 2: Create NIC
    const ipConfig: any = {
        name: "ipconfig1",
        properties: {
            subnet: { id: subnet_id },
            privateIPAllocationMethod: "Dynamic",
        },
    };

    if (publicIpId) {
        ipConfig.properties.publicIPAddress = { id: publicIpId };
    }

    const nicBody: any = {
        location,
        tags,
        properties: {
            enableIPForwarding: enable_ip_forwarding,
            ipConfigurations: [ipConfig],
        },
    };

    if (nsg_id) {
        nicBody.properties.networkSecurityGroup = { id: nsg_id };
    }

    const nicRes = await azureNetworkRequest<any>(
        `/resourceGroups/${rg}/providers/Microsoft.Network/networkInterfaces/${nicName}`,
        "PUT",
        nicBody
    );

    let nicId = nicRes.data?.id;

    // Wait for NIC to be provisioned
    for (let i = 0; i < 20; i++) {
        const checkRes = await azureNetworkRequest<any>(
            `/resourceGroups/${rg}/providers/Microsoft.Network/networkInterfaces/${nicName}`
        );
        const state = checkRes.data?.properties?.provisioningState;
        if (state === "Succeeded") {
            nicId = checkRes.data?.id;
            break;
        }
        if (state === "Failed") break;
        await Bun.sleep(3000);
    }

    if (!nicId) {
        throw new Error(`Failed to create NIC for Azure VM ${name}`);
    }

    // Step 3: Create VM
    const vmBody: any = {
        location,
        tags,
        properties: {
            hardwareProfile: { vmSize: vm_size },
            storageProfile: {
                imageReference: {
                    publisher: image_publisher,
                    offer: image_offer,
                    sku: image_sku,
                    version: "latest",
                },
                osDisk: {
                    createOption: "FromImage",
                    managedDisk: { storageAccountType: "Standard_LRS" },
                },
            },
            osProfile: {
                computerName: name.replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 15),
                adminUsername: "azureuser",
                customData,
                linuxConfiguration: {
                    disablePasswordAuthentication: true,
                    ssh: sshPublicKey
                        ? {
                              publicKeys: [
                                  {
                                      path: "/home/azureuser/.ssh/authorized_keys",
                                      keyData: sshPublicKey,
                                  },
                              ],
                          }
                        : undefined,
                },
            },
            networkProfile: {
                networkInterfaces: [
                    { id: nicId, properties: { primary: true } },
                ],
            },
        },
    };

    const vmRes = await azureComputeRequest<AZURE_VM>(
        `/resourceGroups/${rg}/providers/Microsoft.Compute/virtualMachines/${name}`,
        "PUT",
        vmBody
    );

    // Get private IP from NIC
    const finalNicRes = await azureNetworkRequest<any>(
        `/resourceGroups/${rg}/providers/Microsoft.Network/networkInterfaces/${nicName}`
    );
    const privateIP =
        finalNicRes.data?.properties?.ipConfigurations?.[0]?.properties
            ?.privateIPAddress;

    return {
        server: vmRes.data,
        public_ip: assignedPublicIP,
        private_ip: privateIP,
    };
}
