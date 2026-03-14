import { existsSync } from "fs";
import type { TCIGlobalConfig } from "../../../../types";
import grabDirNames from "../../../../utils/grab-dir-names";

type Params = {
    config: TCIGlobalConfig;
};

export default async function ({ config }: Params) {
    // Azure SSH keys are injected at VM creation time via osProfile.
    // We just verify the local key exists.
    const { sshPublicKeyFile } = grabDirNames();

    if (!existsSync(sshPublicKeyFile)) {
        console.error(`No SSH keys found! Please setup SSH Keys!`);
        process.exit(1);
    }

    return true;
}
