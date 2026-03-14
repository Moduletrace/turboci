import type {
    TCIConfigDeployment,
    TCIConfigServiceConfig,
} from "../../../../types";
import { AppNames } from "../../../../utils/app-names";
import grabAppNames from "../../../../utils/grab-app-names";
import grabServerInstanceName from "../../../../utils/grab-server-instance-name";
import grabSSHRelayServer from "@/functions/server/ssh_relay/grab-ssh-relay-server";
import _ from "lodash";
import AppData from "@/data/app-data";
import TurboCIAzure from "@/platforms/azure";
import type { AZURE_VNET } from "@/platforms/azure/types";
import {
    getAzureResourceGroup,
    azureNetworkRequest,
} from "@/platforms/azure/client";

type Params = {
    service: TCIConfigServiceConfig;
    serviceName: string;
    deployment: Omit<TCIConfigDeployment, "services">;
    defaultNetwork: AZURE_VNET;
    location: string;
};

export default async function ({
    service,
    serviceName,
    deployment,
    defaultNetwork,
    location,
}: Params) {
    const deploymentName = deployment.deployment_name;

    const sshRelayServer = await grabSSHRelayServer({ deployment });

    if (!sshRelayServer?.ip) {
        console.error(`No SSH Relay Server Found for setting up Azure Server!`);
        process.exit(1);
    }

    const {
        finalServiceName,
        loadBalancerFirewallName,
        allowAllFirewallName,
        appNetworkName,
        publicSubnetName,
        privateSubnetName,
    } = grabAppNames({
        name: deploymentName,
        serviceName,
    });

    const rg = getAzureResourceGroup(deploymentName);
    const isPublic =
        service.type == "load_balancer" || Boolean(service.enable_public_ip);

    // Get appropriate firewall
    const firewallName =
        service.type == "load_balancer"
            ? loadBalancerFirewallName
            : allowAllFirewallName;
    const firewallRes = await TurboCIAzure.firewalls.get({
        deployment_name: deploymentName,
        name: firewallName,
    });

    const nsgId = firewallRes.firewall?.id;

    // Get appropriate subnet
    const subnetName = isPublic ? publicSubnetName : privateSubnetName;
    const subnetRes = await TurboCIAzure.networks.get_subnet({
        deployment_name: deploymentName,
        vnet_name: appNetworkName,
        subnet_name: subnetName,
    });

    if (!subnetRes.subnet?.id) {
        console.error(`Subnet ${subnetName} not found for Azure server setup`);
        process.exit(1);
    }

    const subnetId = subnetRes.subnet.id;
    const finalServerType = service.server_type || "Standard_B1s";
    const new_private_server_ips: string[] = [];

    const finalInstances =
        typeof service.instances == "number" ? service.instances : 1;

    if (finalInstances > AppData["max_instances"]) {
        console.error(
            `Max instances for a service is ${AppData["max_instances"]}`,
        );
        process.exit(1);
    }

    const chunks = _.chunk(
        _.range(finalInstances),
        AppData["max_servers_batch"],
    );

    for (let c = 0; c < chunks.length; c++) {
        const chunk = chunks[c];
        if (!chunk) continue;

        const setup = (await Promise.all(
            chunk.map((val, indx) =>
                new Promise((resolve) => {
                    (async () => {
                        const instanceIndex =
                            AppData["max_servers_batch"] * c + indx;

                        const serviceInstanceName = grabServerInstanceName({
                            index: instanceIndex,
                            serviceName: finalServiceName,
                            platform: "azure",
                        });

                        const existingServerRes =
                            await TurboCIAzure.servers.get({
                                deployment_name: deploymentName,
                                name: serviceInstanceName,
                            });

                        const existingServer = existingServerRes.server;

                        if (
                            existingServer?.name &&
                            existingServer.properties?.provisioningState ===
                                "Succeeded" &&
                            existingServer.properties?.hardwareProfile
                                ?.vmSize === finalServerType
                        ) {
                            resolve(true);
                            return;
                        }

                        if (existingServer?.name) {
                            await TurboCIAzure.servers.delete({
                                deployment_name: deploymentName,
                                name: existingServer.name,
                            });
                            global.UPDATE_LOAD_BALANCERS = true;
                        }

                        const newServerRes = await TurboCIAzure.servers.create({
                            deployment_name: deploymentName,
                            name: serviceInstanceName,
                            location,
                            vm_size: finalServerType,
                            subnet_id: subnetId,
                            nsg_id: nsgId,
                            public_ip: isPublic,
                            tags: {
                                [AppNames["TurboCILabelNameKey"]]:
                                    deploymentName,
                                [AppNames["TurboCILabelServiceNameKey"]]:
                                    finalServiceName,
                            },
                        });

                        const privateIP = newServerRes.private_ip;
                        const publicIP = newServerRes.public_ip;

                        if (!newServerRes.server?.name) {
                            console.error(
                                `Couldn't create Azure VM #${instanceIndex} for service \`${serviceName}\``,
                            );
                            process.exit(1);
                        }

                        if (privateIP && !publicIP) {
                            new_private_server_ips.push(privateIP);
                        }

                        resolve(true);
                    })();
                }).catch((error) => {
                    console.error(`Instance ERROR => ${error.message}`);
                }),
            ),
        )) as boolean[];

        if (setup.find((s) => !s)) {
            console.error(`\nServers Setup Failed`);
            process.exit();
        }
    }

    return { new_private_server_ips };
}
