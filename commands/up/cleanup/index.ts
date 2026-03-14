import writeActiveConfig from "@/utils/write-active-config";
import cleanupServices from "./cleanup-services";
import grabDirNames from "@/utils/grab-dir-names";
import execSSH from "@/utils/ssh/exec-ssh";
import type { DeploymentAndServicesToUpdate, TCIGlobalConfig } from "@/types";
import grabActiveConfig from "@/utils/grab-active-config";
import _ from "lodash";

type Params = {
    deployments_and_services_to_update: DeploymentAndServicesToUpdate[];
};

export default async function ({ deployments_and_services_to_update }: Params) {
    global.ORA_SPINNER.text = `Cleaning up ...`;
    global.ORA_SPINNER.start();

    const cleanSrvs = await cleanupServices();

    if (cleanSrvs) {
        global.ORA_SPINNER.succeed(`Services Cleaned up!`);
    } else {
        global.ORA_SPINNER.fail(`Services Cleanup Failed!`);
        process.exit(1);
    }

    const currentConfig = global.CONFIGS;
    let new_configs: TCIGlobalConfig[] = [];

    if (currentConfig) {
        global.ORA_SPINNER.text = `Writing Config Files ...`;
        global.ORA_SPINNER.start();

        for (let i = 0; i < currentConfig.length; i++) {
            const deployment = currentConfig[i];

            if (!deployment) {
                continue;
            }

            const ip = global.RELAY_SERVERS[deployment.deployment_name]?.ip;

            if (!ip) {
                continue;
            }

            const deployment_and_services_to_update =
                deployments_and_services_to_update.find(
                    (d) =>
                        d.deployment.deployment_name ==
                        deployment.deployment_name,
                );

            let new_deployment = _.omit(_.cloneDeep(deployment), [
                "services",
            ]) as TCIGlobalConfig;
            const new_services = deployment.services.filter(
                (srv) =>
                    !deployment_and_services_to_update?.skipped_services.find(
                        (s) => s.service_name == srv.service_name,
                    ),
            );

            new_deployment.services = new_services;

            const { relayConfigJSON } = grabDirNames();

            const active_server_json = await execSSH({
                cmd: `cat ${relayConfigJSON}`,
                ip,
            });

            const active_server_config = (() => {
                try {
                    return JSON.parse(active_server_json || "");
                } catch (error) {
                    return undefined;
                }
            })() as TCIGlobalConfig | undefined;

            if (active_server_config?.services) {
                for (let j = 0; j < active_server_config.services.length; j++) {
                    const active_service = active_server_config.services[j];

                    if (
                        new_deployment.services?.find(
                            (srv) =>
                                srv.service_name ==
                                active_service?.service_name,
                        )
                    ) {
                        continue;
                    }

                    if (
                        active_service &&
                        deployment_and_services_to_update?.skipped_services.find(
                            (s) =>
                                s.service_name == active_service.service_name ||
                                s.service_name ==
                                    active_service.parent_service_name,
                        )
                    ) {
                        new_deployment.services?.push(active_service);
                    }
                }
            }

            const finalDeployment: TCIGlobalConfig = _.merge(new_deployment, {
                relay_server_ip: ip,
            });

            new_configs.push(finalDeployment);

            let cmd = ``;

            cmd += `cat << 'EOF' > ${relayConfigJSON}\n`;
            cmd += `${JSON.stringify(finalDeployment)}\n`;
            cmd += `EOF\n`;

            await execSSH({
                cmd,
                ip,
            });
        }

        global.ORA_SPINNER.succeed(`Config Files Written Successfully!`);

        writeActiveConfig({ config: new_configs });
    }

    global.ORA_SPINNER.stop();
}
