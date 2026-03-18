import type { TCIConfigServiceConfigLBTarget } from "@/types";
import { _n } from "@/utils/numberfy";
import _ from "lodash";
import grabDefaultProxyLocation from "./grab-nginx-config-default-proxy";
import grabNginxRateLimitingConfig from "./grab-nginx-rate-limit-config";
import grabNginxDirectivesConfig from "./grab-nginx-directives-config";

type Params = {
    upstream_name: string;
    lb_target_service: TCIConfigServiceConfigLBTarget;
    zone_map?: Map<string, string>;
    expanded_ips?: string[];
};

export default function grabNGINXConfigRenderDefaultProxyLocation({
    upstream_name,
    lb_target_service,
    zone_map,
    expanded_ips,
}: Params): string {
    let loc = "\n";

    loc += `        location / {\n`;

    if (expanded_ips?.length) {
        for (const ip of expanded_ips) {
            loc += `            allow ${ip};\n`;
        }
        loc += `            deny all;\n`;
        loc += `\n`;
    }

    loc += grabNginxRateLimitingConfig({
        location: lb_target_service.target_location,
        zone_map,
    });

    loc += `${grabDefaultProxyLocation({
        upstream_name,
    })}\n`;

    loc += grabNginxDirectivesConfig({
        location: lb_target_service.target_location,
    });

    loc += `        }\n`;

    return loc;
}
