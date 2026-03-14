import type { DefaultDeploymentParams } from "@/types";
import setupServices from "./setup-services";

export default async function (params: DefaultDeploymentParams) {
    /**
     * # Set up Services
     */
    global.ORA_SPINNER.text = `Setting up Services ...`;
    global.ORA_SPINNER.start();

    const setupSrvs = await setupServices(params);

    if (setupSrvs) {
        global.ORA_SPINNER.succeed(`Services Setup Successful!`);
    } else {
        global.ORA_SPINNER.fail(`Services Setup Failed!`);
        process.exit(1);
    }

    global.ORA_SPINNER.stop();
}
