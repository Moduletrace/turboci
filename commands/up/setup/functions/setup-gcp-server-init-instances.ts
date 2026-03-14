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
import TurboCIGCP from "@/platforms/gcp";
import type { GCP_NETWORK } from "@/platforms/gcp/types";
import { gcpGetRegionFromZone } from "@/platforms/gcp/types";

type Params = {
    service: TCIConfigServiceConfig;
    serviceName: string;
    deployment: Omit<TCIConfigDeployment, "services">;
    defaultNetwork: GCP_NETWORK;
    zone: string;
};

export default async function ({
    service,
    serviceName,
    deployment,
    defaultNetwork,
    zone,
}: Params) {
    const deploymentName = deployment.deployment_name;

    const sshRelayServer = await grabSSHRelayServer({ deployment });

    if (!sshRelayServer?.ip) {
        console.error(`No SSH Relay Server Found for setting up GCP Server!`);
        process.exit(1);
    }

    const {
        appSSHKeyName,
        finalServiceName,
        loadBalancerFirewallName,
        appNetworkName,
    } = grabAppNames({
        name: deploymentName,
        serviceName,
    });

    const region = gcpGetRegionFromZone(zone);

    // Find the deployment subnet
    const subnetsRes = await TurboCIGCP.networks.list_subnets({ region });
    const deploymentSubnet =
        subnetsRes.subnets?.find((s) =>
            s.name?.includes(appNetworkName.replace("_network", "")),
        ) || subnetsRes.subnets?.[0];

    const new_private_server_ips: string[] = [];

    const finalInstances =
        typeof service.instances == "number" ? service.instances : 1;

    if (finalInstances > AppData["max_instances"]) {
        console.error(
            `Max instances for a service is ${AppData["max_instances"]}`,
        );
        process.exit(1);
    }

    const finalServerType = service.server_type || "e2-micro";
    const finalOS =
        service.os || "projects/debian-cloud/global/images/family/debian-12";

    const isPublic =
        service.type == "load_balancer" || Boolean(service.enable_public_ip);

    const tags = isPublic
        ? ["turboci-default", "turboci-lb"]
        : ["turboci-default", "turboci-private"];

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
                            platform: "gcp",
                        });

                        const existingServerRes = await TurboCIGCP.servers.get({
                            zone,
                            name: serviceInstanceName,
                        });

                        const existingServer = existingServerRes.server;

                        if (
                            existingServer?.name &&
                            existingServer.status === "RUNNING" &&
                            existingServer.machineType?.endsWith(
                                finalServerType,
                            ) &&
                            existingServer.disks?.[0]?.source?.includes(
                                finalOS.split("/").pop() || "",
                            )
                        ) {
                            resolve(true);
                            return;
                        }

                        if (existingServer?.name) {
                            await TurboCIGCP.servers.delete({
                                zone,
                                name: existingServer.name,
                            });
                            global.UPDATE_LOAD_BALANCERS = true;
                        }

                        const newServerRes = await TurboCIGCP.servers.create({
                            zone,
                            name: serviceInstanceName,
                            instance_type: finalServerType,
                            image: finalOS,
                            labels: {
                                [AppNames["TurboCILabelNameKey"]]:
                                    deploymentName,
                                [AppNames["TurboCILabelServiceNameKey"]]:
                                    finalServiceName,
                            },
                            tags,
                            network_name: appNetworkName,
                            subnet_name: deploymentSubnet?.name || undefined,
                            public_ip: isPublic,
                            can_ip_forward: false,
                        });

                        const newServer = newServerRes.server;

                        if (!newServer?.name) {
                            console.error(
                                `Couldn't create server #${instanceIndex} for service \`${serviceName}\``,
                            );
                            process.exit(1);
                        }

                        const privateIP =
                            newServer.networkInterfaces?.[0]?.networkIP;
                        const publicIP =
                            newServer.networkInterfaces?.[0]?.accessConfigs?.[0]
                                ?.natIP;

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
