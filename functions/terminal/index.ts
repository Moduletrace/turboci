import type { TurbociControlServer } from "@/types";
import { type ExecOptions } from "child_process";
import grabDirNames from "@/utils/grab-dir-names";

type Params = {
    server: TurbociControlServer;
    options?: ExecOptions;
    user?: string;
};

export default async function ({ server, options, user = "root" }: Params) {
    try {
        const { sshPrivateKeyFile, relayServerSshPrivateKeyFile } =
            grabDirNames();

        // let cmd = `ssh -i ${sshPrivateKeyFile}`;
        // cmd += ` ${user}@${server.public_ip}`;
        // console.log(cmd);
        // await Bun.$`${cmd}`;

        // const ssh = spawnSync(
        //     "ssh",
        //     ["-i", sshPrivateKeyFile, `${user}@${server.public_ip}`],
        //     { stdio: "inherit" }
        // );

        if (!server.public_ip) {
            throw new Error(`Server must have a public IP address!`);
        }

        const sshBun = Bun.spawn(
            [
                "ssh",
                "-t",
                "-i",
                sshPrivateKeyFile,
                `${user}@${server.public_ip}`,
            ],
            {
                stdio: ["inherit", "inherit", "inherit"],
            }
        );

        await sshBun.exited;

        // const ssh = pty.spawn(
        //     "ssh",
        //     ["-i", sshPrivateKeyFile, `${user}@${server.public_ip}`],
        //     {
        //         name: "xterm-color",
        //         cols: process.stdout.columns,
        //         rows: process.stdout.rows,
        //         cwd: process.env.HOME,
        //         env: process.env,
        //     }
        // );

        // // pipe pty output to your terminal
        // ssh.onData((data) => process.stdout.write(data));

        // // forward keyboard input to ssh
        // process.stdin.setRawMode(true);
        // process.stdin.resume();
        // process.stdin.on("data", (data) => ssh.write(data.toString()));

        // const proc = Bun.spawn(
        //     [
        //         "script",
        //         "-q",
        //         "/dev/null",
        //         `ssh -i ${sshPrivateKeyFile} ${user}@${server.public_ip}`,
        //     ],
        //     {
        //         stdin: "inherit",
        //         stdout: "inherit",
        //         stderr: "inherit",
        //     }
        // );

        // await proc.exited;

        // execSync(cmd, {
        //     stdio: "inherit",
        //     ...options,
        // });
    } catch (error: any) {
        console.error(`Control terminal ERROR =>`, error.message);
        return;
    }
}
