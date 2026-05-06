import _ from "lodash";
import grabNormalizedServers from "@/utils/grab-normalized-servers";
import type { DefaultDeploymentParams, ResponseObject } from "@/types";
import bunGrabPrivateIPsBulkScripts from "@/utils/bun-scripts/bun-grab-private-ips-bulk-scripts";
import relayExecSSH from "@/utils/ssh/relay-exec-ssh";
import AppData from "@/data/app-data";
import grabSSHPrefix from "@/utils/ssh/grab-ssh-prefix";
import grabDirNames from "@/utils/grab-dir-names";
import path from "path";

const {
    relayBackupsDir,
    relayServerSshPrivateKeyFile,
    mariaDBserviceBackupDir,
} = grabDirNames();

export default async function restoreMariaDBGalera({
    deployment,
    service,
}: DefaultDeploymentParams): Promise<ResponseObject> {
    const servers = await grabNormalizedServers({
        service,
        target_deployment: deployment,
        grab_children: true,
    });

    const primary_server = servers?.[0];

    if (!primary_server) {
        return {
            success: false,
            msg: `Servers not found!`,
        };
    }

    let stop_cmd = ``;

    stop_cmd += `MY_IP=$(hostname -I | awk '{print $1}')\n\n`;
    stop_cmd += `systemctl stop mariadb\n`;
    stop_cmd += `if [[ "$MY_IP" == "${primary_server.private_ip}" ]]; then\n`;
    stop_cmd += `    rm -rf /var/lib/mysql\n`;
    stop_cmd += `fi\n`;

    const stop_all_servers_script = bunGrabPrivateIPsBulkScripts({
        private_server_ips: servers.map((srv) => srv.private_ip!),
        script: stop_cmd,
        parrallel: true,
        async: true,
    });

    const stop_all_servers = await relayExecSSH({
        cmd: stop_all_servers_script,
        deployment,
        log_error: true,
        bun: true,
        options: {
            timeout: AppData["DefaultInitTimeoutMilliseconds"],
        },
    });

    const relay_ssh_prefix = grabSSHPrefix({
        key_file: relayServerSshPrivateKeyFile,
    });

    let cmd = `rsync -az`;
    cmd += ` -e '${relay_ssh_prefix}'`;
    cmd += ` --delete`;

    const backup_src = path.join(relayBackupsDir, mariaDBserviceBackupDir);

    cmd += ` ${backup_src}/`;
    cmd += ` ${primary_server.private_ip}:/var/lib/mysql/`;

    console.log("cmd", cmd);

    const sync = await relayExecSSH({
        cmd,
        deployment,
    });

    delete global.ACTIVE_SERVICE_INFO[deployment.deployment_name]?.[
        service.service_name
    ];

    let start_cmd = ``;
    start_cmd += `/usr/local/bin/tci-galera-start.sh\n`;

    const start_all_servers_bun_script = bunGrabPrivateIPsBulkScripts({
        private_server_ips: servers.map((srv) => srv.private_ip!),
        script: start_cmd,
        parrallel: true,
        async: true,
    });

    const start_all_servers = await relayExecSSH({
        cmd: start_all_servers_bun_script,
        deployment,
        log_error: true,
        bun: true,
        options: {
            timeout: AppData["DefaultInitTimeoutMilliseconds"],
        },
    });

    return {
        success: true,
    };
}
