import { exec, execSync, type ExecSyncOptions } from "child_process";
import grabSSHPrefix from "./grab-ssh-prefix";
import grabSSHRelayServer from "@/functions/server/ssh_relay/grab-ssh-relay-server";
import type { TCIConfigDeployment } from "@/types";
import grabDirNames from "../grab-dir-names";

type Param = {
    cmd: string | string[];
    deployment: Omit<TCIConfigDeployment, "services">;
    debug?: boolean;
    user?: string;
    options?: ExecSyncOptions;
    detached?: boolean;
    return_cmd_only?: boolean;
    exit_on_error?: boolean;
    log_error?: boolean;
    bun?: boolean;
};

export default async function relayExecSSH({
    cmd,
    debug,
    user = "root",
    options,
    detached,
    deployment,
    return_cmd_only,
    exit_on_error,
    log_error,
    bun,
}: Param): Promise<string | undefined> {
    try {
        const {
            relayServerBunScriptsDir,
            relayServerBunScriptFile,
            relayShExecFile,
            localRelayShExecFile,
        } = grabDirNames();
        const relayServer = await grabSSHRelayServer({ deployment });

        if (!relayServer) {
            console.error(`Couldn't grab Relay Server for execSSH function!`);
            process.exit(1);
        }

        let relaySh = `\n`;
        // let relaySh = `#!/bin/bash\n`;

        const parsedCmd =
            typeof cmd == "string"
                ? cmd
                : Array.isArray(cmd)
                  ? cmd.join("\n")
                  : undefined;

        if (bun) {
            if (exit_on_error) {
                relaySh += `set -e\n`;
                relaySh += `\n`;
            }
            relaySh += `mkdir -p ${relayServerBunScriptsDir}\n`;
            relaySh += `cat << 'RELAYHEREDOC' > ${relayServerBunScriptFile}\n`;
            relaySh += `${parsedCmd}\n`;
            relaySh += `RELAYHEREDOC\n`;
            relaySh += `bun ${relayServerBunScriptFile}\n`;
        } else {
            const finalSumCmd = exit_on_error
                ? `set -e\n\n${parsedCmd}\n`
                : parsedCmd;

            relaySh += `${finalSumCmd}\n`;
        }

        if (return_cmd_only) {
            return relaySh;
        }

        if (debug) {
            console.log("====================================================");
            console.log("====================================================");
            console.log("====================================================");
            console.log(`SSH Command =>`, relaySh);
            console.log("====================================================");
            console.log("====================================================");
            console.log("====================================================");
        }

        let relayCmd = ``;

        let relayCmdPrefix = grabSSHPrefix();

        relayCmd += `${relayCmdPrefix}`;
        relayCmd += ` ${user}@${relayServer.ip}`;

        relayCmd += ` << 'TURBOCIRELAYEXECEOF'\n`;
        relayCmd += `${relaySh}\n`;
        relayCmd += `TURBOCIRELAYEXECEOF\n`;

        if (debug) {
            console.log("============================================");
            console.log("============================================");
            console.log("============================================");
            console.log(`SSH Relay Cmd =>`, relayCmd);
            console.log("============================================");
            console.log("============================================");
            console.log("============================================");
        }

        if (detached) {
            exec(relayCmd);
        } else {
            const str = execSync(relayCmd, {
                stdio: ["pipe", "pipe", "pipe"],
                ...options,
                encoding: "utf-8",
            });

            if (debug) {
                console.log("============================================");
                console.log("============================================");
                console.log("============================================");
                console.log(`SSH Result =>`, str);
                console.log("============================================");
                console.log("============================================");
                console.log("============================================");
            }

            return str.trim();
        }
    } catch (error: any) {
        if (debug || log_error) {
            console.error(`Relay SSH Error: ${error.message}`);
        }
        return undefined;
    }
}
