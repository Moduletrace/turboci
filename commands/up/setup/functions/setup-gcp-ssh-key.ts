import { existsSync, readFileSync } from "fs";
import type { TCIGlobalConfig } from "../../../../types";
import grabAppNames from "../../../../utils/grab-app-names";
import grabDirNames from "../../../../utils/grab-dir-names";
import TurboCIGCP from "@/platforms/gcp";

type Params = {
    config: TCIGlobalConfig;
};

export default async function ({ config }: Params) {
    const deploymentName = config.deployment_name;

    const { appSSHKeyName } = grabAppNames({ name: deploymentName });
    const { sshPublicKeyFile } = grabDirNames();

    if (!existsSync(sshPublicKeyFile)) {
        console.error(`No SSH keys found! Please setup SSH Keys!`);
        process.exit(1);
    }

    const existingSSHKey = await TurboCIGCP.ssh_keys.get({
        key_name: appSSHKeyName,
    });

    if (existingSSHKey.ssh_key?.name) {
        return true;
    }

    const newSSHKey = await TurboCIGCP.ssh_keys.create({
        key_name: appSSHKeyName,
        public_key: readFileSync(sshPublicKeyFile, "utf-8"),
    });

    return Boolean(newSSHKey.ssh_key?.name);
}
