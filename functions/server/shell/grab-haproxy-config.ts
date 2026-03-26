import type {
    ParsedDeploymentServiceConfig,
    TCIGlobalConfig,
} from "@/types";
import grabNormalizedServers from "@/utils/grab-normalized-servers";

type Params = {
    haproxy_service: ParsedDeploymentServiceConfig;
    deployment: TCIGlobalConfig;
};

type BackendEntry = {
    name: string;
    ip: string;
    port: number;
    weight?: number;
    backup?: boolean;
    check_type?: string;
    check_interval?: string;
    check_rise?: number;
    check_fall?: number;
};

/**
 * Generates an haproxy.cfg configuration file.
 *
 * HAProxy is a generic TCP/HTTP proxy that works across database backends
 * (PostgreSQL, MySQL, MariaDB, Redis, etc.) and HTTP services. Unlike
 * MaxScale or ProxySQL it does not inspect the database protocol beyond
 * the health check — it operates at the TCP layer by default.
 *
 * Backend server IPs are discovered from the target services at deploy
 * time. A stats frontend is always generated on `stats_port` (default 8404).
 */
export default async function grabHAProxyConfig({
    haproxy_service,
    deployment,
}: Params): Promise<string | undefined> {
    const hxConfig = haproxy_service.haproxy;

    if (!hxConfig?.target_services?.[0]) {
        return undefined;
    }

    const backendEntries: BackendEntry[] = [];

    for (const target of hxConfig.target_services) {
        const targetSvc = deployment.services.find(
            (s) => s.service_name === target.service_name,
        );
        if (!targetSvc) continue;

        const instances =
            typeof targetSvc.instances === "number" ? targetSvc.instances : 1;
        const clusters =
            typeof targetSvc.clusters === "number" ? targetSvc.clusters : 1;

        const servers = await grabNormalizedServers({
            provider: deployment.provider,
            service: targetSvc,
            instances,
            clusters,
            target_deployment: deployment,
            grab_children: true,
        });

        if (!servers?.[0]) continue;

        for (let i = 0; i < servers.length; i++) {
            const srv = servers[i];
            if (!srv?.private_ip) continue;
            backendEntries.push({
                name: `${target.service_name}-node-${i}`,
                ip: srv.private_ip,
                port: target.port,
                weight: target.weight,
                backup: target.backup,
                check_type: target.check?.type,
                check_interval: target.check?.interval,
                check_rise: target.check?.rise,
                check_fall: target.check?.fall,
            });
        }
    }

    if (!backendEntries.length) return undefined;

    const mode = hxConfig.mode ?? "tcp";
    const balance = hxConfig.balance ?? "roundrobin";
    const listenPort = hxConfig.listen_port ?? (mode === "http" ? 80 : 3306);
    const timeoutConnect = hxConfig.timeout_connect ?? "5s";
    const timeoutClient = hxConfig.timeout_client ?? "30s";
    const timeoutServer = hxConfig.timeout_server ?? "30s";
    const statsPort = hxConfig.stats_port ?? 8404;
    const statsUser = hxConfig.stats_user ?? "admin";
    const statsPassword = hxConfig.stats_password ?? "";

    let cnf = "";

    cnf += `global\n`;
    cnf += `    log /dev/log local0\n`;
    cnf += `    log /dev/log local1 notice\n`;
    cnf += `    chroot /var/lib/haproxy\n`;
    cnf += `    stats socket /run/haproxy/admin.sock mode 660 level admin expose-fd listeners\n`;
    cnf += `    stats timeout 30s\n`;
    cnf += `    user haproxy\n`;
    cnf += `    group haproxy\n`;
    cnf += `    daemon\n`;
    cnf += `\n`;
    cnf += `defaults\n`;
    cnf += `    log     global\n`;
    cnf += `    mode    ${mode}\n`;
    cnf += `    option  ${mode === "http" ? "httplog" : "tcplog"}\n`;
    cnf += `    option  dontlognull\n`;
    cnf += `    timeout connect ${timeoutConnect}\n`;
    cnf += `    timeout client  ${timeoutClient}\n`;
    cnf += `    timeout server  ${timeoutServer}\n`;
    cnf += `\n`;

    cnf += `frontend tci-frontend\n`;
    cnf += `    bind *:${listenPort}\n`;
    cnf += `    default_backend tci-backend\n`;
    cnf += `\n`;

    cnf += `backend tci-backend\n`;
    cnf += `    balance ${balance}\n`;

    // Protocol-aware health check option (based on first target's check type)
    const firstCheckType = hxConfig.target_services[0]?.check?.type;
    if (firstCheckType === "pgsql") {
        cnf += `    option pgsql-check user postgres\n`;
    } else if (firstCheckType === "mysql") {
        cnf += `    option mysql-check user haproxy_check\n`;
    } else if (firstCheckType === "http") {
        cnf += `    option httpchk GET /\n`;
    } else if (firstCheckType === "redis") {
        cnf += `    option tcp-check\n`;
        cnf += `    tcp-check send PING\\r\\n\n`;
        cnf += `    tcp-check expect string +PONG\n`;
    }

    for (const entry of backendEntries) {
        const interval = entry.check_interval ?? "2s";
        const rise = entry.check_rise ?? 2;
        const fall = entry.check_fall ?? 3;

        let line = `    server ${entry.name} ${entry.ip}:${entry.port}`;

        if (entry.check_type) {
            line += ` check inter ${interval} rise ${rise} fall ${fall}`;
        }

        if (entry.weight !== undefined) {
            line += ` weight ${entry.weight}`;
        }

        if (entry.backup) {
            line += ` backup`;
        }

        cnf += `${line}\n`;
    }

    // Stats frontend
    cnf += `\n`;
    cnf += `frontend tci-stats\n`;
    cnf += `    bind *:${statsPort}\n`;
    cnf += `    mode http\n`;
    cnf += `    stats enable\n`;
    cnf += `    stats uri /\n`;
    cnf += `    stats refresh 10s\n`;
    if (statsPassword) {
        cnf += `    stats auth ${statsUser}:${statsPassword}\n`;
    }
    cnf += `\n`;

    return cnf;
}
