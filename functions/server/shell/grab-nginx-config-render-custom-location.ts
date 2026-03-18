import type { TCIConfigLBLocation } from "@/types";
import { _n } from "@/utils/numberfy";
import _ from "lodash";
import grabDefaultProxyLocation from "./grab-nginx-config-default-proxy";
import grabNginxRateLimitingConfig from "./grab-nginx-rate-limit-config";
import grabNginxDirectivesConfig from "./grab-nginx-directives-config";
import grabUpstreamNames from "@/utils/grab-upstream-names";

type Params = {
    location: TCIConfigLBLocation;
    zone_map?: Map<string, string>;
    upstream_name: string;
    service_name: string;
    expanded_ips?: string[];
};

export default function grabNGINXConfigRenderCustomLocation({
    location,
    zone_map,
    upstream_name,
    service_name,
    expanded_ips,
}: Params): string {
    let loc = "\n";

    const location_upstream_name = location.target_port
        ? grabUpstreamNames({ service_name, port: location.target_port })
              .upstream_name
        : upstream_name;

    loc += `        location ${location.match} {\n`;

    if (expanded_ips?.length) {
        for (const ip of expanded_ips) {
            loc += `            allow ${ip};\n`;
        }
        loc += `            deny all;\n`;
        loc += `\n`;
    }

    loc += grabNginxRateLimitingConfig({
        location,
        zone_map,
    });

    if (!location.no_proxy) {
        loc += `${grabDefaultProxyLocation({
            upstream_name: location_upstream_name,
            path: location.target_path,
        })}\n`;
    }

    loc += grabNginxDirectivesConfig({ location });

    loc += `        }\n`;

    return loc;
}
