import _ from "lodash";
import grabAppNames from "@/utils/grab-app-names";
import Hetzner from "@/platforms/hetzner";
import type { TCIGlobalConfig } from "@/types";

export default async function ({
    deployment,
}: {
    deployment: TCIGlobalConfig;
}) {
    let isSuccess = false;

    const { sshRelayServerName } = grabAppNames({
        name: deployment.deployment_name,
    });

    const relaySrvRes = await Hetzner.servers.list({
        name: sshRelayServerName,
    });
    const relaySrv = relaySrvRes.servers?.[0];

    if (relaySrv?.id) {
        const delRelaySrv = await Hetzner.servers.delete({
            server_id: relaySrv?.id,
        });
        isSuccess = Boolean(delRelaySrv);
    } else {
        isSuccess = true;
    }

    return isSuccess;
}
