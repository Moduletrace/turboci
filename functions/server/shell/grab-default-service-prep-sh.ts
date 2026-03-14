import { turboCiDepsCmds } from "@/functions/server/install-turboci-dependencies";
import type { ParsedDeploymentServiceConfig, TCIGlobalConfig } from "@/types";
import grabPreferedOSType from "@/utils/grab-os-type";
import _ from "lodash";

type Params = {
    service: ParsedDeploymentServiceConfig;
    deployment: TCIGlobalConfig;
};

export default async function grabDefaultServicePrepSH({
    service,
    deployment,
}: Params) {
    const aptDeps = service.dependencies?.apt;
    const aptDepsStr = aptDeps?.join(" ");
    const installAPTDepsCmd = aptDepsStr
        ? `apt update && apt install -y ${aptDepsStr}`
        : undefined;

    const osType = await grabPreferedOSType({
        deployment,
        os: service.os,
    });

    const turboCiDeps = service.dependencies?.turboci;
    const turboCIDepsCmds = turboCiDeps?.map(
        (dep) => turboCiDepsCmds({ os: osType, dependency: dep as any }) || [],
    );

    let finalCmd = "\n";

    if (deployment.provider == "hetzner" && service.type !== "load_balancer") {
        finalCmd += `echo -e "nameserver 185.12.64.1\nnameserver 185.12.64.2" | tee /etc/resolv.conf\n`;
    }

    /**
     * # Install APT Dependencies
     */
    if (installAPTDepsCmd) {
        finalCmd += `echo "Installing APT dependencies ..."\n`;
        finalCmd += `${installAPTDepsCmd}\n`;
    }

    if (turboCIDepsCmds) {
        /**
         * # Install TurboCI Dependencies
         */
        finalCmd += `echo "Installing TurboCI dependencies ..."\n`;
        finalCmd += `${turboCIDepsCmds.join("\n")}\n`;
    }

    return finalCmd;
}
