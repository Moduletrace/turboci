import { IPProviders, type IPProviderName } from "@/data/ip-providers";

/**
 * Expands named providers (e.g. "cloudflare") in an allow_ips array to their
 * actual IP/CIDR ranges. Raw IPs and CIDRs are passed through unchanged.
 */
export default function expandAllowIps(allow_ips: string[]): string[] {
    const expanded: string[] = [];

    for (const entry of allow_ips) {
        const provider = IPProviders[entry as IPProviderName];
        if (provider) {
            expanded.push(...provider.ipv4, ...provider.ipv6);
        } else {
            expanded.push(entry);
        }
    }

    return expanded;
}
