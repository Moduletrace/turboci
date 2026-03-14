import { exec, execSync, type ExecSyncOptions } from "child_process";
import grabSSHPrefix from "./grab-ssh-prefix";
import type { TCIConfigDeployment } from "@/types";
import relayExecSSH from "./relay-exec-ssh";
import _ from "lodash";

type Param = {
    cmd: string | string[];
    debug?: boolean;
    ip: string;
    user?: string;
    options?: ExecSyncOptions;
    detached?: boolean;
    use_relay_server?: boolean;
    deployment?: Omit<TCIConfigDeployment, "services">;
    return_cmd_only?: boolean;
    cmd_prefix?: string;
};

export default async function execSSH(
    params: Param,
): Promise<string | undefined> {
    const {
        cmd,
        debug,
        ip,
        user = "root",
        options,
        detached,
        use_relay_server,
        return_cmd_only,
        deployment,
        cmd_prefix,
    } = params;

    try {
        let cmdPrefix = cmd_prefix || grabSSHPrefix();

        let finalCmd = `${cmdPrefix}`;
        finalCmd += ` ${user}@${ip}`;

        const parsedCmd =
            typeof cmd == "string"
                ? cmd
                : Array.isArray(cmd)
                  ? cmd.join("\n")
                  : undefined;

        finalCmd += ` << 'TURBOCIEXEC' \n${parsedCmd}\nTURBOCIEXEC`;

        if (debug) {
            console.log("finalCmd", finalCmd);
        }

        if (return_cmd_only) {
            return finalCmd;
        }

        if (use_relay_server) {
            if (!deployment) {
                console.error(
                    `Deployment object is required for using ssh relay`,
                );
                process.exit(1);
            }

            return await relayExecSSH({
                ..._.omit(params, ["use_relay_server", "user", "cmd_prefix"]),
                cmd: finalCmd,
                deployment,
            });
        }

        const str = detached
            ? ""
            : execSync(finalCmd, {
                  stdio: "pipe",
                  ...options,
                  encoding: "utf-8",
              });

        if (debug) {
            console.log(str);
        }

        if (detached) {
            exec(finalCmd);
        }

        return str.trim();
    } catch (error: any) {
        return undefined;
    }
}
