import type { TCIGlobalConfig } from "../types";
import _ from "lodash";
import { execFile, execSync } from "child_process";
import path from "path";

type Params = {
    deployment: TCIGlobalConfig;
};

export default async function preDeployment({ deployment }: Params) {
    const predep = deployment.pre_deployment;

    const cwd = path.resolve(process.cwd(), predep?.work_dir || "");

    if (predep?.file || predep?.cmds?.[0]) {
        global.ORA_SPINNER.text = `Running Pre-Deployment Commands ...`;
        global.ORA_SPINNER.start();

        if (predep?.file) {
            execFile(predep.file, { cwd });
        } else if (predep?.cmds?.[0]) {
            execSync(predep.cmds.join(` && `));
        }

        global.ORA_SPINNER.succeed(`Pre-Deployment Setup Successful!`);
    }
}
