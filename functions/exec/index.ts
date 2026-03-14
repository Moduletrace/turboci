import type { TurbociControlServer } from "@/types";
import grabActiveConfig from "@/utils/grab-active-config";
import { execSync, type ExecOptions } from "child_process";
import bunGrabPrivateIPsBulkScripts from "@/utils/bun-scripts/bun-grab-private-ips-bulk-scripts";

type Params = {
    server: TurbociControlServer | TurbociControlServer[];
    cmd: string;
    deployment_name: string;
    options?: ExecOptions;
    relay_server?: boolean;
    /** Whether to run parralel on all servers */
    parrallel?: boolean;
    work_dir?: string;
};

export default async function ({
    server,
    options,
    cmd,
    deployment_name,
    relay_server: is_relay_server,
    parrallel,
    work_dir,
}: Params) {
    try {
        if (!Array.isArray(server) && !server.deployment_name) {
            console.error(`Server \`deployment_name\` is required`);
            return;
        }

        if (!Array.isArray(server) && !server.private_ip) {
            console.error(`Server \`private_ip\` is required`);
            return;
        }

        const activeConfig = global.ACTIVE_CONFIGS || grabActiveConfig();
        const deployment = activeConfig?.find(
            (d) => d.deployment_name == deployment_name
        );

        if (!deployment?.deployment_name) {
            console.error(`\`${deployment_name}\` deployment doesn't exist`);
            return;
        }

        let execCmd = cmd;

        const private_server_ips = (
            Array.isArray(server)
                ? server.map((s) => s.private_ip)
                : [server.private_ip]
        ).filter((s) => Boolean(s)) as string[];

        const relayCmd = is_relay_server
            ? execCmd
            : bunGrabPrivateIPsBulkScripts({
                  private_server_ips,
                  script: execCmd,
                  parrallel,
                  work_dir,
                  no_process_logs: true,
              });

        const user = "root";

        // let relayCmdFinal = await relayExecSSH({
        //     cmd: relayCmd,
        //     deployment,
        //     return_cmd_only: true,
        //     options,
        //     bun: is_relay_server ? undefined : true,
        //     log_error: true,
        //     user,
        // });

        // if (!relayCmdFinal) {
        //     throw new Error(`Relay SSH command couldn't be generated!`);
        // }

        // const res = execSync(relayCmdFinal, {
        //     stdio: ["pipe", "pipe", "pipe"],
        //     encoding: "utf-8",
        //     ...options,
        // });

        // return res;
    } catch (error: any) {
        console.error(`Control exec ERROR =>`, error.message);
        return;
    }
}
