import { execSync, type ExecSyncOptions } from "child_process";
import normalizeText from "./normalize-text";

export default function execute(
    cmd: string | string[],
    options?: ExecSyncOptions
): string | (string | undefined)[] | undefined {
    try {
        if (Array.isArray(cmd)) {
            let resArr: (string | undefined)[] = [];

            for (let i = 0; i < cmd.length; i++) {
                const singleCmd = cmd[i];
                if (!singleCmd) continue;

                const res = execSync(normalizeText(singleCmd), {
                    encoding: "utf-8",
                    ...options,
                });

                if (typeof res == "string") {
                    resArr.push(res.trim());
                } else {
                    resArr.push(undefined);
                }
            }

            return resArr;
        }

        const res = execSync(normalizeText(cmd), {
            encoding: "utf-8",
            ...options,
        });

        if (typeof res == "string") {
            return res.trim();
        } else {
            return undefined;
        }
    } catch (error: any) {
        console.log(`Execute Error =>`, error.message);
        return undefined;
    }
}
