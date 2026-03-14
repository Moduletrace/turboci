import { turboCiDepsCmds } from "@/functions/server/install-turboci-dependencies";
import type { ParsedDeploymentServiceConfig, TCIGlobalConfig } from "@/types";
import _ from "lodash";
import bunGrabPrivateIPsBulkScripts from "@/utils/bun-scripts/bun-grab-private-ips-bulk-scripts";
import grabPrivateIPsBulkScripts from "@/utils/ssh/shell-scripts/grab-private-ips-bulk-scripts";
import grabDefaultServicePrepSH from "./grab-default-service-prep-sh";
import grabPreferedOSType from "@/utils/grab-os-type";

type Params = {
    private_server_ips: string[];
    service: ParsedDeploymentServiceConfig;
    deployment: TCIGlobalConfig;
    bun?: boolean;
};

export default async function grabDockerServerPrepSH({
    private_server_ips,
    service,
    deployment,
    bun,
}: Params) {
    const os = await grabPreferedOSType({
        deployment,
        os: service.os,
    });

    let finalCmd = "";

    finalCmd += await grabDefaultServicePrepSH({ deployment, service });
    finalCmd += turboCiDepsCmds({ os, dependency: "docker" });

    const bulkCmds = bun
        ? bunGrabPrivateIPsBulkScripts({
              private_server_ips,
              script: finalCmd,
              parrallel: true,
          })
        : grabPrivateIPsBulkScripts({
              private_server_ips,
              script: finalCmd,
              parrallel: true,
          });

    return bulkCmds;
}
