import type {
    MaxscaleServerEntry,
    ParsedDeploymentServiceConfig,
    TCIGlobalConfig,
} from "@/types";
import grabNormalizedServers from "@/utils/grab-normalized-servers";

type Params = {
    maxscale_service: ParsedDeploymentServiceConfig;
    deployment: TCIGlobalConfig;
};

/**
 * Generates a maxscale.cnf configuration file.
 *
 * Discovers all private IPs of the target backend services (mariadb-galera
 * or mysql) at deploy time and writes them as [server] sections. The monitor,
 * service (router), and listener sections are derived from the MaxScale
 * service config.
 */
export default async function grabMaxScaleConfig({
    maxscale_service,
    deployment,
}: Params): Promise<string | undefined> {
    const mxConfig = maxscale_service.maxscale;

    if (!mxConfig?.target_services?.[0]) {
        return undefined;
    }

    const serverEntries: MaxscaleServerEntry[] = [];

    for (const target of mxConfig.target_services) {
        const targetSvc = deployment.services.find(
            (s) => s.service_name === target.service_name,
        );
        if (!targetSvc) continue;

        const servers = await grabNormalizedServers({
            provider: deployment.provider,
            service: targetSvc,
            target_deployment: deployment,
            grab_children: true,
        });

        if (!servers?.[0]) continue;

        for (let i = 0; i < servers.length; i++) {
            const srv = servers[i];
            if (!srv?.private_ip) continue;
            serverEntries.push({
                name: `${target.service_name}-node-${i}`,
                ip: srv.private_ip,
                port: target.port,
            });
        }
    }

    if (!serverEntries.length) return undefined;

    const serverNames = serverEntries.map((e) => e.name);
    const serversStr = serverNames.join(",");
    const user = mxConfig.user ?? "maxscale";
    const password = mxConfig.password ?? "";
    const router = mxConfig.router ?? "readwritesplit";
    const monitor = mxConfig.monitor ?? "galeramon";
    const adminPort = mxConfig.admin_port ?? 8989;
    const adminUser = mxConfig.admin_user ?? "admin";
    const adminPassword = mxConfig.admin_password ?? "";
    const listenPort = mxConfig.listen_port ?? 3306;

    let cnf = "";

    cnf += `[maxscale]\n`;
    cnf += `threads=auto\n`;
    cnf += `admin_host=0.0.0.0\n`;
    // cnf += `admin_port=${adminPort}\n`;
    // cnf += `admin_user=${adminUser}\n`;
    // cnf += `admin_password=${adminPassword}\n`;
    cnf += `admin_secure_gui=false\n`;
    cnf += `\n`;

    for (const entry of serverEntries) {
        cnf += `[${entry.name}]\n`;
        cnf += `type=server\n`;
        cnf += `address=${entry.ip}\n`;
        cnf += `port=${entry.port}\n`;
        cnf += `protocol=MariaDBBackend\n`;
        cnf += `proxy_protocol=true\n`;
        cnf += `\n`;
    }

    /**
     * # Monitor Config
     */
    cnf += `\n[MariaDB-Monitor]\n`;
    cnf += `type=monitor\n`;
    cnf += `module=${monitor}\n`;
    cnf += `servers=${serversStr}\n`;
    cnf += `user=${user}\n`;
    cnf += `password=${password}\n`;
    cnf += `monitor_interval=2s\n`;

    /**
     * # Read-Write Service Config
     */
    cnf += `\n[Read-Write-Service]\n`;
    cnf += `type=service\n`;
    cnf += `router=readwritesplit\n`;
    cnf += `servers=${serversStr}\n`;
    cnf += `user=${user}\n`;
    cnf += `password=${password}\n`;
    cnf += `master_failure_mode=fail_on_write\n`;
    cnf += `slave_selection_criteria=LEAST_CURRENT_OPERATIONS\n`;
    cnf += `max_replication_lag=30s\n`;

    /**
     * # Read-Write Listener Config
     */
    cnf += `\n[Read-Write-Listener]\n`;
    cnf += `type=listener\n`;
    cnf += `service=Read-Write-Service\n`;
    cnf += `protocol=MariaDBClient\n`;
    cnf += `port=${listenPort}\n`;
    // cnf += `ssl=true\n`;
    // cnf += `ssl_ca=${sslDir}/ca-cert.pem\n`;
    // cnf += `ssl_cert=${sslDir}/server-cert.pem\n`;
    // cnf += `ssl_key=${sslDir}/server-key.pem\n`;

    // cnf += `[tci-monitor]\n`;
    // cnf += `type=monitor\n`;
    // cnf += `module=${monitor}\n`;
    // cnf += `servers=${serversStr}\n`;
    // cnf += `user=${user}\n`;
    // cnf += `password=${password}\n`;
    // cnf += `monitor_interval=2000ms\n`;
    // cnf += `auto_failover=true\n`;
    // cnf += `auto_rejoin=true\n`;
    // cnf += `enforce_read_only_slaves=1\n`;
    // cnf += `\n`;

    // cnf += `[tci-service]\n`;
    // cnf += `type=service\n`;
    // cnf += `router=${router}\n`;
    // cnf += `servers=${serversStr}\n`;
    // cnf += `user=${user}\n`;
    // cnf += `password=${password}\n`;
    // cnf += `\n`;

    // cnf += `[tci-listener]\n`;
    // cnf += `type=listener\n`;
    // cnf += `service=tci-service\n`;
    // cnf += `protocol=MariaDBClient\n`;
    // cnf += `port=${listenPort}\n`;
    // cnf += `\n`;

    return cnf;
}
