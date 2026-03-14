import Hetzner from "../../../../platforms/hetzner";
import type {
    TCIConfigDeployment,
    TCIConfigServiceConfig,
} from "../../../../types";
import { AppNames } from "../../../../utils/app-names";
import grabAppNames from "../../../../utils/grab-app-names";
import grabServerInstanceName from "../../../../utils/grab-server-instance-name";
import _ from "lodash";
import slugify from "@/utils/slugify";

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
        await Hetzner.networks.list({ name: appNetworkName })
    ).networks?.[0];

    if (!defaultNetwork?.id) {
        console.log(`Project Network not found for trimming excess servers`);
        process.exit(1);
    }

    const allServersRes = await Hetzner.servers.list({
        label_selector: `${AppNames["TurboCILabelServiceNameKey"]}==${finalServiceName}`,
    });

    if (
        allServersRes.meta?.pagination?.total_entries &&
        allServersRes.meta.pagination.total_entries !== finalInstances
    ) {
        for (let i = 0; i < allServersRes.meta.pagination.total_entries; i++) {
            if (i + 1 <= finalInstances) {
                continue;
            }

            const finalServerName = grabServerInstanceName({
                index: i,
                serviceName: finalServiceName,
                platform: "hetzner",
            });

            const srvToBeDel = allServersRes.servers?.find(
                (s) => s.name == slugify(finalServerName, "-"),
            );

            if (srvToBeDel?.id) {
                await Hetzner.servers.delete({
                    server_id: srvToBeDel.id,
                });
            }
        }
    }

    return true;
}
