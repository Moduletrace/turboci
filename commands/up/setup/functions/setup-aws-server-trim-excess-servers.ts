import TurboCIAWS from "@/platforms/aws";
import type {
    TCIConfig,
    TCIConfigDeployment,
    TCIConfigServiceConfig,
} from "../../../../types";
import { AppNames } from "../../../../utils/app-names";
import grabAppNames from "../../../../utils/grab-app-names";
import _ from "lodash";

type Params = {
    service: TCIConfigServiceConfig;
    serviceName: string;
    deployment: Omit<TCIConfigDeployment, "services">;
};

export default async function ({ service, serviceName, deployment }: Params) {
    const deploymentName = deployment.deployment_name;

    const { finalServiceName, appNetworkName } = grabAppNames({
        name: deploymentName,
        serviceName,
    });

    const finalInstances =
        typeof service.instances == "number" ? service.instances : 1;

    const defaultNetwork = (
        await TurboCIAWS.networks.get({
            network_name: appNetworkName,
            region: deployment.location!,
        })
    ).network;

    if (!defaultNetwork?.VpcId) {
        console.log(`Project Network not found for trimming excess servers`);
        process.exit(1);
    }

    const allServersRes = await TurboCIAWS.servers.list({
        tag: { [AppNames["TurboCILabelServiceNameKey"]]: finalServiceName },
        region: deployment.location!,
    });

    if (
        allServersRes.servers &&
        allServersRes.servers.length !== finalInstances
    ) {
        for (let i = 0; i < allServersRes.servers.length; i++) {
            if (i + 1 <= finalInstances) {
                continue;
            }

            const instance = allServersRes.servers[i];

            await TurboCIAWS.servers.delete({
                instance_id: instance?.InstanceId,
                region: deployment.location!,
            });
        }
    }

    return true;
}
