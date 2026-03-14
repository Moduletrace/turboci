// Azure SSH keys are injected at VM creation time — no project-level key store.

export default async function () {
    return { ssh_keys: [] };
}
