import type { TCIConfigLBLocation } from "@/types";
import { _n } from "@/utils/numberfy";
import _ from "lodash";

type Params = {
    location?: TCIConfigLBLocation;
};

export default function grabNginxDirectivesConfig({
    location,
}: Params): string {
    let loc = "\n";

    if (location?.directives) {
        for (const [key, value] of Object.entries(location.directives)) {
            if (Array.isArray(value)) {
                for (const v of value) {
                    loc += `            ${key} ${v};\n`;
                }
            } else {
                loc += `            ${key} ${value};\n`;
            }
        }
    }

    return loc;
}
