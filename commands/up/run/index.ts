import type { DefaultDeploymentParams } from "@/types";
import flight from "./flight";

export default async function (params: DefaultDeploymentParams) {
    global.ORA_SPINNER.text = `Running Applications ...`;
    global.ORA_SPINNER.start();

    const preflight = await flight(params);

    if (preflight) {
        global.ORA_SPINNER.succeed(`Applications Started Successfully!`);
    } else {
        global.ORA_SPINNER.fail(`Running Applications Failed!`);
        process.exit(1);
    }

    global.ORA_SPINNER.stop();
}
