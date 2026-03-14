import AppData from "@/data/app-data";
import type { ParsedDeploymentServiceConfig } from "@/types";

type Params = {
    load_balancer_service: ParsedDeploymentServiceConfig;
    current_active_service?: ParsedDeploymentServiceConfig;
};

export default function grabLoadBalancerCertbotSH(params: Params) {
    const { load_balancer_service, current_active_service } = params;

    let finalCmd = ``;

    if (load_balancer_service.ssl?.email) {
        const lb_targets = load_balancer_service.target_services;

        if (!lb_targets?.[0]) return finalCmd;

        for (let t = 0; t < lb_targets.length; t++) {
            const lb_target = lb_targets[t];
            const target_domains = lb_target?.domains;
            const lb_service_name = lb_target?.service_name;

            if (!target_domains?.[0] || !lb_service_name) continue;

            const ssl_domains: string[] = [];

            for (let i = 0; i < target_domains.length; i++) {
                const domain = target_domains[i];
                const domain_name =
                    typeof domain == "string" ? domain : domain?.domain_name;
                if (!domain_name) continue;
                ssl_domains.push(domain_name);
            }

            if (!ssl_domains?.[0]) continue;

            let certbotSSLCMd = `certbot certonly --standalone --http-01-port ${AppData["certbot_http_challenge_port"]}`;

            for (let i = 0; i < ssl_domains.length; i++) {
                const domain_name = ssl_domains[i];
                certbotSSLCMd += ` -d ${domain_name}`;
            }

            certbotSSLCMd += ` --cert-name ${lb_service_name}`;
            certbotSSLCMd += ` --keep-until-expiring --reuse-key`;
            certbotSSLCMd += ` --non-interactive --agree-tos`;
            certbotSSLCMd += ` -m ${load_balancer_service.ssl.email}`;

            const all_ssl_domains_string = ssl_domains.flat().join(" ");

            finalCmd += `\nif ! grep "server_name ${all_ssl_domains_string};" /etc/nginx/nginx.conf || ! ls /etc/letsencrypt/live/${lb_service_name}/privkey.pem; then\n`;

            // if (ssl_domains[0]) {
            //     const currentDomainsCount = (
            //         current_active_service?.target_services
            //             ?.map((s) =>
            //                 s.domains?.map((d) =>
            //                     typeof d == "string" ? d : d.domain_name
            //                 )
            //             )
            //             .filter((d) => Boolean(d))
            //             .flat() as string[] | undefined
            //     )?.length;

            //     if (
            //         currentDomainsCount &&
            //         currentDomainsCount !== ssl_domains.flat().length
            //     ) {
            //         finalCmd += `    certbot delete --cert-name ${lb_service_name} --non-interactive\n`;
            //     }
            // }

            finalCmd += `    ${certbotSSLCMd}\n`;
            finalCmd += `fi\n`;
        }
    }

    return finalCmd.match(/\w/) ? finalCmd : undefined;
}
