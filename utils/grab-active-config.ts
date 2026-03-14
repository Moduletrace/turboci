import { existsSync, readFileSync } from "fs";
import type { TCIGlobalConfig } from "../types";

import { load } from "js-yaml";
import grabDirNames from "./grab-dir-names";

export default function grabActiveConfig(): TCIGlobalConfig[] | undefined {
    const { activeConfigYAML } = grabDirNames();

    const configYaml = existsSync(activeConfigYAML)
        ? readFileSync(activeConfigYAML, "utf-8")
        : undefined;

    const configObj = (configYaml ? load(configYaml) : undefined) as
        | TCIGlobalConfig[]
        | undefined;

    return configObj;
}
