import _ from "lodash";
import relayExecSSH from "@/utils/ssh/relay-exec-ssh";
import type { DefaultPrepParams, ResponseObject } from "@/types";
import grabDirNames from "@/utils/grab-dir-names";
import bunGrabBulkSyncScripts from "@/utils/bun-scripts/bun-grab-bulk-sync-script";
import path from "path";
import grabGitCloneURL from "@/utils/grab-git-clone-url";
import grabGitRepoName from "@/utils/grab-git-repo-name";

const { relayServerRsyncDir } = grabDirNames();

export default async function (
    params: DefaultPrepParams,
): Promise<ResponseObject> {
    const { service, deployment, servers } = params;

    if (!service.git) {
        return { success: true };
    }

    try {
        const servers_private_ips = servers
            .map((srv) => srv.private_ip)
            .filter((ip) => Boolean(ip)) as string[];

        const git_array = Array.isArray(service.git)
            ? service.git
            : [service.git];

        for (let i = 0; i < git_array.length; i++) {
            const service_git = git_array[i];

            if (!service_git) continue;

            const git_url = service_git.repo_url;
            const repo_name = grabGitRepoName({ git_url });
            const git_url_object = new URL(git_url);

            if (!repo_name) continue;

            const git_platform = service_git.paradigm || "github";
            const git_clone_url = grabGitCloneURL({
                full_name: repo_name,
                platform: git_platform,
                public_repo: service_git.public_repo,
                username: service_git.username,
                host: service_git.host || git_url_object.host,
            });

            if (!git_clone_url) continue;

            const relay_dst = path.join(
                relayServerRsyncDir,
                service.service_name,
                "git",
                repo_name,
            );

            global.ORA_SPINNER.text = "Setting up Git ...";
            global.ORA_SPINNER.start();

            let cmd = ``;

            cmd += `set -e\n\n`;

            cmd += `if ! command -v git >/dev/null 2>&1; then\n`;
            cmd += `    echo "Installing git ..."\n`;
            cmd += `    apt-get install -y git\n`;
            cmd += `fi\n`;

            cmd += `mkdir -p "$(dirname "${relay_dst}")"\n`;
            cmd += `if [ ! -d "${relay_dst}/.git" ]; then\n`;
            cmd += `    git clone "${git_clone_url}" "${relay_dst}"\n`;
            cmd += `elif ! git -C "${relay_dst}" remote get-url origin 2>/dev/null | grep -q "${repo_name}"; then\n`;
            cmd += `    rm -rf "${relay_dst}"\n`;
            cmd += `    git clone "${git_clone_url}" "${relay_dst}"\n`;
            cmd += `else\n`;
            cmd += `    git -C "${relay_dst}" pull\n`;
            cmd += `fi\n`;

            if (service_git.branch) {
                cmd += `git -C "${relay_dst}" fetch origin "${service_git.branch}"\n`;
                cmd += `git -C "${relay_dst}" checkout "${service_git.branch}"\n`;
                cmd += `git -C "${relay_dst}" pull\n`;
            }

            const src = relay_dst + "/";
            const dst = (service_git.work_dir || "/turboci/app") + "/";

            const sync_cmd = await relayExecSSH({
                cmd: bunGrabBulkSyncScripts({
                    dst,
                    src,
                    private_server_ips: servers_private_ips,
                    parrallel: true,
                    relay_ignore: [".git"],
                }),
                deployment,
                bun: true,
                return_cmd_only: true,
            });

            cmd += `${sync_cmd}\n`;

            cmd += `echo "Git Setup Success!"\n`;

            const res = await relayExecSSH({
                cmd,
                deployment,
                log_error: true,
            });

            if (!res) {
                console.error(
                    `\`${service.service_name}\` service git prep failed!`,
                );
                process.exit(1);
            }
        }

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
    } catch (error: any) {
        console.error(`Git Preparation Error => ${error.message}`);
        process.exit(1);
    }
}
