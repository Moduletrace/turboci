import getGCPClient from "../../client";
import { gcpGetProject } from "../../types";

type Params = {
    key_name: string;
    public_key: string;
};

export default async function ({ key_name, public_key }: Params) {
    const { GCPCompute } = await getGCPClient();
    const project = gcpGetProject();

    // Store with "root" as username so GCP guest agent injects into /root/.ssh/authorized_keys.
    // key_name is embedded as the comment (3rd field) for identification.
    const trimmedKey = public_key.trim().split(" ").slice(0, 2).join(" ");
    const sshKeyEntry = `root:${trimmedKey} ${key_name}`;

    const projectRes = await GCPCompute.projects.get({ project });
    const metadata = projectRes.data.commonInstanceMetadata || {};
    const items = metadata.items || [];

    const existingSSHKeysItem = items.find((item) => item.key === "ssh-keys");

    let newSSHKeysValue = sshKeyEntry;

    if (existingSSHKeysItem?.value) {
        const lines = existingSSHKeysItem.value
            .split("\n")
            .filter((line) => line.trim() && !line.includes(` ${key_name}`));
        lines.push(sshKeyEntry);
        newSSHKeysValue = lines.join("\n");
    }

    const newItems = items
        .filter((item) => item.key !== "ssh-keys")
        .concat([{ key: "ssh-keys", value: newSSHKeysValue }]);

    await GCPCompute.projects.setCommonInstanceMetadata({
        project,
        requestBody: {
            items: newItems,
            fingerprint: metadata.fingerprint,
        },
    });

    return { ssh_key: { name: key_name } };
}
