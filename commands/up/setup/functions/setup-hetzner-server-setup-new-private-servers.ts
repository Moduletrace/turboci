import type { TCIConfig, TCIConfigDeployment } from "../../../../types";
import _ from "lodash";
import grabPrivateIPsBulkScripts from "@/utils/ssh/shell-scripts/grab-private-ips-bulk-scripts";
import hetznerPrivateServerInitSH from "@/platforms/hetzner/utils/grab-private-server-init-sh";
import relayExecSSH from "@/utils/ssh/relay-exec-ssh";
import type { HETZNER_NETWORK } from "@/platforms/hetzner/types";

type Params = {
    deployment: Omit<TCIConfigDeployment, "services">;
    new_private_server_ips: string[];
    defaultNetwork: HETZNER_NETWORK;
};

export default async function ({
    new_private_server_ips,
    deployment,
    defaultNetwork,
}: Params) {
    const defaultNetworkGateway =
        defaultNetwork.ip_range
            .split("/")[0]
            ?.split(".")
            .slice(0, 3)
            .join(".") + ".1";

    if (new_private_server_ips[0]) {
        const serversInitCmd = grabPrivateIPsBulkScripts({
            private_server_ips: new_private_server_ips,
            script: hetznerPrivateServerInitSH({ defaultNetworkGateway }),
        });

        const setup = await relayExecSSH({
            cmd: serversInitCmd,
            deployment,
        });
    }

    return true;
}
