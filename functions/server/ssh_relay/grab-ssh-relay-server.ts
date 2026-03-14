import type { SSHRelayServerReturn, TCIConfigDeployment } from "@/types";
import hetzner from "./hetzner";
import grabSSHRelayServerInitSH from "./grab-ssh-relay-init-sh";
import relayExecSSH from "@/utils/ssh/relay-exec-ssh";
import aws from "./aws";
import gcp from "./gcp";
import azure from "./azure";
import execSSH from "@/utils/ssh/exec-ssh";
import grabDirNames from "@/utils/grab-dir-names";
import syncRemoteDirs from "../sync-remote-dirs";

type Params = {
    deployment: Omit<TCIConfigDeployment, "services">;
    init?: boolean;
};

export default async function grabSSHRelayServer({
    deployment,
    init,
}: Params): Promise<SSHRelayServerReturn | undefined> {
    let relaySrv: SSHRelayServerReturn | undefined;

    const existingRelaySrv =
        global.RELAY_SERVERS[`${deployment.deployment_name}`];

    if (existingRelaySrv?.ip) {
        relaySrv = existingRelaySrv;
    } else {
        global.ORA_SPINNER.text = `Grabbing Relay Server ...`;
        global.ORA_SPINNER.start();

        switch (deployment.provider) {
            case "hetzner":
                relaySrv = await hetzner({ deployment });

                global.RELAY_SERVERS[`${deployment.deployment_name}`] = {
                    ip: relaySrv.ip,
                    private_ip: relaySrv.private_ip,
                };
                break;
            case "aws":
                relaySrv = await aws({ deployment });

                global.RELAY_SERVERS[`${deployment.deployment_name}`] = {
                    ip: relaySrv.ip,
                    private_ip: relaySrv.private_ip,
                };
                break;
            case "gcp":
                relaySrv = await gcp({ deployment });

                global.RELAY_SERVERS[`${deployment.deployment_name}`] = {
                    ip: relaySrv.ip,
                    private_ip: relaySrv.private_ip,
                };
                break;
            case "azure":
                relaySrv = await azure({ deployment });

                global.RELAY_SERVERS[`${deployment.deployment_name}`] = {
                    ip: relaySrv.ip,
                    private_ip: relaySrv.private_ip,
                };
                break;

            default:
                break;
        }

        global.ORA_SPINNER.stop();
    }

    if (init && relaySrv?.ip) {
        global.ORA_SPINNER.text = `Initializing Relay server ...`;
        global.ORA_SPINNER.start();

        let initSh = grabSSHRelayServerInitSH({ deployment });

        const {
            relayServerSSHDir,
            relayServerBunScriptsDir,
            relayShDir,
            relayConfigDir,
            sshDir,
        } = grabDirNames();

        await execSSH({
            cmd: [
                `mkdir -p ${relayServerSSHDir}\n`,
                `mkdir -p ${relayServerBunScriptsDir}\n`,
                `mkdir -p ${relayConfigDir}\n`,
                `mkdir -p ${relayShDir}\n`,
            ],
            ip: relaySrv.ip,
        });

        const initRelay = await relayExecSSH({
            cmd: initSh,
            deployment,
            log_error: true,
        });

        if (initRelay) {
            global.ORA_SPINNER.succeed(`Relay Server initialization Success!`);
        } else {
            global.ORA_SPINNER.fail(`Relay Server initialization Failed!`);
            process.exit(1);
        }

        const sync_ssh = await syncRemoteDirs({
            dst: relayServerSSHDir,
            src: sshDir,
            ip: relaySrv.ip,
        });

        global.ORA_SPINNER.stop();
    }

    return relaySrv;
}
