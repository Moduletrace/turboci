import type {
    ParsedDeploymentServiceConfig,
    TCIGlobalConfig,
    TCIConfigLBLocation,
} from "@/types";
import { _n } from "@/utils/numberfy";
import grabNginxUpstreamBlock from "./grab-nginx-upstream-block";
import AppData from "@/data/app-data";
import _ from "lodash";
import grabUpstreamNames from "@/utils/grab-upstream-names";
import expandAllowIps from "@/utils/expand-allow-ips";

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
        if (!lb_service?.locations?.length) continue;

        const pathToZone = new Map<string, string>();

        for (let j = 0; j < lb_service.locations.length; j++) {
            const loc = lb_service.locations[j];
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
};

function grabServerBlock({
    ssl_domains,
    service_name,
    allow_ips,
    locations,
    zone_map,
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

        srvBlk += grabLocation({ service_name, locations, zone_map });
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

        srvBlk += grabLocation({ service_name, locations, zone_map });
        srvBlk += `    }\n`;
    }

    return srvBlk;
}

type GrabLocationParams = {
    service_name: string;
    locations?: TCIConfigLBLocation[];
    zone_map?: Map<string, string>;
};

function grabLocation({
    service_name,
    locations,
    zone_map,
}: GrabLocationParams) {
    const { upstream_name } = grabUpstreamNames({ service_name });

    let loc = "";

    loc += `        location /.well-known/acme-challenge/ {\n`;
    loc += `            proxy_pass http://127.0.0.1:${AppData["certbot_http_challenge_port"]};\n`;
    loc += `        }\n`;

    if (locations?.length) {
        for (const location of locations) {
            loc += renderCustomLocation({ location, upstream_name, zone_map });
        }
    }

    // Render the default proxy location only if the user hasn't defined one for "/"
    const hasRootLocation = locations?.some((l) => l.path === "/");
    if (!hasRootLocation) {
        loc += renderDefaultProxyLocation(upstream_name);
    }

    loc += `\n`;

    return loc;
}

function renderDefaultProxyLocation(upstream_name: string): string {
    let loc = "";

    loc += `        location / {\n`;
    loc += `            proxy_pass http://${upstream_name};\n`;
    loc += `            proxy_set_header Host \\$host;\n`;
    loc += `            proxy_set_header X-Real-IP \\$remote_addr;\n`;
    loc += `            proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;\n`;

    loc += `            proxy_http_version 1.1;\n`;
    loc += `            proxy_set_header Upgrade \\$http_upgrade;\n`;
    loc += `            proxy_set_header Connection "upgrade";\n`;

    const proxy_connect_timeout = AppData["load_balancer_connect_timeout"];
    const proxy_read_timeout = AppData["load_balancer_read_timeout"];
    const send_timeout = AppData["load_balancer_send_timeout"];

    loc += `            proxy_connect_timeout       ${proxy_connect_timeout}s;\n`;
    loc += `            proxy_send_timeout          ${send_timeout}s;\n`;
    loc += `            proxy_read_timeout          ${proxy_read_timeout}s;\n`;
    loc += `            send_timeout                ${send_timeout}s;\n`;

    const next_upstream_tries = AppData["load_balancer_next_upstream_tries"];
    const next_upstream_timeout =
        AppData["load_balancer_next_upstream_timeout"];

    loc += `            proxy_next_upstream http_500 http_502 http_503 http_504 error timeout invalid_header;\n`;
    loc += `            proxy_next_upstream_tries ${next_upstream_tries};\n`;
    loc += `            proxy_next_upstream_timeout ${next_upstream_timeout}s;\n`;

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

    // Rate limiting
    if (location.rate_limit && zone_map) {
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

    // Proxy pass to upstream (unless explicitly disabled)
    if (location.proxy !== false) {
        loc += `            proxy_pass http://${upstream_name};\n`;
        loc += `            proxy_set_header Host \\$host;\n`;
        loc += `            proxy_set_header X-Real-IP \\$remote_addr;\n`;
        loc += `            proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;\n`;

        loc += `            proxy_http_version 1.1;\n`;
        loc += `            proxy_set_header Upgrade \\$http_upgrade;\n`;
        loc += `            proxy_set_header Connection "upgrade";\n`;

        const proxy_connect_timeout = AppData["load_balancer_connect_timeout"];
        const proxy_read_timeout = AppData["load_balancer_read_timeout"];
        const send_timeout = AppData["load_balancer_send_timeout"];

        loc += `            proxy_connect_timeout       ${proxy_connect_timeout}s;\n`;
        loc += `            proxy_send_timeout          ${send_timeout}s;\n`;
        loc += `            proxy_read_timeout          ${proxy_read_timeout}s;\n`;
        loc += `            send_timeout                ${send_timeout}s;\n`;

        const next_upstream_tries =
            AppData["load_balancer_next_upstream_tries"];
        const next_upstream_timeout =
            AppData["load_balancer_next_upstream_timeout"];

        loc += `            proxy_next_upstream http_500 http_502 http_503 http_504 error timeout invalid_header;\n`;
        loc += `            proxy_next_upstream_tries ${next_upstream_tries};\n`;
        loc += `            proxy_next_upstream_timeout ${next_upstream_timeout}s;\n`;
    }

    // Arbitrary nginx directives
    if (location.directives) {
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

    loc += `        }\n`;

    return loc;
}
