import grabLoadBalancerServerPrepSH from "@/functions/server/shell/grab-lb-server-prep-sh";
import type { ParsedDeploymentServiceConfig, TCIGlobalConfig } from "@/types";
import grabNormalizedServers from "@/utils/grab-normalized-servers";
import relayExecSSH from "@/utils/ssh/relay-exec-ssh";
import chalk from "chalk";

type Params = {
    load_balancers: ParsedDeploymentServiceConfig[];
    service: ParsedDeploymentServiceConfig;
    services: ParsedDeploymentServiceConfig[];
    deployment: TCIGlobalConfig;
};

export default async function ({
    load_balancers,
    service,
    deployment,
    services,
}: Params) {
    global.ORA_SPINNER.text = `Updating load balancers after service updates ...`;
    global.ORA_SPINNER.start();

    for (let i = 0; i < load_balancers.length; i++) {
        const load_balancer = load_balancers[i];
        if (!load_balancer) continue;

        const loadBalancerServices = services.filter(
            (srv) =>
                srv.type !== "load_balancer" &&
                load_balancer.target_services?.find(
                    (tsrv) => srv.service_name == tsrv.service_name
                )
        );

        if (!loadBalancerServices?.[0]) continue;

        const finalInstances =
            typeof load_balancer.instances == "number"
                ? load_balancer.instances
                : 1;

        const servers = await grabNormalizedServers({
            provider: deployment.provider,
            instances: finalInstances,
            service: load_balancer,
            target_deployment: deployment,
            grab_children: true,
        });

        const private_server_ips_res = servers?.map((srv) => srv.private_ip);

        if (!private_server_ips_res?.[0]) {
            continue;
        }

        const private_server_ips = private_server_ips_res as string[];

        const newLoadBalancerConfig = await grabLoadBalancerServerPrepSH({
            deployment,
            private_server_ips,
            load_balancer_service: load_balancer,
            bun: true,
        });

        if (!newLoadBalancerConfig) {
            global.ORA_SPINNER.stop();
            return;
        }

        const updateLoadBalancerConfig = await relayExecSSH({
            cmd: newLoadBalancerConfig,
            deployment,
            log_error: true,
            bun: true,
        });

        if (!updateLoadBalancerConfig) {
            console.log(
                `${chalk.white(
                    chalk.bold(load_balancer.service_name)
                )} ${chalk.red(`could not be updated!`)}`
            );
            process.exit(1);
        }
    }

    global.ORA_SPINNER.stop();
}
