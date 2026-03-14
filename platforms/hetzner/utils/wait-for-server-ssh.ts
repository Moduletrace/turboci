import execSSH from "@/utils/ssh/exec-ssh";
import type { HETZNER_EXISTING_SERVER } from "../types";

type Params = {
    server: HETZNER_EXISTING_SERVER;
};

export default async function hetznerWaitForServerSSH({ server }: Params) {
    let retries = 0;
    const maxRetries = 20;
    global.ORA_SPINNER.start("Waiting for SSH to be ready...");

    const ip = server.public_net?.ipv4?.ip;

    if (!ip) {
        console.error(`${server.name} has no public IP address.`);
        process.exit(1);
    }

    while (retries < maxRetries) {
        try {
            const serverCheck = await execSSH({
                cmd: [`uptime`],
                ip,
            });

            if (serverCheck?.match(/load average/i)) {
                // global.ORA_SPINNER.succeed("SSH is ready!");
                return true;
            }
        } catch (error) {
            global.ORA_SPINNER.text = `Waiting for SSH... (Attempt ${retries + 1}/${maxRetries})`;
        }

        retries++;
        await Bun.sleep(5000);
    }

    global.ORA_SPINNER.fail("SSH wait timed out.");
    return false;
}
