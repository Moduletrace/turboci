import type {
    TCIConfigDeployment,
    TCIConfigServiceConfig,
    TCIConfigServiceConfigDirMApping,
} from "@/types";
import path from "path";
import syncRemoteDirs from "./sync-remote-dirs";
import { existsSync, statSync } from "fs";
import { AppNames } from "@/utils/app-names";
import execSSH from "@/utils/ssh/exec-ssh";
import type { ExecSyncOptions } from "child_process";

type Params = {
    ip?: string;
    ips?: string[];
    user?: string;
    dir_mappings?: TCIConfigServiceConfigDirMApping[];
    use_relay_server?: boolean;
    debug?: boolean;
    deployment?: Omit<TCIConfigDeployment, "services">;
    options?: ExecSyncOptions;
    service?: TCIConfigServiceConfig;
    service_name?: string;
};

export default async function syncDirectories({
    user = "root",
    ip,
    dir_mappings,
    use_relay_server,
    deployment,
    debug,
    ips,
    options,
    service,
    service_name,
}: Params) {
    if (!dir_mappings?.[0]) {
        return false;
    }

    try {
        for (let i = 0; i < dir_mappings.length; i++) {
            const dirMapping = dir_mappings[i];

            const src = dirMapping?.src
                ? path.resolve(process.cwd(), dirMapping.src)
                : undefined;

            if (!src) {
                console.error(`Sync mapping \`src\` does not exist`);
                process.exit(1);
            }

            const dst = dirMapping?.dst;

            if (!dst) {
                console.error(`Sync mapping \`dst\` does not exist`);
                process.exit(1);
            }

            const turboCIIgnoreFile = path.join(
                src,
                AppNames["RsyncDefaultIgnoreFile"],
            );

            if (ip) {
                await execSSH({
                    cmd: `mkdir -p ${dst}`,
                    ip,
                    use_relay_server,
                    deployment,
                });
            }

            const sync = await syncRemoteDirs({
                dst,
                ip,
                src,
                user,
                ignore_path:
                    dirMapping.ignore_file && existsSync(dirMapping.ignore_file)
                        ? dirMapping.ignore_file
                        : existsSync(turboCIIgnoreFile)
                          ? turboCIIgnoreFile
                          : undefined,
                ignore_patterns: dirMapping.ignore_patterns,
                delete: true,
                use_gitignore:
                    dirMapping.use_gitignore &&
                    !statSync(src).isFile() &&
                    existsSync(path.join(src, ".gitignore")),
                use_relay_server,
                deployment,
                debug,
                ips,
                options,
                service,
                service_name,
                relay_ignore: dirMapping.relay_ignore,
            });

            if (!sync) {
                console.error(`Sync mapping \`${src}\` to \`${dst}\` failed!`);
                process.exit(1);
            }
        }

        return true;
    } catch (error: any) {
        console.error(error.message);
        process.exit(1);
    }
}
