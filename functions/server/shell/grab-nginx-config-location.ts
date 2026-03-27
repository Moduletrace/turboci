import type {
    TCIConfigLBLocation,
    TCIConfigServiceConfigLBTarget,
} from "@/types";
import { _n } from "@/utils/numberfy";
import AppData from "@/data/app-data";
import _ from "lodash";
import grabUpstreamNames from "@/utils/grab-upstream-names";
import grabNGINXConfigRenderCustomLocation from "./grab-nginx-config-render-custom-location";
import grabNGINXConfigRenderDefaultProxyLocation from "./grab-nginx-config-render-default-proxy-location";

type Params = {
    service_name: string;
    locations?: TCIConfigLBLocation[];
    zone_map?: Map<string, string>;
    lb_target_service: TCIConfigServiceConfigLBTarget;
    expanded_ips?: string[];
};

export default function grabNGINXConfigLocation({
    service_name,
    locations,
    zone_map,
    lb_target_service,
    expanded_ips,
}: Params) {
    const { upstream_name } = grabUpstreamNames({
        service_name,
        port: lb_target_service.port || 80,
    });

    let loc = "\n";

    loc += `        location /.well-known/acme-challenge/ {\n`;
    loc += `            proxy_pass http://127.0.0.1:${AppData["certbot_http_challenge_port"]};\n`;
    loc += `        }\n`;

    if (locations?.some((l) => l.match === "/")) {
        throw new Error(
            `Root Location is already handled. Use the \`target_location\` property to append extra rules to the root location.`,
        );
    }

    if (locations?.length) {
        for (const location of locations) {
            loc += grabNGINXConfigRenderCustomLocation({
                location,
                upstream_name,
                zone_map,
                service_name,
                expanded_ips,
            });
        }
    }

    loc += grabNGINXConfigRenderDefaultProxyLocation({
        upstream_name,
        lb_target_service,
        zone_map,
        expanded_ips,
    });

    loc += `\n`;

    return loc;
}
