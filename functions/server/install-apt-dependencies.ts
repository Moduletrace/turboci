import type { TCIConfigDeployment } from "@/types";
import execSSH from "@/utils/ssh/exec-ssh";

type Params = {
    ip: string;
    user?: string;
    dependencies?: string[];
    use_relay_server?: boolean;
    deployment: Omit<TCIConfigDeployment, "services">;
};

export default async function installAptDependencies({
    user = "root",
    ip,
    dependencies,
    use_relay_server,
    deployment,
}: Params) {
    if (!dependencies?.[0]) {
        return false;
    }

    const dependenciesString = dependencies.join(" ");

    const install = await execSSH({
        cmd: `apt install -y ${dependenciesString}`,
        ip,
        user,
        use_relay_server,
        deployment,
    });

    return Boolean(install);
}
