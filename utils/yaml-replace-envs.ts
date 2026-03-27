export default function yamlReplaceEnvs(raw: string): string {
    return raw.replace(
        /\$\{(\w+)(?::-(.*?))?\}/g,
        (_, key, fallback) => process.env[key] ?? fallback ?? "",
    );
}
