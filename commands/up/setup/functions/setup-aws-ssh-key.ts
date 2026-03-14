import { existsSync, readFileSync } from "fs";
import type { TCIGlobalConfig } from "../../../../types";
import grabAppNames from "../../../../utils/grab-app-names";
import grabDirNames from "../../../../utils/grab-dir-names";
import TurboCIAWS from "@/platforms/aws";

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

    const region = config.location;

    if (!region) {
        console.error(
            `AWS SSH key setup requires a \`location\` parameter for deployment`,
        );
        process.exit(1);
    }

    const existingSSHKey = await TurboCIAWS.ssh_keys.list({
        key_name: appSSHKeyName,
        region,
    });

    if (existingSSHKey.ssh_keys?.[0]?.KeyPairId) {
        return true;
    }

    const newSSHKey = await TurboCIAWS.ssh_keys.create({
        key_name: appSSHKeyName,
        public_key: readFileSync(sshPublicKeyFile, "utf-8"),
        region,
    });

    return Boolean(newSSHKey.ssh_key?.KeyPairId);
}
