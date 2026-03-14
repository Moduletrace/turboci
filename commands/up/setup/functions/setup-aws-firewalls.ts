import TurboCIAWS from "@/platforms/aws";
import type { TCIGlobalConfig } from "../../../../types";
import grabAppNames from "../../../../utils/grab-app-names";
import { AppNames } from "@/utils/app-names";

type Params = {
    config: TCIGlobalConfig;
};

export default async function ({ config }: Params) {
    const deploymentName = config.deployment_name;

    const {
        defaultFirewallName,
        loadBalancerFirewallName,
        appNetworkName,
        allowAllFirewallName,
    } = grabAppNames({
        name: deploymentName,
    });

    const region = config.location;

    if (!region) {
        console.error(
            `AWS newtwork setup requires a \`location\` parameter for deployment`,
        );
        process.exit(1);
    }

    const existingDefaultFirewall = await TurboCIAWS.firewalls.list({
        name: defaultFirewallName,
        region,
    });

    const defaultNetwork = await TurboCIAWS.networks.get({
        region,
        network_name: appNetworkName,
    });

    const vpcId = defaultNetwork.network?.VpcId;

    if (!vpcId) {
        console.error(`Couldn't find VPC for aws firewall setup.`);
        process.exit(1);
    }

    if (!existingDefaultFirewall.firewalls?.[0]?.GroupId) {
        await TurboCIAWS.firewalls.create({
            name: defaultFirewallName,
            rules: [
                {
                    FromPort: 22,
                    ToPort: 22,
                    IpRanges: [
                        {
                            CidrIp: `0.0.0.0/0`,
                        },
                    ],
                    IpProtocol: "tcp",
                },
                {
                    IpProtocol: "-1",
                    IpRanges: [
                        {
                            CidrIp: defaultNetwork.network?.CidrBlock,
                            Description: "Allow internal VPC traffic for NAT",
                        },
                    ],
                },
            ],
            region,
            description: "Default SSH Firewall",
            vpc_id: vpcId,
            tags: {
                [AppNames["TurboCILabelNameKey"]]: deploymentName,
            },
        });
    }

    const existingLoadBalancerFirewall = await TurboCIAWS.firewalls.list({
        name: loadBalancerFirewallName,
        region,
    });

    if (!existingLoadBalancerFirewall.firewalls?.[0]?.GroupId) {
        await TurboCIAWS.firewalls.create({
            name: loadBalancerFirewallName,
            rules: [
                {
                    FromPort: 80,
                    ToPort: 80,
                    IpRanges: [
                        {
                            CidrIp: `0.0.0.0/0`,
                        },
                    ],
                    IpProtocol: "tcp",
                },
                {
                    FromPort: 443,
                    ToPort: 443,
                    IpRanges: [
                        {
                            CidrIp: `0.0.0.0/0`,
                        },
                    ],
                    IpProtocol: "tcp",
                },
                {
                    IpProtocol: "-1",
                    IpRanges: [
                        {
                            CidrIp: defaultNetwork.network?.CidrBlock,
                        },
                    ],
                },
            ],
            region,
            description: `Allow default HTTP Ports`,
            vpc_id: vpcId,
            tags: {
                [AppNames["TurboCILabelNameKey"]]: deploymentName,
            },
        });
    }

    const existingAllowAllFirewall = await TurboCIAWS.firewalls.list({
        name: allowAllFirewallName,
        region,
    });

    if (!existingAllowAllFirewall.firewalls?.[0]?.GroupId) {
        await TurboCIAWS.firewalls.create({
            name: allowAllFirewallName,
            rules: [
                {
                    IpProtocol: "-1",
                    IpRanges: [
                        {
                            CidrIp: defaultNetwork.network?.CidrBlock,
                            Description: "Allow all internal traffic",
                        },
                    ],
                },
            ],
            region,
            description: `Allow all traffic`,
            vpc_id: vpcId,
            tags: {
                [AppNames["TurboCILabelNameKey"]]: deploymentName,
            },
        });
    }

    return true;
}
