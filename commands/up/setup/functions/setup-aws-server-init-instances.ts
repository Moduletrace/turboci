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
import type { _InstanceType, Vpc } from "@aws-sdk/client-ec2";
import TurboCIAWS from "@/platforms/aws";

type Params = {
    service: TCIConfigServiceConfig;
    serviceName: string;
    deployment: Omit<TCIConfigDeployment, "services">;
    defaultNetwork: Vpc;
    region: string;
};

export default async function ({
    service,
    serviceName,
    deployment,
    defaultNetwork,
    region,
}: Params) {
    const deploymentName = deployment.deployment_name;

    const sshRelayServer = await grabSSHRelayServer({ deployment });

    if (!sshRelayServer?.ip) {
        console.error(`No SSH Relay Server Found for setting up AWS Server!`);
        process.exit(1);
    }

    const {
        appSSHKeyName,
        finalServiceName,
        loadBalancerFirewallName,
        allowAllFirewallName,
    } = grabAppNames({
        name: deploymentName,
        serviceName,
    });

    const networkId = defaultNetwork.VpcId;

    const firewall =
        service.type == "load_balancer"
            ? (
                  await TurboCIAWS.firewalls.get({
                      name: loadBalancerFirewallName,
                      region,
                  })
              )?.firewall
            : (
                  await TurboCIAWS.firewalls.get({
                      name: allowAllFirewallName,
                      region,
                  })
              )?.firewall;

    const finalServerType = (service.server_type ||
        "t3.micro") as _InstanceType;

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
                            platform: "aws",
                        });

                        const existingServerRes = await TurboCIAWS.servers.list(
                            {
                                name: serviceInstanceName,
                                region,
                            },
                        );

                        const existingServer = existingServerRes.servers?.[0];

                        const finalOS = service.os || "ami-0702a3ce7f850fb87";

                        if (
                            existingServer?.InstanceId &&
                            existingServer.ImageId == finalOS &&
                            existingServer.InstanceType == finalServerType &&
                            deployment.location &&
                            existingServer.Placement?.AvailabilityZone?.startsWith(
                                deployment.location,
                            )
                        ) {
                            resolve(true);
                            return;
                        }

                        if (existingServer?.InstanceId) {
                            await TurboCIAWS.servers.delete({
                                instance_id: existingServer.InstanceId,
                                region,
                            });
                            global.UPDATE_LOAD_BALANCERS = true;
                        }

                        const newServerRes = await TurboCIAWS.servers.create({
                            name: serviceInstanceName,
                            instance_type: finalServerType,
                            ssh_key_name: appSSHKeyName,
                            tags: [
                                {
                                    Key: AppNames["TurboCILabelNameKey"],
                                    Value: deploymentName,
                                },
                                {
                                    Key: AppNames["TurboCILabelServiceNameKey"],
                                    Value: finalServiceName,
                                },
                            ],
                            image_id: finalOS,
                            region: deployment.location!,
                            network_id: networkId,
                            firewalls: firewall?.GroupId
                                ? [firewall?.GroupId]
                                : undefined,
                            public_ip:
                                service.type == "load_balancer" ||
                                service.enable_public_ip
                                    ? true
                                    : false,
                            deployment,
                        });

                        const newServer = newServerRes.servers?.[0];

                        if (!newServer?.InstanceId) {
                            console.error(
                                `Couldn't create server #${instanceIndex} for service \`${serviceName}\``,
                            );
                            process.exit(1);
                        }

                        const privateIP = newServer.PrivateIpAddress;
                        const publicIP = newServer.PublicIpAddress;

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
