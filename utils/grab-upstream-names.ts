import { AppNames } from "./app-names";

type Params = {
    service_name: string;
    port: string | number;
};

export default function ({ service_name, port }: Params) {
    const upstream_name = `${AppNames["LoadBalancerUpstreamName"]}_${service_name}_${port}`;
    return { upstream_name };
}
