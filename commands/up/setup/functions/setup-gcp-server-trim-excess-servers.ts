import TurboCIGCP from "@/platforms/gcp";
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
    zone: string;
};

export default async function ({
    service,
    serviceName,
    deployment,
    zone,
}: Params) {
    const deploymentName = deployment.deployment_name;

    const { finalServiceName } = grabAppNames({
        name: deploymentName,
        serviceName,
    });

    const finalInstances =
        typeof service.instances == "number" ? service.instances : 1;

    const allServersRes = await TurboCIGCP.servers.list({
        zone,
        labels: { [AppNames["TurboCILabelServiceNameKey"]]: finalServiceName },
    });

    const allServers = allServersRes.servers || [];

    if (allServers.length !== finalInstances) {
        for (let i = 0; i < allServers.length; i++) {
            if (i + 1 <= finalInstances) continue;

            const instance = allServers[i];
            if (instance?.name) {
                await TurboCIGCP.servers.delete({ zone, name: instance.name });
            }
        }
    }

    return true;
}
