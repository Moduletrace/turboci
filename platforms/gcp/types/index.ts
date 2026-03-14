import type { compute_v1 } from "googleapis";
import { AppNames } from "@/utils/app-names";

export type GCP_INSTANCE = compute_v1.Schema$Instance;
export type GCP_NETWORK = compute_v1.Schema$Network;
export type GCP_SUBNET = compute_v1.Schema$Subnetwork;
export type GCP_FIREWALL = compute_v1.Schema$Firewall;
export type GCP_ROUTE = compute_v1.Schema$Route;
export type GCP_OPERATION = compute_v1.Schema$Operation;

export function gcpGetProject(): string {
    return process.env[AppNames["GCPProjectID"]] || "";
}

export function gcpGetRegionFromZone(zone: string): string {
    return zone.split("-").slice(0, -1).join("-");
}

export function gcpNetworkUrl(networkName: string): string {
    const project = gcpGetProject();
    return `projects/${project}/global/networks/${networkName}`;
}

export function gcpSubnetUrl(region: string, subnetName: string): string {
    const project = gcpGetProject();
    return `projects/${project}/regions/${region}/subnetworks/${subnetName}`;
}

export function gcpInstanceUrl(zone: string, instanceName: string): string {
    const project = gcpGetProject();
    return `projects/${project}/zones/${zone}/instances/${instanceName}`;
}
