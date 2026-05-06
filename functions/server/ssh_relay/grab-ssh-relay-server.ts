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
import grabBashrcSetupSh from "../grab-bashrc-setup-sh";
import AppData from "@/data/app-data";
import grabSSHPrefix from "@/utils/ssh/grab-ssh-prefix";

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
        return existingRelaySrv;
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
    }

    if (init && relaySrv?.ip) {
        global.ORA_SPINNER.text = `Initializing Relay server ...`;
        global.ORA_SPINNER.start();

        let initSh = grabSSHRelayServerInitSH({ deployment });

        const { relayServerSSHDir, sshDir } = grabDirNames();

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
    }

    if (relaySrv?.ip) {
        global.ORA_SPINNER.text = `Relay Server post init ...`;
        global.ORA_SPINNER.start();

        const {
            relayServerSSHDir,
            relayServerBunScriptsDir,
            relayShDir,
            relayConfigDir,
            serviceBashrcDir,
            relayServerSshPrivateKeyFile,
        } = grabDirNames();

        let cmd = ``;

        cmd += `mkdir -p ${relayServerSSHDir}\n`;
        cmd += `mkdir -p ${relayServerBunScriptsDir}\n`;
        cmd += `mkdir -p ${relayConfigDir}\n`;
        cmd += `mkdir -p ${relayShDir}\n`;

        cmd += `${grabBashrcSetupSh()}\n`;

        const ssh_prefix = grabSSHPrefix({
            key_file: relayServerSshPrivateKeyFile,
        });

        cmd += `cat > ${serviceBashrcDir}/cmds.sh << 'FREQUENTCMDSEOF'\n`;
        cmd += `\n`;
        cmd += `# Function to SSH into private network servers\n`;
        cmd += `RELAY_SSH() {\n`;
        cmd += `    ${ssh_prefix} root@"$1"\n`;
        cmd += `}\n`;
        cmd += `FREQUENTCMDSEOF\n`;

        await relayExecSSH({
            cmd,
            deployment,
            options: { timeout: AppData["DefaultInitTimeoutMilliseconds"] },
        });
    }

    global.ORA_SPINNER.succeed(`Relay Server setup complete!`);
    global.ORA_SPINNER.stop();

    return relaySrv;
}
