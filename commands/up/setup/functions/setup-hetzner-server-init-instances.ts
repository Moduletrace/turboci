import Hetzner from "../../../../platforms/hetzner";
import type {
    TCIConfigDeployment,
    TCIConfigServiceConfig,
} from "../../../../types";
import { AppNames } from "../../../../utils/app-names";
import grabAppNames from "../../../../utils/grab-app-names";
import grabServerInstanceName from "../../../../utils/grab-server-instance-name";
import grabSSHRelayServer from "@/functions/server/ssh_relay/grab-ssh-relay-server";
import _ from "lodash";
import type { HETZNER_NETWORK } from "@/platforms/hetzner/types";
import AppData from "@/data/app-data";
import type { HetznerImages } from "@/platforms/hetzner/types/images";
import hetznerGrabServerType from "@/platforms/hetzner/utils/grab-server-type";

type Params = {
    service: TCIConfigServiceConfig;
    serviceName: string;
    deployment: Omit<TCIConfigDeployment, "services">;
    defaultNetwork: HETZNER_NETWORK;
};

export default async function ({
    service,
    serviceName,
    deployment,
    defaultNetwork,
}: Params) {
    const deploymentName = deployment.deployment_name;
    const SERVER_STATUS_CHECK_INTERVAL = 5000;

    const sshRelayServer = await grabSSHRelayServer({ deployment });

    if (!sshRelayServer?.ip) {
        console.error(
            `No SSH Relay Server Found for setting up Hetzner Server!`,
        );
        process.exit(1);
    }

    const { appSSHKeyName, finalServiceName, loadBalancerFirewallName } =
        grabAppNames({
            name: deploymentName,
            serviceName,
            deployment,
        });

    const networkId = defaultNetwork.id;

    const firewall =
        service.type == "load_balancer"
            ? (await Hetzner.firewalls.list({ name: loadBalancerFirewallName }))
                  ?.firewalls?.[0]
            : undefined;

    const finalServerType = await hetznerGrabServerType({
        server_type: service.server_type,
    });

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
                            platform: "hetzner",
                        });

                        const existingServerRes = await Hetzner.servers.list({
                            name: serviceInstanceName,
                        });

                        const existingServer = existingServerRes.servers?.[0];

                        const finalOS = (service.os ||
                            "debian-11") as (typeof HetznerImages)[number]["name"];

                        if (
                            existingServer?.id &&
                            existingServer.image.name == finalOS &&
                            existingServer.server_type.name ==
                                finalServerType &&
                            existingServer.datacenter.location.name ==
                                deployment.location
                        ) {
                            resolve(true);
                            return;
                        }

                        if (existingServer?.id) {
                            await Hetzner.servers.delete({
                                server_id: existingServer.id,
                            });
                            global.UPDATE_LOAD_BALANCERS = true;
                        }

                        const newServer = await Hetzner.servers.create({
                            name: serviceInstanceName,
                            server_type: finalServerType,
                            ssh_keys: [appSSHKeyName],
                            labels: {
                                [AppNames["TurboCILabelNameKey"]]:
                                    deploymentName,
                                [AppNames["TurboCILabelServiceNameKey"]]:
                                    finalServiceName,
                            },
                            image: finalOS,
                            location: deployment.location as any,
                            networks: [networkId],
                            firewalls: firewall?.id
                                ? [
                                      {
                                          firewall: firewall.id,
                                      },
                                  ]
                                : undefined,
                            public_net:
                                service.type == "load_balancer" ||
                                service.enable_public_ip
                                    ? undefined
                                    : {
                                          enable_ipv4: false,
                                          enable_ipv6: false,
                                      },
                        });

                        if (!newServer.server?.id) {
                            console.log("finalServiceName", finalServiceName);
                            console.log(
                                "serviceInstanceName",
                                serviceInstanceName,
                            );
                            console.error(
                                `Couldn't create server #${instanceIndex} for service \`${serviceName}\``,
                            );
                            console.error(newServer.error);
                            process.exit(1);
                        }

                        const privateIP = newServer.server.private_net?.[0]?.ip;
                        const publicIP = newServer.server.public_net?.ipv4?.ip;

                        if (privateIP && !publicIP) {
                            new_private_server_ips.push(privateIP);
                        }

                        let retries = 0;
                        const MAX_RETRIES = 10;

                        while (true) {
                            if (retries > MAX_RETRIES) {
                                resolve(false);
                                return;
                            }

                            const currentServerRes = await Hetzner.servers.get({
                                server_id: newServer.server.id,
                            });

                            if (currentServerRes.server?.status == "running") {
                                resolve(true);
                                global.NEW_SERVERS.push({
                                    private_ip: privateIP,
                                    public_ip: publicIP,
                                });
                                return;
                            } else {
                                retries++;
                                await Bun.sleep(SERVER_STATUS_CHECK_INTERVAL);
                            }
                        }
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
