import { existsSync, readFileSync } from "fs";
import Hetzner from "../../../../platforms/hetzner";
import type { TCIConfig, TCIGlobalConfig } from "../../../../types";
import grabAppNames from "../../../../utils/grab-app-names";
import grabDirNames from "../../../../utils/grab-dir-names";
import { AppNames } from "../../../../utils/app-names";

type Params = {
    config: TCIGlobalConfig;
};

export default async function ({ config }: Params) {
    const deploymentName = config.deployment_name;

    const { appSSHKeyName } = grabAppNames({
        name: deploymentName,
    });

    const { sshPublicKeyFile } = grabDirNames();

    if (!existsSync(sshPublicKeyFile)) {
        console.error(`No SSH keys found! Please setup SSH Keys!`);
        process.exit(1);
    }

    const existingSSHKey = await Hetzner.ssh_keys.list({
        name: appSSHKeyName,
    });

    if (existingSSHKey.ssh_keys?.[0]?.id) {
        return true;
    }

    const newSSHKey = await Hetzner.ssh_keys.create({
        name: appSSHKeyName,
        public_key: readFileSync(sshPublicKeyFile, "utf-8"),
        labels: {
            [AppNames["TurboCILabelNameKey"]]: deploymentName,
        },
    });

    return Boolean(newSSHKey.ssh_key?.id);
}
