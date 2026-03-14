import type { ParsedDeploymentServiceConfig, TCIGlobalConfig } from "@/types";
import { _n } from "@/utils/numberfy";
import grabNginxUpstreamBlock from "./grab-nginx-upstream-block";
import AppData from "@/data/app-data";
import _ from "lodash";
import grabUpstreamNames from "@/utils/grab-upstream-names";

type Params = {
    load_balancer_service: ParsedDeploymentServiceConfig;
    target_deployment: TCIGlobalConfig;
};

export default async function grabLoadBalancerNginxConfig(params: Params) {
    const { target_deployment, load_balancer_service } = params;

    const lb_target_services = load_balancer_service.target_services;

    if (!lb_target_services?.[0]) {
        return undefined;
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

            nginxCnf += grabServerBlock({
                ssl_domains: lb_service.domains
                    ? lb_service.domains.map((d) =>
                          typeof d == "string" ? d : d.domain_name
                      )
                    : undefined,
                service_name: lb_service.service_name,
            });
        }

        // if (main_targets?.[0]) {
        //     const mainTargetsText = await grabNginxUpstreamBlock({
        //         target_deployment,
        //         targets: main_targets,
        //     });
        //     nginxCnf += mainTargetsText;
        // }

        // if (backup_targets?.[0]) {
        //     const backupText = await grabNginxUpstreamBlock({
        //         target_deployment,
        //         targets: backup_targets,
        //         backup: true,
        //     });
        //     nginxCnf += backupText;
        // }

        // nginxCnf += grabServerBlock({
        //     backup: Boolean(backup_targets?.[0]),
        //     default: true,
        //     ssl_domains,
        // });
    }

    // nginxCnf += `    include /etc/nginx/conf.d/*.conf;\n`;
    // nginxCnf += `    include /etc/nginx/sites-enabled/*;\n`;

    // nginxCnf += `    server {\n`;
    // nginxCnf += `        listen 80;\n`;
    // nginxCnf += `        server_name _;\n`;
    // nginxCnf += `        location /.well-known/acme-challenge/ {\n`;
    // nginxCnf += `            proxy_pass http://127.0.0.1:${AppData["certbot_http_challenge_port"]};\n`;
    // nginxCnf += `        }\n`;
    // nginxCnf += `    }\n`;

    nginxCnf += `}\n\n`;

    return nginxCnf;
}

type GrabServerBlockParams = {
    ssl_domains?: string[][] | string[];
    service_name: string;
};

function grabServerBlock({ ssl_domains, service_name }: GrabServerBlockParams) {
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
        srvBlk += grabLocation({
            service_name,
        });
        srvBlk += `    }\n`;
    } else {
        srvBlk += `    server {\n`;
        srvBlk += `        listen 80;\n`;
        srvBlk += `        server_name ${service_name};\n`;
        srvBlk += grabLocation({
            service_name,
        });
        srvBlk += `    }\n`;
    }

    return srvBlk;
}

type GrabLocationParams = {
    service_name: string;
};

function grabLocation({ service_name }: GrabLocationParams) {
    const { upstream_name } = grabUpstreamNames({
        service_name,
    });

    let loc = "";

    loc += `        location /.well-known/acme-challenge/ {\n`;
    loc += `            proxy_pass http://127.0.0.1:${AppData["certbot_http_challenge_port"]};\n`;
    loc += `        }\n`;

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

    loc += `\n`;

    return loc;
}
