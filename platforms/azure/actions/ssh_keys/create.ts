// Azure SSH keys are injected at VM creation time via osProfile.
// This is a no-op stub kept for API surface consistency.

type Params = {
    key_name: string;
    public_key?: string;
};

export default async function ({ key_name }: Params) {
    return { ssh_key: { name: key_name } };
}
