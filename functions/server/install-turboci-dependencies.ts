import type {
    TCIConfig,
    TCIConfigDeployment,
    TurboCIDependencies,
    TurboCIPreferedOS,
} from "@/types";
import execSSH from "@/utils/ssh/exec-ssh";

type Params = {
    ip: string;
    user?: string;
    dependencies?: (typeof TurboCIDependencies)[number]["package_name"][];
    os: (typeof TurboCIPreferedOS)[number];
    use_relay_server?: boolean;
    deployment: Omit<TCIConfigDeployment, "services">;
};

export default async function installTurboCIDependencies({
    user = "root",
    ip,
    dependencies,
    os,
    use_relay_server,
    deployment,
}: Params) {
    if (!dependencies?.[0]) {
        return false;
    }

    for (let i = 0; i < dependencies.length; i++) {
        const turboCIDependency = dependencies[i];

        const cmd = turboCiDepsCmds({ dependency: turboCIDependency, os });

        if (!cmd) continue;

        await execSSH({
            cmd,
            ip,
            user,
            use_relay_server,
            deployment,
        });
    }

    return true;
}

type CmdParams = {
    dependency?: (typeof TurboCIDependencies)[number]["package_name"];
    os: (typeof TurboCIPreferedOS)[number];
};

export function turboCiDepsCmds({ dependency, os }: CmdParams) {
    switch (dependency) {
        case "bun":
            let bunInstall = `if ! command -v bun >/dev/null 2>&1; then\n`;

            bunInstall += `    apt update && apt install -y zip unzip curl\n`;
            bunInstall += `    curl -fsSL https://bun.com/install | bash\n`;
            bunInstall += `    export BUN_INSTALL="$HOME/.bun"\n`;
            bunInstall += `    export PATH="$BUN_INSTALL/bin:$PATH"\n`;
            bunInstall += `fi\n`;

            return bunInstall;

        case "docker":
            let dockerInstall = `if ! command -v docker >/dev/null 2>&1; then\n`;

            dockerInstall += `    apt-get install -y ca-certificates curl\n`;
            dockerInstall += `    install -m 0755 -d /etc/apt/keyrings\n`;

            if (os == "ubuntu") {
                dockerInstall += `    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc\n`;
            } else {
                dockerInstall += `    curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc\n`;
            }

            dockerInstall += `    chmod a+r /etc/apt/keyrings/docker.asc\n`;

            if (os == "ubuntu") {
                dockerInstall += `    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null\n`;
            } else {
                dockerInstall += `    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/debian\n`;
            }

            dockerInstall += `    apt-get update\n`;
            dockerInstall += `    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin\n`;
            dockerInstall += `fi\n`;

            return dockerInstall;

        case "node":
            if (os == "debian" || os == "ubuntu") {
                let nodeInstall = `if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then\n`;
                // nodeInstall += `    apt-get update -y\n`;
                // nodeInstall += `    apt-get install -y curl ca-certificates gnupg\n`;
                // nodeInstall += `    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /usr/share/keyrings/nodesource.gpg\n`;
                // nodeInstall += `    VERSION=node_22.x\n`;
                // nodeInstall += `    DISTRO="\\$(lsb_release -s -c)"\n`;
                // nodeInstall += `    echo "deb [signed-by=/usr/share/keyrings/nodesource.gpg] https://deb.nodesource.com/\\$VERSION \\$DISTRO main" | tee /etc/apt/sources.list.d/nodesource.list\n`;
                // nodeInstall += `    apt-get update -y\n`;
                // nodeInstall += `    apt-get install -y nodejs npm\n`;

                nodeInstall += `    apt update -y\n`;
                nodeInstall += `    apt install -y curl ca-certificates gnupg\n`;
                nodeInstall += `    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash\n`;
                nodeInstall += `    \. "$HOME/.nvm/nvm.sh"\n`;
                nodeInstall += `    nvm install 22\n`;
                nodeInstall += `fi\n`;

                return nodeInstall;
            }
            return undefined;

        default:
            return undefined;
    }
}
