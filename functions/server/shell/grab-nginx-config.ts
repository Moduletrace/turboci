import type {
    ParsedDeploymentServiceConfig,
    TCIGlobalConfig,
    TCIConfigLBLocation,
    TCIConfigServiceConfigLBTarget,
} from "@/types";
import { _n } from "@/utils/numberfy";
import grabNginxUpstreamBlock from "./grab-nginx-upstream-block";
import AppData from "@/data/app-data";
import _ from "lodash";
import grabUpstreamNames from "@/utils/grab-upstream-names";
import expandAllowIps from "@/utils/expand-allow-ips";
import grabDefaultProxyLocation from "./grab-nginx-config-default-proxy";
import grabNginxRateLimitingConfig from "./grab-nginx-rate-limit-config";
import grabNginxDirectivesConfig from "./grab-nginx-directives-config";

type Params = {
    load_balancer_service: ParsedDeploymentServiceConfig;
    target_deployment: TCIGlobalConfig;
};

type ZoneEntry = {
    zone_name: string;
    definition: string;
};

function sanitizeZoneName(name: string): string {
    return name.replace(/\W+/g, "_").toLowerCase();
}

export default async function grabLoadBalancerNginxConfig(params: Params) {
    const { target_deployment, load_balancer_service } = params;

    const lb_target_services = load_balancer_service.target_services;

    if (!lb_target_services?.[0]) {
        return undefined;
    }

    const allZones: ZoneEntry[] = [];
    const serviceZoneMaps = new Map<string, Map<string, string>>();

    for (let i = 0; i < lb_target_services.length; i++) {
        const lb_service = lb_target_services[i];

        if (!lb_service?.service_name) {
            continue;
        }

        const all_locations = lb_service?.locations || [];

        if (lb_service?.target_location) {
            all_locations.unshift(lb_service.target_location);
        }

        if (!all_locations?.length) continue;

        const pathToZone = new Map<string, string>();

        for (let j = 0; j < all_locations.length; j++) {
            const loc = all_locations[j];
            if (!loc?.rate_limit) continue;

            const zone_name = `tci_${sanitizeZoneName(lb_service.service_name)}_${j}`;
            const key = loc.rate_limit.key ?? "$binary_remote_addr";
            const definition = `limit_req_zone ${key} zone=${zone_name}:10m rate=${loc.rate_limit.rate};`;

            allZones.push({ zone_name, definition });
            pathToZone.set(loc.path, zone_name);
        }

        if (pathToZone.size > 0) {
            serviceZoneMaps.set(lb_service.service_name, pathToZone);
        }
    }

    let nginxCnf = "";
    nginxCnf += `user www-data;\n`;
    nginxCnf += `worker_processes auto;\n`;
    nginxCnf += `pid /run/nginx.pid;\n`;
    nginxCnf += `include /etc/nginx/modules-enabled/*.conf;\n\n`;

    nginxCnf += `events {\n`;
    nginxCnf += `        worker_connections 768;\n`;
    nginxCnf += `}\n\n`;

    nginxCnf += `http {\n`;
    nginxCnf += `    sendfile on;\n`;
    nginxCnf += `    tcp_nopush on;\n`;
    nginxCnf += `    types_hash_max_size 2048;\n`;
    nginxCnf += `    include /etc/nginx/mime.types;\n`;
    nginxCnf += `    default_type application/octet-stream;\n`;
    nginxCnf += `    ssl_protocols TLSv1 TLSv1.1 TLSv1.2 TLSv1.3;\n`;
    nginxCnf += `    ssl_prefer_server_ciphers on;\n`;
    nginxCnf += `    access_log /var/log/nginx/access.log;\n`;
    nginxCnf += `    error_log /var/log/nginx/error.log;\n`;
    nginxCnf += `    gzip on;\n\n`;

    // Emit limit_req_zone declarations for any rate-limited locations
    if (allZones.length > 0) {
        for (const zone of allZones) {
            nginxCnf += `    ${zone.definition}\n`;
        }
        nginxCnf += `\n`;
    }

    if (lb_target_services?.[0]) {
        for (let i = 0; i < lb_target_services.length; i++) {
            const lb_service = lb_target_services[i];
            if (!lb_service) continue;

            const targetsText = await grabNginxUpstreamBlock({
                target_deployment,
                targets: [lb_service],
                service: lb_service,
            });

            nginxCnf += targetsText;

            const zone_map = serviceZoneMaps.get(lb_service.service_name);

            nginxCnf += grabServerBlock({
                ssl_domains: lb_service.domains
                    ? lb_service.domains.map((d) =>
                          typeof d == "string" ? d : d.domain_name,
                      )
                    : undefined,
                service_name: lb_service.service_name,
                allow_ips: load_balancer_service.allow_ips,
                locations: lb_service.locations,
                zone_map,
                service: load_balancer_service,
                lb_service,
            });
        }
    }

    nginxCnf += `}\n\n`;

    return nginxCnf;
}

type GrabServerBlockParams = {
    ssl_domains?: string[][] | string[];
    service_name: string;
    allow_ips?: string[];
    locations?: TCIConfigLBLocation[];
    zone_map?: Map<string, string>;
    service: ParsedDeploymentServiceConfig;
    lb_service: TCIConfigServiceConfigLBTarget;
};

function grabServerBlock({
    ssl_domains,
    service_name,
    allow_ips,
    locations,
    zone_map,
    service,
    lb_service,
}: GrabServerBlockParams) {
    const expanded_ips = allow_ips?.length
        ? expandAllowIps(allow_ips)
        : undefined;

    let srvBlk = "";

    if (ssl_domains?.[0]) {
        const domainsStr = ssl_domains.flat().join(" ");

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

        if (expanded_ips?.length) {
            srvBlk += `\n`;
            for (const ip of expanded_ips) {
                srvBlk += `        allow ${ip};\n`;
            }
            srvBlk += `        deny all;\n`;
        }

        srvBlk += grabLocation({
            service_name,
            locations,
            zone_map,
            service,
            lb_service,
        });
        srvBlk += `    }\n`;
    } else {
        srvBlk += `    server {\n`;
        srvBlk += `        listen 80;\n`;
        srvBlk += `        server_name ${service_name};\n`;

        if (expanded_ips?.length) {
            srvBlk += `\n`;
            for (const ip of expanded_ips) {
                srvBlk += `        allow ${ip};\n`;
            }
            srvBlk += `        deny all;\n`;
        }

        srvBlk += grabLocation({
            service_name,
            locations,
            zone_map,
            service,
            lb_service,
        });
        srvBlk += `    }\n`;
    }

    return srvBlk;
}

type GrabLocationParams = {
    service_name: string;
    locations?: TCIConfigLBLocation[];
    zone_map?: Map<string, string>;
    service: ParsedDeploymentServiceConfig;
    lb_service: TCIConfigServiceConfigLBTarget;
};

function grabLocation({
    service_name,
    locations,
    zone_map,
    service,
    lb_service,
}: GrabLocationParams) {
    const { upstream_name } = grabUpstreamNames({ service_name });

    let loc = "";

    loc += `        location /.well-known/acme-challenge/ {\n`;
    loc += `            proxy_pass http://127.0.0.1:${AppData["certbot_http_challenge_port"]};\n`;
    loc += `        }\n`;

    if (locations?.length) {
        for (const location of locations) {
            loc += renderCustomLocation({
                location,
                upstream_name,
                zone_map,
            });
        }
    }

    const hasRootLocation = locations?.some((l) => l.path === "/");

    if (hasRootLocation) {
        console.error(
            `Root Location is already handled. Use the \`target_location\` property to append extra rules to the root location.`,
        );
        process.exit(1);
    }

    loc += renderDefaultProxyLocation({
        upstream_name,
        service,
        lb_service,
        zone_map,
    });

    loc += `\n`;

    return loc;
}

function renderDefaultProxyLocation({
    upstream_name,
    service,
    lb_service,
    zone_map,
}: {
    upstream_name: string;
    service: ParsedDeploymentServiceConfig;
    lb_service: TCIConfigServiceConfigLBTarget;
    zone_map?: Map<string, string>;
}): string {
    let loc = "";

    loc += `        location / {\n`;

    loc += grabNginxRateLimitingConfig({
        location: lb_service.target_location,
        zone_map,
    });

    loc += `${grabDefaultProxyLocation({
        upstream_name,
    })}\n`;

    loc += grabNginxDirectivesConfig({
        location: lb_service.target_location,
    });

    loc += `        }\n`;

    return loc;
}

type RenderCustomLocationParams = {
    location: TCIConfigLBLocation;
    upstream_name: string;
    zone_map?: Map<string, string>;
};

function renderCustomLocation({
    location,
    upstream_name,
    zone_map,
}: RenderCustomLocationParams): string {
    let loc = "";

    loc += `        location ${location.path} {\n`;

    loc += grabNginxRateLimitingConfig({
        location,
        zone_map,
    });

    if (location.proxy !== false) {
        loc += `${grabDefaultProxyLocation({
            upstream_name,
        })}\n`;
    }

    loc += grabNginxDirectivesConfig({ location });

    loc += `        }\n`;

    return loc;
}
