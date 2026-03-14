import list, { type AWSFirewallListParams } from "./list";

export default async function (params: AWSFirewallListParams) {
    const firewallsRes = await list(params);
    return { firewall: firewallsRes?.firewalls?.[0] };
}
