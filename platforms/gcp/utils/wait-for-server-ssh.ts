import execSSH from "@/utils/ssh/exec-ssh";

type Params = {
    name: string;
    zone: string;
    public_ip: string;
};

export default async function gcpWaitForServerSSH({
    name,
    zone,
    public_ip,
}: Params) {
    let retries = 0;
    const maxRetries = 20;

    while (retries < maxRetries) {
        try {
            const serverCheck = await execSSH({
                cmd: [`uptime`],
                ip: public_ip,
            });

            if (serverCheck?.match(/load average/i)) {
                return true;
            }
        } catch (_error) {}

        retries++;
        await Bun.sleep(5000);
    }

    return false;
}
