import getGCPClient from "../../client";
import { gcpGetProject, gcpGetRegionFromZone } from "../../types";
import type { compute_v1 } from "googleapis";
import { existsSync, readFileSync } from "fs";
import grabDirNames from "@/utils/grab-dir-names";

type Params = {
    zone: string;
    name: string;
    instance_type?: string;
    image?: string;
    labels?: { [k: string]: string };
    tags?: string[];
    network_name?: string;
    subnet_name?: string;
    public_ip?: boolean;
    can_ip_forward?: boolean;
};

export default async function ({
    zone,
    name,
    instance_type = "e2-micro",
    image = "projects/debian-cloud/global/images/family/debian-12",
    labels,
    tags,
    network_name,
    subnet_name,
    public_ip = true,
    can_ip_forward = false,
}: Params) {
    const { GCPCompute } = await getGCPClient();
    const project = gcpGetProject();
    const region = gcpGetRegionFromZone(zone);

    const { sshPublicKeyFile } = grabDirNames();
    let sshPublicKey = "";
    if (existsSync(sshPublicKeyFile)) {
        sshPublicKey = readFileSync(sshPublicKeyFile, "utf-8").trim();
    }

    // Startup script matching AWS UserData pattern — enables root SSH + installs rsync
    let startupScript = `#!/bin/bash\n`;
    if (sshPublicKey) {
        startupScript += `PUB_KEY="${sshPublicKey}"\n`;
        startupScript += `mkdir -p /root/.ssh\n`;
        startupScript += `echo "$PUB_KEY" >> /root/.ssh/authorized_keys\n`;
        startupScript += `chmod 700 /root/.ssh\n`;
        startupScript += `chmod 600 /root/.ssh/authorized_keys\n`;
        startupScript += `chown -R root:root /root/.ssh\n`;
    }
    startupScript += `sed -i 's/^disable_root: true/disable_root: false/' /etc/cloud/cloud.cfg 2>/dev/null || true\n`;
    startupScript += `sed -i 's/^#\\?PermitRootLogin.*/PermitRootLogin yes/' /etc/ssh/sshd_config\n`;
    startupScript += `sed -i 's/^#\\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config\n`;
    startupScript += `export DEBIAN_FRONTEND=noninteractive\n`;
    startupScript += `apt-get update -y && apt-get install -y rsync\n`;
    startupScript += `systemctl restart sshd\n`;

    const networkInterface: compute_v1.Schema$NetworkInterface = {
        network: network_name
            ? `global/networks/${network_name}`
            : "global/networks/default",
    };

    if (subnet_name) {
        networkInterface.subnetwork = `regions/${region}/subnetworks/${subnet_name}`;
    }

    if (public_ip) {
        networkInterface.accessConfigs = [
            { name: "External NAT", type: "ONE_TO_ONE_NAT" },
        ];
    }

    const requestBody: compute_v1.Schema$Instance = {
        name,
        machineType: `zones/${zone}/machineTypes/${instance_type}`,
        labels,
        tags: tags ? { items: tags } : undefined,
        canIpForward: can_ip_forward,
        metadata: {
            items: [{ key: "startup-script", value: startupScript }],
        },
        disks: [
            {
                boot: true,
                autoDelete: true,
                initializeParams: {
                    sourceImage: image,
                },
            },
        ],
        networkInterfaces: [networkInterface],
    };

    await GCPCompute.instances.insert({
        project,
        zone,
        requestBody,
    });

    // Fetch the created instance to get full details including IPs
    let server: compute_v1.Schema$Instance | null = null;
    for (let i = 0; i < 20; i++) {
        try {
            const getRes = await GCPCompute.instances.get({
                project,
                zone,
                instance: name,
            });
            if (getRes.data?.name) {
                server = getRes.data;
                break;
            }
        } catch (_e) {}
        await Bun.sleep(3000);
    }

    return { server };
}
