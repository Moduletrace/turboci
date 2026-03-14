import type { TCIConfigDeployment } from "../../../../types";
import _ from "lodash";
import grabPrivateIPsBulkScripts from "@/utils/ssh/shell-scripts/grab-private-ips-bulk-scripts";
import relayExecSSH from "@/utils/ssh/relay-exec-ssh";
import azurePrivateServerInitSH from "@/platforms/azure/utils/grab-private-server-init-sh";

type Params = {
    deployment: Omit<TCIConfigDeployment, "services">;
    new_private_server_ips: string[];
};

export default async function ({
    new_private_server_ips,
    deployment,
}: Params) {
    if (new_private_server_ips[0]) {
        const serversInitCmd = grabPrivateIPsBulkScripts({
            private_server_ips: new_private_server_ips,
            script: azurePrivateServerInitSH(),
        });

        await relayExecSSH({ cmd: serversInitCmd, deployment });
    }

    return true;
}
