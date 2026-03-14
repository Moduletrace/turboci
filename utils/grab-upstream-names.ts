import { AppNames } from "./app-names";

type Params = {
    service_name: string;
};

export default function ({ service_name }: Params) {
    const upstream_name = service_name
        ? `${AppNames["LoadBalancerUpstreamName"]}_${service_name}`
        : AppNames["LoadBalancerUpstreamName"];
    // const backup_upstream_name = service_name
    //     ? `${AppNames["LoadBalancerBakcupUpstreamName"]}_${service_name}`
    //     : AppNames["LoadBalancerBakcupUpstreamName"];

    return { upstream_name };
}
