import type {
    ParsedDeploymentServiceConfig,
    TCIConfigSpec,
    TCIGlobalConfig,
} from "@/types";
import _ from "lodash";
import bunGrabPrivateIPsBulkScripts from "@/utils/bun-scripts/bun-grab-private-ips-bulk-scripts";
import grabPrivateIPsBulkScripts from "@/utils/ssh/shell-scripts/grab-private-ips-bulk-scripts";
import grabPreferedOSType from "@/utils/grab-os-type";
import jsyaml from "js-yaml";

type Params = {
    private_server_ips: string[];
    service: ParsedDeploymentServiceConfig;
    deployment: TCIGlobalConfig;
    bun?: boolean;
};

export default async function grabSpecServerPrepSH({
    private_server_ips,
    service,
    deployment,
    bun,
}: Params) {
    try {
        let finalCmd = "";

        if (!service.spec_url) {
            throw new Error(`Spec URL not provided`);
        }

        const yaml = await (await fetch(service.spec_url)).text();

        const spec = jsyaml.load(yaml) as TCIConfigSpec | undefined;

        if (!spec) {
            throw new Error(`Couldn't load spec`);
        }

        const init = spec.init_url
            ? await (await fetch(spec.init_url)).text()
            : spec.init;

        if (!init?.match(/./)) {
            throw new Error(`Couldn't grab initialization script.`);
        }

        finalCmd += `${init}\n`;

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
    } catch (error) {}
}
