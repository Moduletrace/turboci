import AppData from "@/data/app-data";
import grabDirNames from "@/utils/grab-dir-names";
import { statSync } from "fs";
import _ from "lodash";
import path from "path";

type Params = {
    private_server_ips: string[];
    parrallel?: boolean;
    /**
     * Source on the host machine
     */
    local_src?: string;
    /**
     * Source on the relay server
     */
    src: string;
    /**
     * Destination on private servers
     */
    dst: string;
    relay_ignore?: string[];
};

export default function bunGrabBulkSyncScripts({
    private_server_ips,
    parrallel,
    src,
    dst,
    relay_ignore,
    local_src,
}: Params) {
    const { relayServerSshPrivateKeyFile } = grabDirNames();

    const srcStats = local_src ? statSync(local_src) : undefined;
    const isSrcFile = srcStats?.isFile();

    const dst_dir = isSrcFile ? path.dirname(dst) : path.normalize(dst);

    let bunCmd = "";

    bunCmd += `import _ from "lodash";\n`;
    bunCmd += `import { execSync } from "child_process";\n`;
    bunCmd += `\n`;
    bunCmd += `const SSH_KEY = "${relayServerSshPrivateKeyFile}";\n`;
    bunCmd += `const SSH_OPTS = \`-i \${SSH_KEY} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -C -c aes128-ctr\`;\n`;
    bunCmd += `const REMOTE_HOSTS = [${private_server_ips
        .map((h) => `"${h.replace(/\"/g, "")}"`)
        .join(", ")}];\n`;
    bunCmd += `const DEFAULT_SSH_USER = "root";\n`;
    bunCmd += `const BATCH_SIZE = ${AppData["private_server_batch_exec_size"]};\n`;
    bunCmd += `\n`;

    bunCmd += `async function run(host: string) {\n`;
    bunCmd += `    let execCmd = \`ssh \${SSH_OPTS} \${DEFAULT_SSH_USER}@\${host} mkdir -p ${dst_dir}\`;\n`;
    bunCmd += `    execCmd += \` && rsync -avz -e 'ssh \${SSH_OPTS}' --delete\`;\n`;
    if (relay_ignore) {
        bunCmd += relay_ignore
            .map((patt) => `    execCmd += \` --exclude='${patt}'\`;\n`)
            .join("");
    }
    bunCmd += `    execCmd += \` ${src} \${DEFAULT_SSH_USER}@\${host}:${dst}\`;\n`;
    bunCmd += `    try {\n`;
    bunCmd += `        execSync(execCmd);\n`;
    bunCmd += `        console.log("Sync Success!");\n`;
    bunCmd += `    } catch (error) {\n`;
    bunCmd += `        process.exit(1);\n`;
    bunCmd += `    }\n`;
    bunCmd += `}\n`;
    bunCmd += `\n`;

    if (parrallel) {
        bunCmd += `const first_host = REMOTE_HOSTS.splice(0,1)[0];\n`;
        bunCmd += `await run(first_host)\n`;
        bunCmd += `\n`;
        bunCmd += `const chunks = _.chunk(REMOTE_HOSTS, BATCH_SIZE);\n`;
        bunCmd += `for (let i = 0; i < chunks.length; i++) {\n`;
        bunCmd += `    const chunk = chunks[i];\n`;
        bunCmd += `    const runChunk = await Promise.all(chunk.map(h => run(h)));\n`;
        bunCmd += `}\n`;
    } else {
        bunCmd += `for (let i = 0; i < REMOTE_HOSTS.length; i++) {\n`;
        bunCmd += `    const host = REMOTE_HOSTS[i];\n`;
        bunCmd += `    const runHost = await run(host);\n`;
        bunCmd += `}\n`;
    }

    return bunCmd;
}
