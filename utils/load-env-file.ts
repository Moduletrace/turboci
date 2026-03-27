import { existsSync, readFileSync } from "fs";
import path from "path";
import loadEnv from "./load-envs";

type Params = {
    file_path: string;
};

export default function loadEnvFile({ file_path }: Params) {
    const absolute_file_path = path.resolve(process.cwd(), file_path);

    if (!existsSync(absolute_file_path)) {
        return;
    }

    const envs: Record<string, string> = {};

    const raw = readFileSync(absolute_file_path, "utf8");

    for (const line of raw.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;

        const match = trimmed.match(/^(\w+)\s*=\s*(.*)/);
        if (!match) continue;

        let [, key, value] = match;

        if (!value || !key) continue;

        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }

        envs[key] = value;
    }

    loadEnv({ envs });
}
