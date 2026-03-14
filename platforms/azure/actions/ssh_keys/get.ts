// Azure SSH keys are injected at VM creation time.
// This stub returns a non-null value to signal "key exists" so setup is skipped.

type Params = {
    key_name: string;
};

export default async function ({ key_name }: Params) {
    return { ssh_key: { name: key_name } };
}
