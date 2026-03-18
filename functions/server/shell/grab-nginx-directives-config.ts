import type { TCIConfigLBLocation } from "@/types";

type Params = {
    location?: TCIConfigLBLocation;
};

const VALID_DIRECTIVE_KEY = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function isSafeDirectiveValue(v: string): boolean {
    return !v.includes("\n") && !v.includes("\r");
}

export default function grabNginxDirectivesConfig({
    location,
}: Params): string {
    let loc = "\n";

    if (location?.directives) {
        for (const [key, value] of Object.entries(location.directives)) {
            if (!VALID_DIRECTIVE_KEY.test(key)) continue;
            if (Array.isArray(value)) {
                for (const v of value) {
                    if (!isSafeDirectiveValue(v)) continue;
                    loc += `            ${key} ${v};\n`;
                }
            } else {
                if (!isSafeDirectiveValue(value)) continue;
                loc += `            ${key} ${value};\n`;
            }
        }
    }

    return loc;
}
