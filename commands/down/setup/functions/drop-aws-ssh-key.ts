import TurboCIAWS from "@/platforms/aws";
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

    const existingSSHKeyRes = await TurboCIAWS.ssh_keys.list({
        key_name: appSSHKeyName,
        region: config.location!,
    });

    const existingSSHKey = existingSSHKeyRes.ssh_keys?.[0];

    const sshKeyID = existingSSHKey?.KeyPairId;

    if (!sshKeyID) {
        return true;
    }

    const dropSSHKey = await TurboCIAWS.ssh_keys.delete({
        region: config.location!,
        key_id: sshKeyID,
    });

    return Boolean(
        dropSSHKey.del_res.$metadata.httpStatusCode?.toString().match(/^2/),
    );
}
