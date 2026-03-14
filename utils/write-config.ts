import { existsSync, mkdirSync, writeFileSync } from "fs";
import type { TCIConfigDeployment } from "../types";

import { dump } from "js-yaml";
import grabDirNames from "./grab-dir-names";
import path from "path";

type Params = {
    config?: TCIConfigDeployment[];
};

export default function writeConfigYaml({ config }: Params) {
    const { configYAML } = grabDirNames();

    try {
        const yamlStr = dump(config);
        const configDir = path.dirname(configYAML);
        if (!existsSync(configDir)) {
            mkdirSync(configDir, { recursive: true });
        }
        writeFileSync(configYAML, yamlStr, "utf-8");
        return true;
    } catch (error: any) {
        console.log(`ERROR => ${error.message}`);
        return false;
    }
}
