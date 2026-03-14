import type { DefaultDeploymentParams } from "@/types";
import prepareServers from "./prepare-servers";

export default async function (params: DefaultDeploymentParams) {
    global.ORA_SPINNER.text = `Preparing Servers ...`;
    global.ORA_SPINNER.start();

    const prepServers = await prepareServers(params);

    if (prepServers.success) {
        global.ORA_SPINNER.succeed(`Servers Prep Successful!`);
    } else {
        let msg = `Servers Prep Failed!`;
        if (prepServers.msg) {
            msg += ` ${prepServers.msg}`;
        }
        console.error(msg);
        process.exit(1);
    }

    global.ORA_SPINNER.stop();
}
