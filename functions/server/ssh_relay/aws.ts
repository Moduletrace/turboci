import type {
    SSHRelayServerReturn,
    TCIConfig,
    TCIConfigDeployment,
} from "@/types";
import { AppNames } from "@/utils/app-names";
import grabAppNames from "@/utils/grab-app-names";
import syncRemoteDirs from "../sync-remote-dirs";
import grabDirNames from "@/utils/grab-dir-names";
import relayExecSSH from "@/utils/ssh/relay-exec-ssh";
import { execSync } from "child_process";
import TurboCIAWS from "@/platforms/aws";
import {
    AssociateRouteTableCommand,
    CreateRouteCommand,
    ModifyInstanceAttributeCommand,
    type Instance,
} from "@aws-sdk/client-ec2";
import awsWaitForServerStart from "@/platforms/aws/utils/wait-for-server-start";
import awsWaitForServerSSH from "@/platforms/aws/utils/wait-for-server-ssh";
import { AWSEC2Client } from "@/platforms/aws/clients/ec2";
import get_subnets from "@/platforms/aws/actions/networks/get_subnets";
import awsNATRelayServerInitSH from "@/platforms/aws/utils/grab-nat-relay-server-init-sh";
import execSSH from "@/utils/ssh/exec-ssh";

type Params = {
    deployment: Omit<TCIConfigDeployment, "services">;
};

export default async function ({
    deployment,
}: Params): Promise<SSHRelayServerReturn> {
    const {
        sshRelayServerName,
        appSSHKeyName,
        appNetworkName,
        defaultFirewallName,
        relayServerLabelName,
        publicSubnetName,
        privateSubnetName,
    } = grabAppNames({
        name: deployment.deployment_name,
    });

    const region = deployment.location;

    if (!region) {
        console.error(
            `AWS relay setup requires a \`location\` parameter for deployment`,
        );
        process.exit(1);
    }

    const EC2Client = AWSEC2Client({ region });

    const existingRelayServer = await TurboCIAWS.servers.get({
        name: sshRelayServerName,
        region,
    });

    const existingServer = existingRelayServer.server;

    if (existingServer?.InstanceId) {
        if (existingServer.State?.Name == "terminated") {
            global.ORA_SPINNER.fail(
                `Relay server still in \`terminated\` status.`,
            );
            console.error(
                `An existing Relay server is not yet cleaned up. Please wait till this server has been purged completely by AWS.`,
            );
            process.exit(1);
        }

        const serverReady = await isServerReady({
            server: existingServer,
            region,
        });

        if (!serverReady) {
            console.error(`SSH Relay server not ready for use!`);
            process.exit(1);
        }

        const publicIP = existingServer?.PublicIpAddress;
        const privateIP = existingServer?.PrivateIpAddress;

        if (!publicIP || !privateIP) {
            console.error(`SSH Relay server error!`);
            process.exit(1);
        }

        if (
            !existingServer.Tags?.find(
                (t) => t.Key == AppNames["TurboCILabelServiceNameKey"],
            ) ||
            !existingServer.Tags?.find(
                (t) => t.Key == AppNames["TurboCILabelNameKey"],
            )
        ) {
            await TurboCIAWS.servers.update({
                instance_id: existingServer.InstanceId,
                region,
                tags: [
                    {
                        Key: AppNames["TurboCILabelNameKey"],
                        Value: deployment.deployment_name,
                    },
                    {
                        Key: AppNames["TurboCILabelServiceNameKey"],
                        Value: relayServerLabelName,
                    },
                ],
            });
        }

        return {
            ip: publicIP,
            private_ip: privateIP,
        };
    }

    const deploymentNetworkRes = await TurboCIAWS.networks.get({
        network_name: appNetworkName,
        region,
    });

    const deploymentNetwork = deploymentNetworkRes.network;

    if (!deploymentNetwork?.VpcId || !deploymentNetwork?.CidrBlock) {
        console.log(`Deployment Network not created!`);
        process.exit(1);
    }

    const firewall = (
        await TurboCIAWS.firewalls.get({
            name: defaultFirewallName,
            region,
        })
    )?.firewall;

    if (!firewall?.GroupId) {
        console.error(`Default Firewall not found!`);
        process.exit(1);
    }

    const privateSubnetRes = await get_subnets({
        region,
        subnet_name: privateSubnetName,
        vpc_id: deploymentNetwork.VpcId,
    });

    const publicSubnet = await get_subnets({
        region,
        subnet_name: publicSubnetName,
        vpc_id: deploymentNetwork.VpcId,
    });

    // const images = await TurboCIAWS.images.list({
    //     region,
    //     names: ["debian-13"],
    //     architectures: ["x86_64"],
    // });

    // const targetDebianImage = images.images[0];

    // if (!targetDebianImage?.ImageId) {
    //     console.error(`Default Debian 13 image ID not found!`);
    //     process.exit(1);
    // }

    const newSSHRelayServerRes = await TurboCIAWS.servers.create({
        name: sshRelayServerName,
        instance_type:
            (deployment.relay_server_options?.server_type as any | undefined) ||
            "t3.micro",
        ssh_key_name: appSSHKeyName,
        tags: [
            {
                Key: AppNames["TurboCILabelNameKey"],
                Value: deployment.deployment_name,
            },
            {
                Key: AppNames["TurboCILabelServiceNameKey"],
                Value: relayServerLabelName,
            },
        ],
        image_id: "ami-0702a3ce7f850fb87",
        region,
        public_ip: true,
        options: {
            SubnetId: publicSubnet.subnet?.SubnetId,
            SecurityGroupIds: [firewall.GroupId],
        },
        network_name: appNetworkName,
        deployment,
    });

    let newSSHRelayServer = newSSHRelayServerRes.servers?.[0];

    let publicIP = newSSHRelayServer?.PublicIpAddress;
    let privateIP = newSSHRelayServer?.PrivateIpAddress;

    let retries = 0;
    const MAX_RETRIES = 10;
    const SLEEP_TMEOUT = 1000;

    while (!publicIP) {
        if (retries == MAX_RETRIES) {
            console.error(`Couldn't get relay server Public IP address!`);
            process.exit(1);
        }

        const runningRelayServer = await TurboCIAWS.servers.get({
            region,
            instance_id: newSSHRelayServer?.InstanceId,
        });

        if (runningRelayServer.server?.PublicIpAddress) {
            publicIP = runningRelayServer.server.PublicIpAddress;
            newSSHRelayServer = runningRelayServer.server;
            break;
        }

        retries++;
        await Bun.sleep(SLEEP_TMEOUT);
    }

    if (!newSSHRelayServer?.InstanceId || !publicIP || !privateIP) {
        global.ORA_SPINNER.fail(`SSH Relay server could not be created!`);
        process.exit(1);
    }

    await EC2Client.send(
        new ModifyInstanceAttributeCommand({
            InstanceId: newSSHRelayServer.InstanceId,
            SourceDestCheck: { Value: false },
        }),
    );

    const {
        sshDir,
        relayServerSSHDir,
        relayServerBunScriptsDir,
        relayShDir,
        relayConfigDir,
    } = grabDirNames();

    await execSSH({
        cmd: [
            `mkdir -p ${relayServerSSHDir}\n`,
            `mkdir -p ${relayServerBunScriptsDir}\n`,
            `mkdir -p ${relayConfigDir}\n`,
            `mkdir -p ${relayShDir}\n`,
        ],
        ip: publicIP,
    });

    const initCommands = [
        awsNATRelayServerInitSH({
            ip_range: deploymentNetwork.CidrBlock!,
        }),
    ];

    await relayExecSSH({
        cmd: initCommands,
        deployment,
    });

    await Bun.sleep(2000);

    const serverReadyAfterInit = await isServerReady({
        region,
        server: newSSHRelayServer,
    });

    if (!serverReadyAfterInit) {
        console.log(`SSH Relay server inital setup failed!`);
        process.exit(1);
    }

    const sync = await syncRemoteDirs({
        dst: relayServerSSHDir,
        src: sshDir,
        ip: publicIP,
    });

    const privateSubnetRouteTableRes =
        await TurboCIAWS.networks.create_route_table({
            region,
            route_table_name: "turboci-aws-private-route-table",
            vpc_id: deploymentNetwork.VpcId,
        });

    const privateSubnetRouteTable = privateSubnetRouteTableRes.route_table;

    if (!privateSubnetRouteTable?.RouteTableId) {
        console.error(`Route table ID not found for deployment network`);
        process.exit(1);
    }

    await EC2Client.send(
        new CreateRouteCommand({
            RouteTableId: privateSubnetRouteTable.RouteTableId,
            DestinationCidrBlock: "0.0.0.0/0",
            InstanceId: newSSHRelayServer.InstanceId,
        }),
    );

    // Associate Route table with private subnet
    await EC2Client.send(
        new AssociateRouteTableCommand({
            RouteTableId: privateSubnetRouteTable?.RouteTableId,
            SubnetId: privateSubnetRes.subnet?.SubnetId,
        }),
    );

    try {
        execSync(`ssh-keygen -f "$HOME/.ssh/known_hosts" -R "${publicIP}"`);
    } catch (error) {}

    return {
        ip: publicIP,
        private_ip: privateIP,
    };
}

async function isServerReady({
    region,
    server,
}: {
    server: Instance;
    region: string;
}) {
    const isServerStarted = await awsWaitForServerStart({
        server,
        region,
    });

    if (!isServerStarted) return false;

    const isServerSSHReady = await awsWaitForServerSSH({
        server,
        region,
    });

    if (!isServerSSHReady) return false;

    return true;
}
