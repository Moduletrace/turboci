import type { DefaultDeploymentParams } from "@/types";
import restoreServers from "./restore-servers";

export default async function (params: DefaultDeploymentParams) {
    global.ORA_SPINNER.text = `Handling Servers Backups and Restore ...`;
    global.ORA_SPINNER.start();

    const restore_servers = await restoreServers(params);

    if (restore_servers.success) {
        global.ORA_SPINNER.succeed(`Servers Backups and Restore Successful!`);
    } else {
        let msg = `Servers Backups and Restore Failed!`;
        if (restore_servers.msg) {
            msg += ` ${restore_servers.msg}`;
        }
        console.error(msg);
        process.exit(1);
    }

    global.ORA_SPINNER.stop();
}
