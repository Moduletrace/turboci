import type { TCIConfigDeployment } from "@/types";
import slugify from "./slugify";

type Params = {
    name: string;
    serviceName?: string;
    deployment?: Omit<TCIConfigDeployment, "services">;
};

export default function grabAppNames({
    name,
    serviceName,
    deployment,
}: Params) {
    const appName = slugify(name);
    const turboCIPrefix = "turboci";
    const appNetworkName = `${turboCIPrefix}_${appName}_network`;
    const appSSHKeyName = `${turboCIPrefix}_${appName}_ssh_key`;
    const appServerPrefix = `${turboCIPrefix}_${appName}_server`;
    const defaultFirewallName = `${turboCIPrefix}_default_firewall`;
    const allowAllFirewallName = `${turboCIPrefix}_allow_all_firewall`;
    const loadBalancerFirewallName = `${turboCIPrefix}_load_balancer_firewall`;

    const sshRelayServerName = `${turboCIPrefix}_${appName}_ssh_relay`;
    const defaultNATName = `${turboCIPrefix}_${appName}_nat_gateway`;

    let finalServiceName = `${turboCIPrefix}_${appName}_service_${serviceName}`;
    // let finalServiceHostname = `${turboCIPrefix}_${appName}_service_${serviceName}`;
    // if (deployment.provider == "hetzner") {
    //     finalServiceName = slugify(finalServiceName, "-");
    // }
    const relayServerLabelName = `${turboCIPrefix}_${appName}_relay`;

    const publicSubnetName = `${turboCIPrefix}_${appName}_public_subnet`;
    const privateSubnetName = `${turboCIPrefix}_${appName}_private_subnet`;

    return {
        appName,
        appNetworkName,
        appServerPrefix,
        finalServiceName,
        appSSHKeyName,
        defaultFirewallName,
        loadBalancerFirewallName,
        sshRelayServerName,
        relayServerLabelName,
        defaultNATName,
        allowAllFirewallName,
        publicSubnetName,
        privateSubnetName,
    };
}
