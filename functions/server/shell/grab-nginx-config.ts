import type { ParsedDeploymentServiceConfig, TCIGlobalConfig } from "@/types";
import { _n } from "@/utils/numberfy";
import grabNginxUpstreamBlock from "./grab-nginx-upstream-block";
import _ from "lodash";
import grabNginxConfigServerBlock from "./grab-nginx-server-block";

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

        const all_locations = [...(lb_service?.locations ?? [])];

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
            pathToZone.set(loc.match, zone_name);
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
            const lb_target_service = lb_target_services[i];
            if (!lb_target_service) continue;

            const target_upstream_config = await grabNginxUpstreamBlock({
                target_deployment,
                service: lb_target_service,
            });

            nginxCnf += target_upstream_config;

            const locations_with_ports = lb_target_service.locations?.filter(
                (loc) => Boolean(loc.target_port),
            );

            if (locations_with_ports?.[0]) {
                for (let i = 0; i < locations_with_ports.length; i++) {
                    const locations_with_port = locations_with_ports[i];
                    if (!locations_with_port?.target_port) {
                        continue;
                    }

                    const locations_with_port_upstream_config =
                        await grabNginxUpstreamBlock({
                            target_deployment,
                            service: {
                                ...lb_target_service,
                                port: _n(locations_with_port.target_port),
                            },
                        });

                    nginxCnf += locations_with_port_upstream_config;
                }
            }

            const zone_map = serviceZoneMaps.get(
                lb_target_service.service_name,
            );

            nginxCnf += grabNginxConfigServerBlock({
                ssl_domains: lb_target_service.domains
                    ? lb_target_service.domains.map((d) =>
                          typeof d == "string" ? d : d.domain_name,
                      )
                    : undefined,
                service_name: lb_target_service.service_name,
                allow_ips: load_balancer_service.allow_ips,
                locations: lb_target_service.locations,
                zone_map,
                lb_target_service,
            });
        }
    }

    nginxCnf += `}\n\n`;

    return nginxCnf;
}
