import type { ParsedDeploymentServiceConfig, TCIGlobalConfig } from "@/types";
import grabPrivateIPsBulkScripts from "./grab-private-ips-bulk-scripts";
import _ from "lodash";
import bunGrabPrivateIPsBulkScripts from "@/utils/bun-scripts/bun-grab-private-ips-bulk-scripts";
import grabDefaultServicePrepSH from "@/functions/server/shell/grab-default-service-prep-sh";

type Params = {
    private_server_ips: string[];
    service: ParsedDeploymentServiceConfig;
    deployment: TCIGlobalConfig;
    bun?: boolean;
};

export default async function grabServerPrepSH({
    private_server_ips,
    service,
    deployment,
    bun,
}: Params) {
    let finalCmd = "";
    finalCmd += await grabDefaultServicePrepSH({ deployment, service });

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
