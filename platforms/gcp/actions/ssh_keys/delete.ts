import getGCPClient from "../../client";
import { gcpGetProject } from "../../types";

type Params = {
    key_name: string;
};

export default async function ({ key_name }: Params) {
    const { GCPCompute } = await getGCPClient();
    const project = gcpGetProject();

    const projectRes = await GCPCompute.projects.get({ project });
    const metadata = projectRes.data.commonInstanceMetadata || {};
    const items = metadata.items || [];

    const sshKeysItem = items.find((item) => item.key === "ssh-keys");

    if (!sshKeysItem?.value) {
        return {};
    }

    const newLines = sshKeysItem.value
        .split("\n")
        .filter((line) => line.trim() && !line.includes(` ${key_name}`));

    const newItems = items
        .filter((item) => item.key !== "ssh-keys")
        .concat(
            newLines.length > 0
                ? [{ key: "ssh-keys", value: newLines.join("\n") }]
                : []
        );

    await GCPCompute.projects.setCommonInstanceMetadata({
        project,
        requestBody: {
            items: newItems,
            fingerprint: metadata.fingerprint,
        },
    });

    return {};
}
