import _ from "lodash";
import relayExecSSH from "@/utils/ssh/relay-exec-ssh";
import grabServerPrepSH from "@/utils/ssh/shell-scripts/grab-server-prep-sh";
import syncDirectories from "@/functions/server/sync-directories";
import grabLoadBalancerServerPrepSH from "@/functions/server/shell/grab-lb-server-prep-sh";
import grabMaxScaleServerPrepSH from "@/functions/server/shell/grab-maxscale-server-prep-sh";
import grabHAProxyServerPrepSH from "@/functions/server/shell/grab-haproxy-server-prep-sh";
import grabProxySQLServerPrepSH from "@/functions/server/shell/grab-proxysql-server-prep-sh";
import grabMariadbGaleraServerPrepSH from "@/functions/server/shell/grab-mariadb-galera-server-prep-sh";
import grabPostgresServerPrepSH from "@/functions/server/shell/grab-postgres-server-prep-sh";
import grabMysqlServerPrepSH from "@/functions/server/shell/grab-mysql-server-prep-sh";
import type { DefaultPrepParams, ResponseObject } from "@/types";
import grabDockerServerPrepSH from "@/functions/server/shell/grab-docker-server-prep-sh";

export default async function (
    params: DefaultPrepParams,
): Promise<ResponseObject> {
    const { service, deployment, servers } = params;

    const serversPrivateIPs = servers
        .map((srv) => srv.private_ip)
        .filter((ip) => Boolean(ip)) as string[];

    global.ORA_SPINNER.text = "Installing Dependencies ...";
    global.ORA_SPINNER.start();

    const finalCmd = await (async () => {
        switch (service.type) {
            case "load_balancer":
                return await grabLoadBalancerServerPrepSH({
                    private_server_ips: serversPrivateIPs.map(
                        (ip) => `"${ip}"`,
                    ),
                    load_balancer_service: service,
                    deployment,
                    bun: true,
                });

            case "haproxy":
                return await grabHAProxyServerPrepSH({
                    private_server_ips: serversPrivateIPs.map(
                        (ip) => `"${ip}"`,
                    ),
                    haproxy_service: service,
                    deployment,
                    bun: true,
                });

            case "proxysql":
                return await grabProxySQLServerPrepSH({
                    private_server_ips: serversPrivateIPs.map(
                        (ip) => `"${ip}"`,
                    ),
                    proxysql_service: service,
                    deployment,
                    bun: true,
                });

            case "mariadb-galera":
                return await grabMariadbGaleraServerPrepSH({
                    private_server_ips: serversPrivateIPs.map(
                        (ip) => `"${ip}"`,
                    ),
                    service,
                    deployment,
                    bun: true,
                });

            case "postgres":
                return await grabPostgresServerPrepSH({
                    private_server_ips: serversPrivateIPs.map(
                        (ip) => `"${ip}"`,
                    ),
                    service,
                    deployment,
                    bun: true,
                });

            case "mysql":
                return await grabMysqlServerPrepSH({
                    private_server_ips: serversPrivateIPs.map(
                        (ip) => `"${ip}"`,
                    ),
                    service,
                    deployment,
                    bun: true,
                });

            case "docker":
                return await grabDockerServerPrepSH({
                    private_server_ips: serversPrivateIPs.map(
                        (ip) => `"${ip}"`,
                    ),
                    service,
                    deployment,
                    bun: true,
                });

            default:
                return await grabServerPrepSH({
                    private_server_ips: serversPrivateIPs.map(
                        (ip) => `"${ip}"`,
                    ),
                    service,
                    deployment,
                    bun: true,
                });
        }
    })();

    if (!finalCmd) {
        global.ORA_SPINNER.stop();
        return {
            success: true,
        };
    }

    const res = await relayExecSSH({
        cmd: finalCmd,
        deployment,
        log_error: true,
        bun: true,
    });

    if (!res) {
        console.error(`\`${service.service_name}\` service prep failed!`);
        process.exit(1);
    }

    global.ORA_SPINNER.succeed(`Dependencies installed Successfully!`);

    global.ORA_SPINNER.text = `Syncing Directories ...`;
    global.ORA_SPINNER.start();

    const syncDirs = await syncDirectories({
        ips: serversPrivateIPs,
        dir_mappings: service.dir_mappings,
        use_relay_server: true,
        deployment,
        service,
        service_name: service.service_name,
        options: { stdio: "ignore" },
    });

    // if (!syncDirs) {
    //     console.error(
    //         `Directories sync for \`${service.service_name}\` failed!`
    //     );
    //     process.exit(1);
    // }

    global.ORA_SPINNER.succeed(`Directories Synced Successfully!`);

    return {
        success: true,
    };
}
