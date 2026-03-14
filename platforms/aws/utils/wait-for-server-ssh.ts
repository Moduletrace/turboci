import execSSH from "@/utils/ssh/exec-ssh";
import type { Instance } from "@aws-sdk/client-ec2";

type Params = {
    server: Instance;
    region: string;
};

export default async function awsWaitForServerSSH({ server, region }: Params) {
    let retries = 0;
    global.ORA_SPINNER.start();

    while (true) {
        if (retries > 10) {
            return false;
        }

        const ip = server.PublicIpAddress;

        if (!ip) {
            console.error(`${server.InstanceId} has no public IP address.`);
            process.exit(1);
        }

        const serverCheck = await execSSH({
            cmd: [`uptime`],
            ip,
        });

        if (serverCheck?.match(/load average/i)) {
            break;
        }

        retries++;

        await Bun.sleep(2000);
    }

    return true;
}
