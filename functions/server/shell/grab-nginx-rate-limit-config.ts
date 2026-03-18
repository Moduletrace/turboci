import type { TCIConfigLBLocation } from "@/types";
import { _n } from "@/utils/numberfy";
import _ from "lodash";

type Params = {
    location?: TCIConfigLBLocation;
    zone_map?: Map<string, string>;
};

export default function grabNginxRateLimitingConfig({
    location,
    zone_map,
}: Params): string {
    let loc = "\n";

    if (location?.rate_limit && zone_map) {
        const zone_name = zone_map.get(location.path);

        if (zone_name) {
            let limit_req = `limit_req zone=${zone_name}`;
            if (location.rate_limit.burst !== undefined) {
                limit_req += ` burst=${location.rate_limit.burst}`;
            }
            if (location.rate_limit.nodelay) {
                limit_req += ` nodelay`;
            }
            loc += `            ${limit_req};\n`;
        }
    }

    return loc;
}
