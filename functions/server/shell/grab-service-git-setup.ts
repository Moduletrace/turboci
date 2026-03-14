import { turboCiDepsCmds } from "@/functions/server/install-turboci-dependencies";
import type { ParsedDeploymentServiceConfig, TCIGlobalConfig } from "@/types";
import _ from "lodash";

type Params = {
    service: ParsedDeploymentServiceConfig;
    deployment: TCIGlobalConfig;
};

export default async function grabServiceGitSetupSH({
    service,
    deployment,
}: Params) {
    let cmd = "";

    cmd += ``;

    return cmd;
}
