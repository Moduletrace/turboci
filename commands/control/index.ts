import { Command } from "commander";
import prompts from "./prompts";
import chalk from "chalk";

export default function () {
    return new Command("control")
        .description("Manage deployments")
        .action(async () => {
            console.log(chalk.white(chalk.bold(`Running TurboCI control ...`)));
            await prompts();
        });
}
