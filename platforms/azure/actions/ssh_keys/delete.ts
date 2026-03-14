// Azure SSH keys are injected at VM creation time — no project-level key to delete.

type Params = {
    key_name: string;
};

export default async function ({ key_name }: Params) {
    return {};
}
