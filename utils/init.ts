import { existsSync, mkdirSync } from "fs";
import grabDirNames from "./grab-dir-names";
import setupSSH from "./setup-ssh";
import { AppNames } from "./app-names";
import prompts from "../commands/init/prompts";
import grabConfig from "./grab-config";
import writeConfigYaml from "./write-config";

export default async function turbociInit() {
    const { turbociDir, configTS, configYAML, sshDir } = grabDirNames();

    if (!existsSync(turbociDir)) {
        mkdirSync(turbociDir, { recursive: true });
    }

    if (!existsSync(configYAML) && !existsSync(configTS)) {
        const promptConfig = await prompts();

        if (promptConfig) {
            writeConfigYaml({ config: promptConfig });
        } else {
            console.error(
                `No cofig file found. Please add a \`config.yaml\` or \`config.ts\` file in the \`.turboci\` directory inside your working directory`,
            );
            process.exit(1);
        }
    }

    const finalConfigObject = grabConfig();

    if (!finalConfigObject) {
        console.error(
            `No cofig object found. Something went wrong parsing config file.`,
        );
        process.exit(1);
    }

    if (!existsSync(sshDir)) {
        mkdirSync(sshDir, { recursive: true });
        setupSSH({
            key_name: AppNames["TurboCISSHKeyName"],
            output_dir: sshDir,
        });
    }

    global.CONFIGS = finalConfigObject.deployments;

    return finalConfigObject;
}
