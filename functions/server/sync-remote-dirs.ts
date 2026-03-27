import { execSync } from "child_process";
import path from "path";
import { statSync } from "fs";
import grabSSHPrefix from "@/utils/ssh/grab-ssh-prefix";
import type { ResponseObject, SyncRemoteDirsParams } from "@/types";
import syncRelayRemoteDirs from "./sync-relay-remote-dirs";

export default async function syncRemoteDirs(
    params: SyncRemoteDirsParams,
): Promise<ResponseObject> {
    const {
        user = "root",
        ip,
        ips,
        dst,
        src,
        delete: del,
        ignore_path,
        ignore_patterns,
        debug,
        use_relay_server,
        deployment,
        options,
        use_gitignore,
    } = params;

    const source = path.resolve(process.cwd(), src);
    const destination = path.resolve(process.cwd(), dst);

    const srcStats = statSync(source);
    const finalSrc = srcStats.isFile() ? source : `${path.normalize(source)}/`;

    const finalDst = srcStats.isFile()
        ? destination
        : `${path.normalize(destination)}/`;

    if (use_relay_server) {
        if (!deployment) {
            console.log(
                `Deployment object is required for Rsync with relay server!`,
            );
            process.exit(1);
        }

        return await syncRelayRemoteDirs({
            ...params,
            deployment,
            src: finalSrc,
            dst: finalDst,
            options,
        });
    }

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

        if (debug) {
            console.log(`Rsync CMD => \`${cmd}\``);
        }

        if (ip) {
            const final_cmd = `${cmd} ${finalSrc} ${user}@${ip}:${finalDst}`;

            execSync(final_cmd, {
                stdio: ["pipe", "pipe", "pipe"],
                ...options,
            });
        } else if (ips) {
            for (let i = 0; i < ips.length; i++) {
                const _ip = ips[i];

                const final_cmd = `${cmd} ${finalSrc} ${user}@${_ip}:${finalDst}`;

                execSync(final_cmd, {
                    stdio: ["pipe", "pipe", "pipe"],
                    ...options,
                });
            }
        }

        return {
            success: true,
        };
    } catch (error: any) {
        console.error(`RSYNC ERROR: ${error.message}`);
        return {
            success: false,
            msg: `RSYNC ERROR: ${error.message}`,
        };
    }
}
