import type { DefaultDeploymentParams, ServiceScriptObject } from "@/types";
import { AppNames } from "@/utils/app-names";
import bunGrabPrivateIPsBulkScripts from "@/utils/bun-scripts/bun-grab-private-ips-bulk-scripts";
import grabNormalizedServers from "@/utils/grab-normalized-servers";
import grabSHEnvs from "@/utils/ssh/grab-sh-env";
import relayExecSSH from "@/utils/ssh/relay-exec-ssh";
import chalk from "chalk";
import { existsSync, readFileSync, statSync } from "fs";
import path from "path";

const Paradigms = ["preflight", "start", "postflight"] as const;

export default async function ({
    deployment,
    service,
}: DefaultDeploymentParams) {
    const allCommands: {
        [k in (typeof Paradigms)[number]]?: ServiceScriptObject;
    } = {};

    for (let i = 0; i < Paradigms.length; i++) {
        const paradigm = Paradigms[i];
        if (!paradigm) continue;

        let serviceType = service.type || "default";

        let sh = "";
        let work_dir = service.dir_mappings?.[0]?.dst;

        switch (serviceType) {
            // Proxy service types are fully configured in the prepare phase.
            // Their daemons (nginx, maxscale, haproxy, proxysql) are started
            // there too — nothing to do in the run phase.
            case "load_balancer":
            case "haproxy":
            case "proxysql":
                break;

            default:
                const defaultCmds =
                    paradigm == "preflight"
                        ? service.run?.preflight?.cmds
                        : paradigm == "postflight"
                          ? service.run?.postflight?.cmds
                          : paradigm == "start"
                            ? service.run?.start?.cmds
                            : undefined;

                if (defaultCmds) {
                    for (let i = 0; i < defaultCmds.length; i++) {
                        const cmd = defaultCmds[i];
                        sh += `${cmd}\n`;

                        // if (
                        //     paradigm == "start" &&
                        //     defaultCmds.length - 1 == i
                        // ) {
                        //     sh += `${cmd} &\n`;
                        //     sh += `sleep 5\n`;
                        // } else {
                        //     sh += `${cmd}\n`;
                        // }
                    }
                }

                const new_work_dir =
                    paradigm == "preflight"
                        ? service.run?.preflight?.work_dir
                        : paradigm == "postflight"
                          ? service.run?.postflight?.work_dir
                          : paradigm == "start"
                            ? service.run?.start?.work_dir
                            : work_dir;

                work_dir = new_work_dir;

                const target_file = service.run?.preflight?.file
                    ? path.resolve(process.cwd(), service.run?.preflight?.file)
                    : undefined;

                if (
                    target_file &&
                    existsSync(target_file) &&
                    statSync(target_file).isFile()
                ) {
                    const targetFileSHText = readFileSync(
                        target_file,
                        "utf-8",
                    ).replace(/!#\/bin\/.*/, "");

                    sh += `\n${targetFileSHText}\n`;
                    break;
                }

                const defaultFile = path.join(
                    process.cwd(),
                    paradigm == "preflight"
                        ? AppNames["TurbosyncPreflightDefaultFile"]
                        : paradigm == "postflight"
                          ? AppNames["TurbosyncPostflightDefaultFile"]
                          : paradigm == "start"
                            ? AppNames["TurbosyncStartDefaultFile"]
                            : "",
                );

                if (existsSync(defaultFile) && statSync(defaultFile).isFile()) {
                    const shText = readFileSync(defaultFile, "utf-8").replace(
                        /!#\/bin\/.*/,
                        "",
                    );

                    sh += `\n${shText}\n`;
                }

                break;
        }

        allCommands[paradigm] = {
            sh,
            work_dir,
            deployment_name: deployment.deployment_name,
            service_name: service.service_name,
        };
    }

    const targetServicesShArr = [
        allCommands.preflight,
        allCommands.start,
        allCommands.postflight,
    ];

    let finalCmds = `set -e\n\n`;

    const envsStr = grabSHEnvs({ deployment, service });

    finalCmds += envsStr;

    // if (service.init) {
    //     for (let i = 0; i < service.init.length; i++) {
    //         const init_sh = service.init[i];
    //         finalCmds += `${init_sh}\n`;
    //     }
    // }

    for (let i = 0; i < targetServicesShArr.length; i++) {
        const serviceSh = targetServicesShArr[i];

        if (!serviceSh || !serviceSh.sh.match(/./)) {
            continue;
        }

        if (serviceSh.work_dir) {
            finalCmds += `cd ${serviceSh.work_dir}\n`;
        }

        finalCmds += `${serviceSh.sh}\n`;
    }

    const finalInstances =
        typeof service.instances == "number" ? service.instances : 1;

    const servers = await grabNormalizedServers({
        provider: deployment.provider,
        instances: finalInstances,
        service,
        target_deployment: deployment,
    });

    if (!servers?.[0]) {
        return true;
    }

    if (!finalCmds.match(/\w/)) {
        return true;
    }

    if (service.healthcheck?.cmd && service.healthcheck?.test) {
        let healthcheckCmd = ``;
        healthcheckCmd += `healthcheck_max_attempts=5\n`;
        healthcheckCmd += `healthcheck_attempt=1\n`;
        healthcheckCmd += `while [ $healthcheck_attempt -le $healthcheck_max_attempts ]; do\n`;
        healthcheckCmd += `    healthcheck=$(${service.healthcheck.cmd})\n`;
        // healthcheckCmd += `    echo "$healthcheck"\n`;
        healthcheckCmd += `    if echo "$healthcheck" | grep "${service.healthcheck.test}"; then\n`;
        healthcheckCmd += `        echo "Healthcheck succeeded."\n`;
        healthcheckCmd += `        exit 0\n`;
        healthcheckCmd += `    else\n`;
        healthcheckCmd += `        ((healthcheck_attempt++))\n`;
        healthcheckCmd += `        sleep 5\n`;
        healthcheckCmd += `    fi\n`;
        healthcheckCmd += `done\n`;
        healthcheckCmd += `echo "${AppNames["HealthcheckErrorMsg"]}" >&2\n`;
        healthcheckCmd += `exit 1\n`;
        finalCmds += healthcheckCmd;
    }

    const private_server_ips = servers
        .map((srv) => srv.private_ip)
        .filter((srv) => Boolean(srv)) as string[];

    const finalCmdBun = bunGrabPrivateIPsBulkScripts({
        private_server_ips,
        script: finalCmds,
        parrallel: true,
        init: service.init,
    });

    const run = await relayExecSSH({
        cmd: finalCmdBun,
        deployment,
        exit_on_error: true,
        log_error: true,
        bun: true,
    });

    if (!run || run.match(new RegExp(`${AppNames["HealthcheckErrorMsg"]}`))) {
        console.error(
            `\nERROR running applications: ${chalk.white(
                chalk.italic(service.service_name),
            )} flight failed!\n`,
        );
        process.exit(1);
    }

    return true;
}
