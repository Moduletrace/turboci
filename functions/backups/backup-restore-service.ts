import type {
    BackupRestoreDirs,
    BackupRestoreParams,
    ResponseObject,
} from "@/types";
import grabDirNames from "@/utils/grab-dir-names";
import path from "path";
import grabSSHPrefix from "@/utils/ssh/grab-ssh-prefix";
import grabNormalizedServers from "@/utils/grab-normalized-servers";
import relayExecSSH from "@/utils/ssh/relay-exec-ssh";

export default async function backupRestoreService({
    service,
    deployment,
    dirs,
    action,
}: BackupRestoreParams): Promise<ResponseObject> {
    const {
        relayBackupsDir,
        relayServerSshPrivateKeyFile,
        mariaDBserviceBackupDir,
    } = grabDirNames();

    const service_backup_dir = path.join(relayBackupsDir, service.service_name);

    let final_dirs: BackupRestoreDirs[] = dirs || [];

    const target_deployment = global.CONFIGS?.[global.CURRENT_DEPLOYMENT_INDEX];
    const relay_ssh_prefix = grabSSHPrefix({
        key_file: relayServerSshPrivateKeyFile,
    });

    if (!target_deployment) {
        return {
            success: false,
            msg: `Deployment Not Found!`,
        };
    }

    const service_servers = await grabNormalizedServers({
        target_deployment,
        service,
    });

    const first_server = service_servers?.[0];

    if (!first_server?.private_ip) {
        return {
            success: false,
            msg: `First Server Not Found!`,
        };
    }

    if (service.type == "mariadb-galera") {
        final_dirs.push({
            src: mariaDBserviceBackupDir,
        });

        let cmd = ``;

        cmd += `${relay_ssh_prefix} root@${first_server.private_ip} << 'EOF'\n`;

        if (action == "backup") {
            cmd += `systemctl stop mariadb\n`;
            cmd += `\n`;
            cmd += `mariadb-backup --backup --target-dir=${mariaDBserviceBackupDir}`;
            cmd += ` --user=root --password='$MARIADB_ROOT_PASSWORD'\n`;
            cmd += `mariadb-backup --prepare --target-dir=${mariaDBserviceBackupDir}\n`;
        }

        cmd += `EOF\n`;

        await relayExecSSH({
            cmd,
            deployment,
            debug: true,
        });
    }

    for (let i = 0; i < final_dirs.length; i++) {
        const dir = final_dirs[i];

        if (!dir?.src) continue;

        const service_src_dir = dir.src;
        const relay_dst_dir = path.join(service_backup_dir, dir.src);

        let cmd = `rsync -az`;
        cmd += ` -e '${relay_ssh_prefix}'`;
        cmd += ` --delete`;

        if (action == "restore") {
            cmd += ` ${relay_dst_dir}/`;
            cmd += ` ${first_server.private_ip}:${service_src_dir}/`;
        } else {
            cmd += ` ${first_server.private_ip}:${service_src_dir}/`;
            cmd += ` ${relay_dst_dir}/`;
        }

        const sync = await relayExecSSH({
            cmd: [`mkdir -p ${relay_dst_dir}`, cmd],
            deployment,
        });
    }

    return {
        success: true,
    };
}
