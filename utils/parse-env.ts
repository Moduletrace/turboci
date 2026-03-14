import fs from "fs";

export default function parseEnv(
    /** The file path to the env. Eg. /app/.env */ envFile: string
) {
    if (!fs.existsSync(envFile)) return undefined;

    const envTextContent = fs.readFileSync(envFile, "utf-8");
    const envLines = envTextContent
        .split("\n")
        .map((ln) => ln.trim())
        .filter((ln) => {
            const commentLine = ln.match(/^\#/);
            const validEnv = ln.match(/.*\=/);

            if (commentLine) return false;
            if (validEnv) return true;
            return false;
        });

    const newEnvObj: { [k: string]: string } = {};

    for (let i = 0; i < envLines.length; i++) {
        const emvLine = envLines[i];
        if (!emvLine) continue;
        const envLineArr = emvLine.split("=");
        const envTitle = envLineArr[0];
        const envValue = envLineArr[1] as string | undefined;

        if (!envTitle?.match(/./)) continue;

        if (envValue?.match(/./)) {
            newEnvObj[envTitle] = envValue;
        } else {
            newEnvObj[envTitle] = "";
        }
    }

    return newEnvObj as { [k: string]: string };
}
