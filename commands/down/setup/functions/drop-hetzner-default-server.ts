import grabServerInstanceName from "@/utils/grab-server-instance-name";
import Hetzner from "../../../../platforms/hetzner";
import type {
    ParsedDeploymentServiceConfig,
    TCIConfigDeployment,
} from "../../../../types";
import { AppNames } from "../../../../utils/app-names";
import grabAppNames from "../../../../utils/grab-app-names";
import _ from "lodash";

type Params = {
    service: ParsedDeploymentServiceConfig;
    deployment: Omit<TCIConfigDeployment, "services">;
};

export default async function ({ service, deployment }: Params) {
    const deploymentName = deployment.deployment_name;
    const INSTANCES_CHUNK_SIZE = 10;

    const { finalServiceName } = grabAppNames({
        name: deploymentName,
        serviceName: service.service_name,
    });

    const servers = await Hetzner.servers.list({
        label_selector: `${AppNames["TurboCILabelServiceNameKey"]}==${finalServiceName}`,
    });

    if (!servers.servers?.[0]) {
        return true;
    }

    const finalInstances =
        typeof service.instances == "number" ? service.instances : 1;

    const chunks = _.chunk(_.range(finalInstances), INSTANCES_CHUNK_SIZE);

    for (let c = 0; c < chunks.length; c++) {
        const chunk = chunks[c];

        if (!chunk) continue;

        await Promise.all(
            chunk.map(
                (val, i) =>
                    new Promise(async (resolve) => {
                        const instanceIndex = INSTANCES_CHUNK_SIZE * c + i;

                        const serviceInstanceName = grabServerInstanceName({
                            index: instanceIndex,
                            serviceName: finalServiceName,
                            platform: "hetzner",
                        });

                        const serverRes = await Hetzner.servers.list({
                            name: serviceInstanceName,
                        });

                        const server = serverRes.servers?.[0];
                        if (!server?.id) {
                            resolve(false);
                            return;
                        }

                        const deleteServer = await Hetzner.servers.delete({
                            server_id: server.id,
                        });

                        if (!deleteServer) {
                            resolve(false);
                        }

                        resolve(true);
                    }),
            ),
        );

        await Bun.sleep(1000);
    }

    return true;
}
