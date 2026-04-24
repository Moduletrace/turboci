import { Command } from "commander";
import turbociInfoFin from "../info/info-fn";

export default function () {
    return new Command("status")
        .description("Get information about the current stack")
        .action(async () => {
            await turbociInfoFin();
        });
}
