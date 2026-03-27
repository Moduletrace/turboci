type Params = {
    envs: Record<string, string>;
};

export default function loadEnv({ envs }: Params) {
    const env_keys = Object.keys(envs);

    for (let i = 0; i < env_keys.length; i++) {
        const env_key = env_keys[i];
        if (!env_key) continue;
        let value = envs[env_key as keyof typeof envs];
        if (!value) continue;

        value = value.replace(/^["']?(.*?)["']?$/, "$1");

        value = value.replace(
            /\$\{(\w+)\}|\$(\w+)/g,
            (_, braced, bare) => process.env[braced ?? bare] ?? "",
        );

        process.env[env_key] = value;
    }
}
