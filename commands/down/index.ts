import { Command } from "commander";
import { AppNames } from "../../utils/app-names";
import setup from "./setup";
import turbociInit from "../../utils/init";
import chalk from "chalk";
import grabDirNames from "@/utils/grab-dir-names";
import { rmSync } from "fs";

export default function () {
    return new Command("down")
        .description("Pull Down stack")
        .option(
            AppNames["FileFlag"],
            "Specify the file to run",
            AppNames["DefaultConfigFile"],
        )
        .action(async () => {
            console.log(
                chalk.white(chalk.bold(`Pulling down deployments ...`)),
            );
            await turbociInit();
            await setup();

            const { activeConfigYAML } = grabDirNames();
            try {
                rmSync(activeConfigYAML);
            } catch (error) {}
        });
}
