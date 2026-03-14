import {
    _InstanceType,
    RunInstancesCommand,
    waitUntilInstanceRunning,
    waitUntilInstanceStatusOk,
    type RunInstancesCommandInput,
    type Tag,
    type TagSpecification,
} from "@aws-sdk/client-ec2";
import { AWSEC2Client } from "../../clients/ec2";
import { execSync } from "child_process";
import grabDirNames from "@/utils/grab-dir-names";
import update from "./update";
import _ from "lodash";
import get_subnets from "../networks/get_subnets";
import get from "../networks/get";
import type { TCIGlobalConfig } from "@/types";
import grabAppNames from "@/utils/grab-app-names";
import grabPreferedOSType from "@/utils/grab-os-type";

type Params = {
    region: string;
    deployment: Omit<TCIGlobalConfig, "services">;
    image_id: string;
    instance_type: _InstanceType;
    count?: number;
    name: string;
    ssh_key_name: string;
    ssh_public_key_file_path?: string;
    public_ip?: boolean;
    tags?: Tag[];
    instance_name_prefix?: string;
    options?: Omit<RunInstancesCommandInput, "MaxCount" | "MinCount">;
    network_name?: string;
    network_id?: string;
    firewalls?: string[];
};

export default async function ({
    region,
    image_id,
    instance_type,
    count = 1,
    name,
    ssh_key_name,
    ssh_public_key_file_path,
    public_ip,
    tags,
    instance_name_prefix,
    options,
    network_name,
    network_id,
    firewalls,
    deployment,
}: Params) {
    try {
        const EC2Client = AWSEC2Client({ region });

        const { sshPublicKeyFile } = grabDirNames();
        const { publicSubnetName, privateSubnetName } = grabAppNames({
            name: deployment.deployment_name,
        });

        const SSHPublicKeyString = execSync(
            `cat ${ssh_public_key_file_path || sshPublicKeyFile}`,
            {
                encoding: "utf-8",
            },
        );

        let init = `#!/bin/bash\n`;
        init += `PUB_KEY="${SSHPublicKeyString.trim()}"\n`;
        init += `mkdir -p /root/.ssh\n`;
        init += `echo "$PUB_KEY" > /root/.ssh/authorized_keys\n`;
        init += `chmod 700 /root/.ssh\n`;
        init += `chmod 600 /root/.ssh/authorized_keys\n`;
        init += `chown -R root:root /root/.ssh\n`;
        init += `sed -i 's/^disable_root: true/disable_root: false/' /etc/cloud/cloud.cfg\n`;
        init += `sed -i 's/^#\\?PermitRootLogin.*/PermitRootLogin yes/' /etc/ssh/sshd_config\n`;
        init += `sed -i 's/^#\\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config\n`;
        init += `systemctl restart sshd\n`;

        const osType = await grabPreferedOSType({
            deployment,
            os: image_id,
        });

        if (osType == "debian" || osType == "ubuntu") {
            init += `apt update\n`;
            init += `apt install -y rsync\n`;
        }

        let tagSpec: TagSpecification = {
            ResourceType: "instance",
            Tags: [],
        };

        if (tags) {
            tagSpec.Tags?.push(...tags);
        }

        if (name) {
            tagSpec.Tags?.push({
                Key: "Name",
                Value: name,
            });
        }

        let opts: RunInstancesCommandInput = {
            ImageId: image_id,
            InstanceType: instance_type,
            MinCount: count,
            MaxCount: count,
            KeyName: ssh_key_name,
            TagSpecifications: [tagSpec],
            UserData: Buffer.from(init).toString("base64"),
            NetworkInterfaces: [],
        };

        if (firewalls) {
            opts.SecurityGroupIds = firewalls;
        }

        let networkId = network_id;

        if (network_name && !network_id) {
            const networkRes = await get({ region, network_name });

            if (!networkRes.network?.VpcId) {
                console.error(
                    `Deployment network not found from network name for creating AWS EC2 Server!`,
                );
                process.exit(1);
            }

            networkId = networkRes.network.VpcId;
        }

        if (!networkId) {
            console.error(
                `Deployment network ID not found for creating AWS EC2 Server!`,
            );
            process.exit(1);
        }

        const publicSubnet = await get_subnets({
            region,
            subnet_name: publicSubnetName,
            vpc_id: networkId,
        });

        if (!publicSubnet.subnet?.SubnetId) {
            console.error(
                `Public Subnet not found for creating AWS EC2 Server!`,
            );
            process.exit(1);
        }

        const privateSubnet = await get_subnets({
            region,
            subnet_name: privateSubnetName,
            vpc_id: networkId,
        });

        if (!privateSubnet.subnet?.SubnetId) {
            console.error(
                `Private Subnet not found for creating AWS EC2 Server!`,
            );
            process.exit(1);
        }

        if (public_ip) {
            opts.SubnetId = publicSubnet.subnet.SubnetId;
        } else {
            opts.SubnetId = privateSubnet.subnet.SubnetId;
        }

        const finalOptions = _.merge(opts, options);

        const newInstances = await EC2Client.send(
            new RunInstancesCommand(finalOptions),
        );

        if (instance_name_prefix && newInstances.Instances) {
            for (let i = 0; i < newInstances.Instances.length; i++) {
                const server = newInstances.Instances[i];

                if (!server) continue;

                await update({
                    instance_id: server?.InstanceId || "",
                    region,
                    tags: [
                        { Key: "Name", Value: `${instance_name_prefix}${i}` },
                    ],
                });
            }
        }

        await waitUntilInstanceRunning(
            { client: EC2Client, maxWaitTime: 120 },
            {
                InstanceIds: newInstances.Instances?.map(
                    (i) => i.InstanceId,
                ).filter((i) => Boolean(i)) as string[] | undefined,
            },
        );

        await waitUntilInstanceStatusOk(
            { client: EC2Client, maxWaitTime: 600 },
            {
                InstanceIds: newInstances.Instances?.map(
                    (i) => i.InstanceId,
                ).filter((i) => Boolean(i)) as string[] | undefined,
            },
        );

        return {
            servers: newInstances.Instances,
            options: { ...opts, UserData: init },
        };
    } catch (error: any) {
        console.error(`Error Creating EC2 instance => ${error.message}`);
        process.exit(1);
    }
}
