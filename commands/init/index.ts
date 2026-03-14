import { Command } from "commander";
import prompts from "./prompts";
import writeConfigYaml from "../../utils/write-config";
import grabDirNames from "@/utils/grab-dir-names";
import { existsSync, readFileSync } from "fs";
import type { TCIConfigDeployment } from "@/types";
import { load } from "js-yaml";

export default function () {
    return new Command("init")
        .description("Initialize project")
        .action(async () => {
            console.log(`Initializing Turboci ...`);
            const { configTS, configYAML } = grabDirNames();

            const configTSObj = (
                existsSync(configTS) ? require(configTS).default : undefined
            ) as TCIConfigDeployment[] | undefined;

            const configYaml = existsSync(configYAML)
                ? readFileSync(configYAML, "utf-8")
                : undefined;
            const configObj = (configYaml ? load(configYaml) : undefined) as
                | TCIConfigDeployment[]
                | undefined;

            const deployments = configTSObj || configObj;

            const newConfigs = await prompts(deployments);

            if (newConfigs) {
                writeConfigYaml({ config: newConfigs });
            }
        });
}
