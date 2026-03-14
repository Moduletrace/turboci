import TurboCIAzure from "@/platforms/azure";
import type {
    TCIConfigDeployment,
    TCIConfigServiceConfig,
} from "../../../../types";
import { AppNames } from "../../../../utils/app-names";
import grabAppNames from "../../../../utils/grab-app-names";

type Params = {
    service: TCIConfigServiceConfig;
    serviceName: string;
    deployment: Omit<TCIConfigDeployment, "services">;
};

export default async function ({ service, serviceName, deployment }: Params) {
    const deploymentName = deployment.deployment_name;

    const { finalServiceName } = grabAppNames({
        name: deploymentName,
        serviceName,
    });

    const finalInstances =
        typeof service.instances == "number" ? service.instances : 1;

    const allServersRes = await TurboCIAzure.servers.list({
        deployment_name: deploymentName,
        tags: { [AppNames["TurboCILabelServiceNameKey"]]: finalServiceName },
    });

    const allServers = allServersRes.servers || [];

    if (allServers.length !== finalInstances) {
        for (let i = 0; i < allServers.length; i++) {
            if (i + 1 <= finalInstances) continue;

            const instance = allServers[i];
            if (instance?.name) {
                await TurboCIAzure.servers.delete({
                    deployment_name: deploymentName,
                    name: instance.name,
                });
            }
        }
    }

    return true;
}
