import { execSync } from "child_process";
import path from "path";
import { statSync } from "fs";
import grabSSHPrefix from "@/utils/ssh/grab-ssh-prefix";
import type {
    ResponseObject,
    SyncRemoteDirsParams,
    TCIConfig,
    TCIConfigDeployment,
} from "@/types";
import grabDirNames from "@/utils/grab-dir-names";
import grabSSHRelayServer from "./ssh_relay/grab-ssh-relay-server";
import relayExecSSH from "@/utils/ssh/relay-exec-ssh";
import bunGrabBulkSyncScripts from "@/utils/bun-scripts/bun-grab-bulk-sync-script";

export default async function syncRelayRemoteDirs({
    dst,
    src,
    delete: del,
    ignore_path,
    ignore_patterns,
    debug,
    deployment,
    ip,
    ips,
    options,
    service,
    service_name,
    use_gitignore,
    relay_ignore,
}: Omit<SyncRemoteDirsParams, "deployment"> & {
    deployment: Omit<TCIConfigDeployment, "services">;
    ips?: string[];
}): Promise<ResponseObject> {
    const { relayServerRsyncDir, relayServerSshPrivateKeyFile } =
        grabDirNames();

    const relayServer = await grabSSHRelayServer({ deployment });

    if (!relayServer?.ip) {
        console.log(`Relay Server not found!`);
        process.exit(1);
    }

    let relay_destination = relayServerRsyncDir;

    const srcStats = statSync(src);
    const isSrcFile = srcStats.isFile();

    const dst_dir = isSrcFile ? path.dirname(dst) : path.normalize(dst);

    if (service_name) {
        relay_destination = path.join(
            relayServerRsyncDir,
            service_name,
            "app",
            dst,
        );
    }

    const final_relay_dst = isSrcFile
        ? relay_destination
        : `${path.normalize(relay_destination.replace(/\/+$/, ""))}/`;

    const relay_dst_dir = isSrcFile
        ? path.dirname(final_relay_dst)
        : final_relay_dst;

    try {
        let cmd = `rsync -avz`;
        cmd += ` -e '${grabSSHPrefix()}'`;

        if (del) {
            cmd += ` --delete`;
        }

        if (use_gitignore) {
            cmd += ` --exclude-from='${path.join(src, ".gitignore")}'`;
        }

        if (ignore_path) {
            cmd += ` --exclude-from='${ignore_path}'`;
        }

        if (ignore_patterns) {
            cmd += ignore_patterns
                .map((patt) => ` --exclude='${patt}'`)
                .join("");
        }

        cmd += ` ${src} root@${relayServer.ip}:${final_relay_dst}`;

        if (debug) {
            console.log(`Rsync CMD => \`${cmd}\``);
        }

        const sync = await relayExecSSH({
            cmd: `mkdir -p ${relay_dst_dir}`,
            deployment,
        });

        const syncRes = execSync(cmd, {
            stdio: "inherit",
            encoding: "utf-8",
            ...options,
        });

        /**
         * # Sync relay to private servers
         */
        let syncRelayToPrivateCmd = `rsync -avz`;

        const relaySSHPrefix = grabSSHPrefix({
            key_file: relayServerSshPrivateKeyFile,
        });

        syncRelayToPrivateCmd += ` -e '${relaySSHPrefix}'`;
        syncRelayToPrivateCmd += ` --delete`;
        syncRelayToPrivateCmd += ` ${final_relay_dst}`;

        if (ips) {
            if (debug) {
                console.log("ips", ips);
            }

            const finalCmdBun = bunGrabBulkSyncScripts({
                dst,
                src: final_relay_dst,
                private_server_ips: ips,
                parrallel: true,
                relay_ignore,
                local_src: src,
            });

            const syncIPs = await relayExecSSH({
                cmd: finalCmdBun,
                deployment,
                bun: true,
                debug,
            });

            if (!syncIPs) {
                return {
                    success: false,
                    msg: `No Sync IPs => ${syncIPs}`,
                };
            }
        } else if (ip) {
            const finalCmd = `${relaySSHPrefix} mkdir -p ${dst_dir}\n${syncRelayToPrivateCmd} root@${ip}:${dst}\necho "Sync Success!"`;

            const syncIP = await relayExecSSH({
                cmd: finalCmd,
                deployment,
                debug,
            });

            if (!syncIP) {
                return {
                    success: false,
                    msg: `No Sync IP => ${syncIP}`,
                };
            }
        }

        return {
            success: true,
        };
    } catch (error: any) {
        console.log(`RSYNC ERROR: ${error.message}`);
        process.exit(1);
    }
}
