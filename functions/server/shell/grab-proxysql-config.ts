import type {
    ParsedDeploymentServiceConfig,
    TCIGlobalConfig,
} from "@/types";
import grabNormalizedServers from "@/utils/grab-normalized-servers";

type Params = {
    proxysql_service: ParsedDeploymentServiceConfig;
    deployment: TCIGlobalConfig;
};

type ServerEntry = {
    ip: string;
    port: number;
    hostgroup: number;
    max_connections: number;
};

/**
 * Generates a proxysql.cnf initial configuration file.
 *
 * ProxySQL loads this file only on the first start (or when its internal
 * SQLite database is absent). It supports MySQL 5.5+ and MariaDB 5.5+ for
 * query routing, read/write splitting, and connection multiplexing.
 * ProxySQL does NOT support PostgreSQL — use HAProxy for that.
 *
 * Backend server IPs are discovered from the target services at deploy time.
 * Use separate `hostgroup` values on target entries to distinguish writer
 * (e.g. 10) and reader (e.g. 20) pools; pair with query_rules to route
 * accordingly.
 */
export default async function grabProxySQLConfig({
    proxysql_service,
    deployment,
}: Params): Promise<string | undefined> {
    const psConfig = proxysql_service.proxysql;

    if (!psConfig?.target_services?.[0]) {
        return undefined;
    }

    const serverEntries: ServerEntry[] = [];

    for (const target of psConfig.target_services) {
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

        for (const srv of servers) {
            if (!srv?.private_ip) continue;
            serverEntries.push({
                ip: srv.private_ip,
                port: target.port,
                hostgroup: target.hostgroup ?? 0,
                max_connections: target.max_connections ?? 200,
            });
        }
    }

    if (!serverEntries.length) return undefined;

    const adminUser = psConfig.admin_user ?? "admin";
    const adminPass = psConfig.admin_password ?? "";
    const adminPort = psConfig.admin_port ?? 6032;
    const listenPort = psConfig.listen_port ?? 6033;
    const monitorUser = psConfig.monitor_user ?? "proxysql_monitor";
    const monitorPass = psConfig.monitor_password ?? "";
    const writerHG = psConfig.writer_hostgroup ?? 10;
    const readerHG = psConfig.reader_hostgroup ?? 20;

    let cnf = `datadir="/var/lib/proxysql"\n\n`;

    cnf += `admin_variables=\n`;
    cnf += `{\n`;
    cnf += `    admin_credentials="${adminUser}:${adminPass}"\n`;
    cnf += `    mysql_ifaces="0.0.0.0:${adminPort}"\n`;
    cnf += `}\n\n`;

    cnf += `mysql_variables=\n`;
    cnf += `{\n`;
    cnf += `    threads=4\n`;
    cnf += `    max_connections=2048\n`;
    cnf += `    interfaces="0.0.0.0:${listenPort}"\n`;
    cnf += `    monitor_username="${monitorUser}"\n`;
    cnf += `    monitor_password="${monitorPass}"\n`;
    cnf += `    monitor_history=600000\n`;
    cnf += `    monitor_connect_interval=60000\n`;
    cnf += `    monitor_ping_interval=10000\n`;
    cnf += `    ping_interval_server_msec=120000\n`;
    cnf += `    ping_timeout_server=500\n`;
    cnf += `    connect_timeout_server=3000\n`;
    cnf += `}\n\n`;

    cnf += `mysql_servers=\n(\n`;
    for (let i = 0; i < serverEntries.length; i++) {
        const entry = serverEntries[i]!;
        cnf += `    { address="${entry.ip}", port=${entry.port}, hostgroup=${entry.hostgroup}, max_connections=${entry.max_connections} }`;
        cnf += i < serverEntries.length - 1 ? ",\n" : "\n";
    }
    cnf += `)\n\n`;

    if (psConfig.query_rules?.[0]) {
        cnf += `mysql_query_rules=\n(\n`;
        for (let i = 0; i < psConfig.query_rules.length; i++) {
            const rule = psConfig.query_rules[i]!;
            cnf += `    {\n`;
            cnf += `        rule_id=${rule.rule_id ?? i + 1}\n`;
            cnf += `        active=1\n`;
            if (rule.match_digest) {
                cnf += `        match_digest="${rule.match_digest}"\n`;
            }
            if (rule.destination_hostgroup !== undefined) {
                cnf += `        destination_hostgroup=${rule.destination_hostgroup}\n`;
            }
            cnf += `        apply=${rule.apply !== false ? 1 : 0}\n`;
            if (rule.comment) {
                cnf += `        comment="${rule.comment}"\n`;
            }
            cnf += `    }`;
            cnf += i < psConfig.query_rules.length - 1 ? ",\n" : "\n";
        }
        cnf += `)\n\n`;
    }

    cnf += `mysql_replication_hostgroups=\n(\n`;
    cnf += `    { writer_hostgroup=${writerHG}, reader_hostgroup=${readerHG} }\n`;
    cnf += `)\n`;

    return cnf;
}
