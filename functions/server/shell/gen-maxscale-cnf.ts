// import type {
//     MaxscaleServerEntry,
//     ParsedDeploymentServiceConfig,
//     TCIGlobalConfig,
// } from "@/types";
// import grabNormalizedServers from "@/utils/grab-normalized-servers";

// type Params = {
//     maxscale_service: ParsedDeploymentServiceConfig;
//     deployment: TCIGlobalConfig;
// };

// export default async function generateMaxscaleConfig({
//     deployment,
//     maxscale_service,
// }: Params) {
//     const mxConfig = maxscale_service.maxscale;

//     if (!mxConfig?.target_services?.[0]) {
//         return undefined;
//     }

//     const serverEntries: MaxscaleServerEntry[] = [];

//     for (const target of mxConfig.target_services) {
//         const targetSvc = deployment.services.find(
//             (s) => s.service_name === target.service_name,
//         );
//         if (!targetSvc) continue;

//         const instances =
//             typeof targetSvc.instances === "number" ? targetSvc.instances : 1;
//         const clusters =
//             typeof targetSvc.clusters === "number" ? targetSvc.clusters : 1;

//         const servers = await grabNormalizedServers({
//             provider: deployment.provider,
//             service: targetSvc,
//             instances,
//             clusters,
//             target_deployment: deployment,
//             grab_children: true,
//         });

//         if (!servers?.[0]) continue;

//         for (let i = 0; i < servers.length; i++) {
//             const srv = servers[i];
//             if (!srv?.private_ip) continue;
//             serverEntries.push({
//                 name: `${target.service_name}-node-${i}`,
//                 ip: srv.private_ip,
//                 port: target.port,
//             });
//         }
//     }

//     if (!serverEntries.length) return undefined;

//     const readWriteServers = ["primary"];
//     const readOnlyServers = [
//         ...(replicas?.map((rpl) => grabReplicaName(rpl.server_id)) || []),
//     ];

//     const allServers = [...readWriteServers, ...readOnlyServers];

//     const sslDir = "/ssl";

//     let mxCnf = `[maxscale]\nthreads=auto\n`;
//     mxCnf += `admin_host=0.0.0.0\n`;
//     mxCnf += `admin_secure_gui=false\n`;

//     /**
//      * # Monitor Config
//      */
//     mxCnf += `\n[MariaDB-Monitor]\n`;
//     mxCnf += `type=monitor\n`;
//     mxCnf += `module=mariadbmon\n`;
//     mxCnf += `servers=${allServers.join(",")}\n`;
//     mxCnf += `user=${AppNames["MaxScaleUserName"]}\n`;
//     mxCnf += `password=${process.env.DSQL_MAXSCALE_PASSWORD}\n`;
//     mxCnf += `auto_failover=true\n`;
//     mxCnf += `auto_rejoin=true\n`;
//     mxCnf += `enforce_read_only_slaves=1\n`;

//     /**
//      * # Read-Write Service Config
//      */
//     mxCnf += `\n[Read-Write-Service]\n`;
//     mxCnf += `type=service\n`;
//     mxCnf += `router=readwritesplit\n`;
//     // mxCnf += `servers=${readWriteServers.join(",")}\n`;
//     mxCnf += `servers=${allServers.join(",")}\n`;
//     mxCnf += `user=${AppNames["MaxScaleUserName"]}\n`;
//     mxCnf += `password=${process.env.DSQL_MAXSCALE_PASSWORD}\n`;
//     mxCnf += `master_failure_mode=fail_on_write\n`;
//     mxCnf += `slave_selection_criteria=LEAST_CURRENT_OPERATIONS\n`;
//     mxCnf += `max_slave_replication_lag=30s\n`;

//     /**
//      * # Read-Write Listener Config
//      */
//     mxCnf += `\n[Read-Write-Listener]\n`;
//     mxCnf += `type=listener\n`;
//     mxCnf += `service=Read-Write-Service\n`;
//     mxCnf += `protocol=MariaDBClient\n`;
//     mxCnf += `port=${appConfig.maxscale?.read_write_port}\n`;
//     mxCnf += `ssl=true\n`;
//     mxCnf += `ssl_ca=${sslDir}/ca-cert.pem\n`;
//     mxCnf += `ssl_cert=${sslDir}/server-cert.pem\n`;
//     mxCnf += `ssl_key=${sslDir}/server-key.pem\n`;

//     /**
//      * # Read-Only Service Config
//      */
//     // mxCnf += `\n[Read-Only-Service]\n`;
//     // mxCnf += `type=service\n`;
//     // mxCnf += `router=readconnroute\n`;
//     // mxCnf += `servers=${readOnlyServers.join(",")}\n`;
//     // mxCnf += `user=${AppNames["MaxScaleUserName"]}\n`;
//     // mxCnf += `password=${process.env.DSQL_MAXSCALE_PASSWORD}\n`;
//     // mxCnf += `router_options=slave\n`;

//     /**
//      * # Read-Only Listener Config
//      */
//     // mxCnf += `\n[Read-Only-Listener]\n`;
//     // mxCnf += `type=listener\n`;
//     // mxCnf += `service=Read-Only-Service\n`;
//     // mxCnf += `protocol=MariaDBClient\n`;
//     // mxCnf += `port=${appConfig.maxscale?.read_only_port}\n`;
//     // mxCnf += `ssl=true\n`;
//     // mxCnf += `ssl_ca=${sslDir}/ca-cert.pem\n`;
//     // mxCnf += `ssl_cert=${sslDir}/server-cert.pem\n`;
//     // mxCnf += `ssl_key=${sslDir}/server-key.pem\n`;

//     /**
//      * # Primary Server Config
//      */
//     mxCnf += `\n[primary]\n`;
//     mxCnf += `type=server\n`;
//     mxCnf += `address=${appConfig.mariadb_servers?.primary.ip}\n`;
//     mxCnf += `port=${appConfig.mariadb_servers?.primary.port}\n`;
//     mxCnf += `protocol=MariaDBBackend\n`;
//     mxCnf += `proxy_protocol=true\n`;
//     mxCnf += `ssl=true\n`;
//     mxCnf += `ssl_ca=${sslDir}/ca-cert.pem\n`;
//     // mxCnf += `ssl_cert=${sslDir}/server-cert.pem\n`;
//     // mxCnf += `ssl_key=${sslDir}/server-key.pem\n`;
//     // mxCnf += `ssl_verify_peer_certificate=true\n`;
//     // mxCnf += `ssl_verify_host=true\n`;

//     if (appConfig.mariadb_servers?.replicas) {
//         /**
//          * # Replicas Server Config
//          */
//         for (let i = 0; i < appConfig.mariadb_servers.replicas.length; i++) {
//             const replica = appConfig.mariadb_servers.replicas[i];

//             const replicaName = grabReplicaName(replica.server_id);

//             mxCnf += `\n[${replicaName}]\n`;
//             mxCnf += `type=server\n`;
//             mxCnf += `address=${replica.ip}\n`;
//             mxCnf += `port=${replica.port}\n`;
//             mxCnf += `protocol=MariaDBBackend\n`;
//             mxCnf += `proxy_protocol=true\n`;
//             mxCnf += `ssl=true\n`;
//             mxCnf += `ssl_ca=${sslDir}/ca-cert.pem\n`;
//             // mxCnf += `ssl_cert=${sslDir}/server-cert.pem\n`;
//             // mxCnf += `ssl_key=${sslDir}/server-key.pem\n`;
//             // mxCnf += `ssl_verify_peer_certificate=true\n`;
//             // mxCnf += `ssl_verify_host=true\n`;
//         }
//     }

//     /**
//      * # Return Config
//      */
//     return mxCnf;
// }

// function grabReplicaName(id: string | number): string {
//     return `replica${id}`;
// }
