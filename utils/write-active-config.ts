import { dump } from "js-yaml";
import type { TCIConfig, TCIGlobalConfig } from "../types";

import grabDirNames from "./grab-dir-names";
import { writeFileSync } from "fs";

type Params = {
    config: TCIGlobalConfig[];
};

export default function writeActiveConfig({ config }: Params) {
    const { activeConfigYAML } = grabDirNames();
    const configYaml = dump(config);

    writeFileSync(activeConfigYAML, configYaml, "utf-8");
}
