import type { TCIConfigServiceConfig } from "@/types";

type Params = {
    load_balancer_service: TCIConfigServiceConfig;
};

export default function grabSSLDomains(params: Params) {
    const { load_balancer_service } = params;

    const load_balancer_service_domains = load_balancer_service.target_services
        ?.map((s) =>
            s.domains?.map((d) => (typeof d == "string" ? d : d.domain_name))
        )
        .filter((d) => Boolean(d))
        .flat() as string[] | undefined;

    return load_balancer_service_domains;

    // let ssl_domains: string[][] = [];

    // if (
    //     load_balancer_service.domains?.[0] &&
    //     load_balancer_service.ssl?.email
    // ) {
    //     for (let i = 0; i < load_balancer_service.domains.length; i++) {
    //         const domain = load_balancer_service.domains[i];
    //         if (!domain) continue;

    //         const domain_name =
    //             typeof domain == "string" ? domain : domain.domain_name;
    //         const main_domain = domain_name
    //             .split(".")
    //             .reverse()
    //             .slice(0, 2)
    //             .reverse()
    //             .join(".");

    //         const existingDomainIndex = ssl_domains.findIndex((d) =>
    //             d.find((_d) => _d.endsWith(main_domain))
    //         );

    //         if (
    //             typeof existingDomainIndex == "number" &&
    //             existingDomainIndex >= 0
    //         ) {
    //             ssl_domains[existingDomainIndex]?.push(domain_name);
    //         } else {
    //             ssl_domains.push([domain_name]);
    //         }
    //     }
    // }

    // if (!ssl_domains?.[0]) return undefined;

    // return ssl_domains;
}
