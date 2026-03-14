import AppData from "@/data/app-data";
import type { ParsedDeploymentServiceConfig } from "@/types";
import grabDirNames from "@/utils/grab-dir-names";
import _ from "lodash";

type Params = {
    private_server_ips: string[];
    script: string;
    work_dir?: string;
    parrallel?: boolean;
    no_process_logs?: boolean;
    init?: string[];
};

export default function bunGrabPrivateIPsBulkScripts({
    private_server_ips,
    script,
    work_dir,
    parrallel,
    no_process_logs,
    init,
}: Params) {
    const { relayServerSshPrivateKeyFile } = grabDirNames();

    let bunCmd = "";

    bunCmd += `import _ from "lodash";\n`;
    bunCmd += `import { execSync } from "child_process";\n`;
    bunCmd += `\n`;
    bunCmd += `const SSH_KEY = "${relayServerSshPrivateKeyFile}";\n`;
    bunCmd += `const SSH_OPTS = \`-i \${SSH_KEY} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -C -c aes128-ctr\`;\n`;
    bunCmd += `const TIMEOUT = ${AppData["ssh_try_timeout_milliseconds"]};\n`;
    bunCmd += `const MAX_ATTEMPTS = ${AppData["ssh_max_tries"]};\n`;

    bunCmd += `const REMOTE_HOSTS = [${private_server_ips
        .map((h) => `"${h.replace(/\"/g, "")}"`)
        .join(", ")}];\n`;

    bunCmd += `const NEW_SERVERS = [${global.NEW_SERVERS.filter((ns) =>
        Boolean(ns.private_ip),
    )
        .map((ns) => `"${ns.private_ip?.replace(/\"/g, "")}"`)
        .join(", ")}];\n`;
    bunCmd += `const DEFAULT_SSH_USER = "root";\n`;
    bunCmd += `const BATCH_SIZE = ${AppData["private_server_batch_exec_size"]};\n`;

    bunCmd += `async function run(host: string) {\n`;
    bunCmd += `    let attempt = 0;\n`;
    if (!no_process_logs) {
        bunCmd += `    console.log(\`Setting up \${host} ...\`);\n`;
    }
    bunCmd += `    while (attempt < MAX_ATTEMPTS) {\n`;
    bunCmd += `        attempt += 1;\n`;
    bunCmd += `        if (attempt > MAX_ATTEMPTS) {\n`;
    if (!no_process_logs) {
        bunCmd += `            console.log(\`Error: \${host} not ready after \${MAX_ATTEMPTS} attempts. Exiting.\`);\n`;
    }
    bunCmd += `            process.exit(1);\n`;
    bunCmd += `        }\n`;
    bunCmd += `        try {\n`;
    if (!no_process_logs) {
        bunCmd += `            console.log(\`Waiting for \${host} to be ready... (attempt \${attempt}/\${MAX_ATTEMPTS})\`);\n`;
    }
    bunCmd += `            let testCmd = \`ssh \${SSH_OPTS} \${DEFAULT_SSH_USER}@\${host} echo "Running ..."\`;\n`;
    bunCmd += `            let testRes = execSync(testCmd, { encoding: "utf-8" });\n`;
    bunCmd += `            if (testRes?.match(/Running/)) break;\n`;
    bunCmd += `        } catch (error) {\n`;
    if (!no_process_logs) {
        bunCmd += `            console.log(\`Attempt \${attempt} failed!\`);\n`;
    }
    bunCmd += `        }\n`;
    bunCmd += `        await Bun.sleep(TIMEOUT);\n`;
    bunCmd += `    }\n`;
    bunCmd += `    attempt = 0;\n`;
    bunCmd += `\n`;

    bunCmd += `    let execCmd = \`ssh \${SSH_OPTS} \${DEFAULT_SSH_USER}@\${host} << 'TURBOCIEXEC'\\n\`;\n`;

    if (work_dir) {
        bunCmd += `    execCmd += \`cd ${work_dir}\\n\`;\n`;
    }

    if (init?.[0]) {
        bunCmd += `    if (NEW_SERVERS.find(ns=>ns == host)) {\n`;

        for (let i = 0; i < init.length; i++) {
            const init_sh = init[i];
            bunCmd += `        execCmd += \`${init_sh}\\n\`;\n\n`;
        }

        bunCmd += `    }\n`;
    }

    bunCmd += `    execCmd += \`${script}\\n\`;\n`;
    bunCmd += `    execCmd += \`TURBOCIEXEC\\n\`;\n`;
    bunCmd += `    try {\n`;
    bunCmd += `        const res = execSync(execCmd, { encoding: "utf-8" });\n`;
    bunCmd += `        console.log(res);\n`;
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
