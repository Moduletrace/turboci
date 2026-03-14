import getGCPClient from "../../client";
import { gcpGetProject } from "../../types";

type Params = {
    key_name: string;
};

export default async function ({ key_name }: Params) {
    const { GCPCompute } = await getGCPClient();
    const project = gcpGetProject();

    const projectRes = await GCPCompute.projects.get({ project });
    const items = projectRes.data.commonInstanceMetadata?.items || [];

    const sshKeysItem = items.find((item) => item.key === "ssh-keys");

    if (!sshKeysItem?.value) {
        return { ssh_key: null };
    }

    // Keys are stored as: "root:ssh-rsa AAAA... key_name"
    const keyLine = sshKeysItem.value
        .split("\n")
        .find((line) => line.trim().includes(` ${key_name}`));

    if (!keyLine) {
        return { ssh_key: null };
    }

    return { ssh_key: { name: key_name, value: keyLine } };
}
