import fs from "node:fs";
import execute from "./execute";
import path from "node:path";

type Params = {
    key_name: string;
    output_dir: string;
    pass_phrase?: string;
};

export default async function setupSSH({
    key_name,
    output_dir,
    pass_phrase,
}: Params) {
    console.log("Generating SSH keys ...");

    if (!fs.existsSync(output_dir)) {
        fs.mkdirSync(output_dir, { recursive: true });
    }

    const KEY_PATH = path.join(output_dir, key_name);

    if (!fs.existsSync(KEY_PATH)) {
        console.log("Generating SSH keypair...");
        let cmd = `ssh-keygen -t rsa -b 4096 -f "${KEY_PATH}"`;

        if (pass_phrase) {
            cmd += ` -N "${pass_phrase}"`;
        } else {
            cmd += ` -N ""`;
        }

        cmd += ` -q`;

        execute(cmd);
    }

    console.log("SSH keys Setup Complete!");
}
