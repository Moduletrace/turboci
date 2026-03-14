import getGCPClient from "../../client";
import { gcpGetProject } from "../../types";

export default async function () {
    const { GCPCompute } = await getGCPClient();
    const project = gcpGetProject();

    const projectRes = await GCPCompute.projects.get({ project });
    const items = projectRes.data.commonInstanceMetadata?.items || [];

    const sshKeysItem = items.find((item) => item.key === "ssh-keys");

    const ssh_keys = sshKeysItem?.value
        ? sshKeysItem.value
              .split("\n")
              .filter((line) => line.trim())
              .map((line) => {
                  const [key_name] = line.split(":");
                  return { name: key_name, value: line };
              })
        : [];

    return { ssh_keys };
}
