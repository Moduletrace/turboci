import turbociInit from "../../utils/init";
import chalk from "chalk";
import validateDeploymentSyntax from "../up/setup/utils/validate-deployment-syntax";
import log from "../up/log";
import grabDirNames from "@/utils/grab-dir-names";
import { existsSync } from "fs";

export default async function turbociInfoFin() {
    const { activeConfigYAML } = grabDirNames();

    if (!existsSync(activeConfigYAML)) {
        console.error(
            `No active deployments. Run \`turboci up\` to spin up a deployment`,
        );
        process.exit(1);
    }

    console.log(
        chalk.white(chalk.bold(`Grabbing Deployment Information ...\n`)),
    );

    await turbociInit();

    const deployments = global.CONFIGS;

    if (!deployments?.[0]) {
        console.error(`Couldn't grab deployments`);
        process.exit(1);
    }

    for (let i = 0; i < deployments.length; i++) {
        const deployment = deployments[i];
        if (!deployment) continue;
        await validateDeploymentSyntax({ deployment });
    }

    console.log("=====================================");
    await log();

    global.ORA_SPINNER.stop();
    process.exit();
}
