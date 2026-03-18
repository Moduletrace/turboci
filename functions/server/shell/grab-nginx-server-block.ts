import type {
    TCIConfigLBLocation,
    TCIConfigServiceConfigLBTarget,
} from "@/types";
import { _n } from "@/utils/numberfy";
import _ from "lodash";
import expandAllowIps from "@/utils/expand-allow-ips";
import grabNGINXConfigLocation from "./grab-nginx-config-location";

type Params = {
    ssl_domains?: string[];
    service_name: string;
    allow_ips?: string[];
    locations?: TCIConfigLBLocation[];
    zone_map?: Map<string, string>;
    lb_target_service: TCIConfigServiceConfigLBTarget;
};

export default function grabNginxConfigServerBlock({
    ssl_domains,
    service_name,
    allow_ips,
    locations,
    zone_map,
    lb_target_service,
}: Params) {
    const expanded_ips = allow_ips?.length
        ? expandAllowIps(allow_ips)
        : undefined;

    let srvBlk = "";

    if (ssl_domains?.[0]) {
        const domainsStr = ssl_domains.join(" ");

        srvBlk += `    server {\n`;
        srvBlk += `        listen 80;\n`;
        srvBlk += `        server_name ${domainsStr};\n`;
        srvBlk += `        return 301 https://\\$host\\$request_uri;\n`;
        srvBlk += `    }\n`;

        srvBlk += `    server {\n`;
        srvBlk += `        listen 443 ssl;\n`;
        srvBlk += `        server_name ${domainsStr};\n`;
        srvBlk += `        ssl_certificate     /etc/letsencrypt/live/${service_name}/fullchain.pem;\n`;
        srvBlk += `        ssl_certificate_key /etc/letsencrypt/live/${service_name}/privkey.pem;\n`;

        srvBlk += grabNGINXConfigLocation({
            service_name,
            locations,
            zone_map,
            lb_target_service,
            expanded_ips,
        });
        srvBlk += `    }\n`;
    } else {
        srvBlk += `    server {\n`;
        srvBlk += `        listen 80;\n`;
        srvBlk += `        server_name ${service_name};\n`;

        srvBlk += grabNGINXConfigLocation({
            service_name,
            locations,
            zone_map,
            lb_target_service,
            expanded_ips,
        });
        srvBlk += `    }\n`;
    }

    return srvBlk;
}
