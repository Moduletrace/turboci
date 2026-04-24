import { Command } from "commander";
import type { CommanderDefaultOptions } from "@/types";
import turbociInfoFin from "./info-fn";

export default function () {
    return new Command("info")
        .description("Get information about the current stack")
        .action(async (options: CommanderDefaultOptions) => {
            await turbociInfoFin();
        });
}
