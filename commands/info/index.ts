import { Command } from "commander";
import turbociInit from "../../utils/init";
import chalk from "chalk";
import { AppNames } from "@/utils/app-names";
import type { CommanderDefaultOptions } from "@/types";
import validateDeploymentSyntax from "../up/setup/utils/validate-deployment-syntax";
import log from "../up/log";

function collectSkippedServices(value: string, previous: string[]) {
    return previous.concat([value]);
}

export default function () {
    return new Command("info")
        .description("Get information about the current stack")
        .option(
            AppNames["SkipServiceFlag"],
            "Specify services to skip",
            collectSkippedServices,
            [],
        )
        .option(
            AppNames["TargetServicesFlag"],
            "Specify services to handle",
            collectSkippedServices,
            [],
        )
        .action(async (options: CommanderDefaultOptions) => {
            console.log(
                chalk.white(
                    chalk.bold(`Grabbing Deployment Information ...\n`),
                ),
            );

            await turbociInit();

            const deployments = global.CONFIGS;

            if (!deployments) {
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
        });
}
