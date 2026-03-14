import Hetzner from "../../../../platforms/hetzner";
import type { TCIGlobalConfig } from "../../../../types";
import grabAppNames from "../../../../utils/grab-app-names";

type Params = {
    config: TCIGlobalConfig;
};

export default async function ({ config }: Params) {
    const deploymentName = config.deployment_name;

    const { appSSHKeyName } = grabAppNames({
        name: deploymentName,
    });

    const existingSSHKey = await Hetzner.ssh_keys.list({
        name: appSSHKeyName,
    });

    const sshKeyID = existingSSHKey.ssh_keys?.[0]?.id;

    if (!sshKeyID) {
        return true;
    }

    const newSSHKey = await Hetzner.ssh_keys.delete({
        ssh_key_id: sshKeyID,
    });

    return Boolean(newSSHKey);
}
