import { HetznerDatacenters } from "./datacenters";
import { HetznerImages } from "./images";
import { HetznerServerTypes } from "./server-types";

export const HETZNER_API_PATHS = [
    "servers",
    "server_types",
    "locations",
    "datacenters",
    "images",
    "networks",
    "firewalls",
    "ssh_keys",
    "primary_ips",
] as const;

export const HETZNER_API_ACTIONS = ["add_route"] as const;

export type HETZNER_API_RESPONSE_DATA<
    T extends { [key: string]: any } = { [key: string]: any }
> = {
    [key in (typeof HETZNER_API_PATHS)[number]]?: T[];
} & {
    network?: HETZNER_NETWORK | null;
    ssh_key?: HETZNER_SSH_KEY | null;
    firewall?: HETZNER_FIREWALL | null;
    server?: T;
    action?: HETZNER_ACTION_RES;
    primary_ip?: HETZNER_PRIMARY_IPS;
    recommendation?: number;
    meta?: {
        pagination?: {
            page: number;
            per_page: number | null;
            next_page: number | null;
            last_page: number | null;
            total_entries: number | null;
        };
    };
    error?: any;
};

export const HetznerLocations = [
    {
        city: "Falkenstein",
        country: "DE",
        description: "Falkenstein DC Park 1",
        id: 1,
        latitude: 50.47612,
        longitude: 12.370071,
        name: "fsn1",
        network_zone: "eu-central",
    },
    {
        city: "Nuremberg",
        country: "DE",
        description: "Nuremberg DC Park 1",
        id: 2,
        latitude: 49.452102,
        longitude: 11.076665,
        name: "nbg1",
        network_zone: "eu-central",
    },
    {
        city: "Helsinki",
        country: "FI",
        description: "Helsinki DC Park 1",
        id: 3,
        latitude: 60.169855,
        longitude: 24.938379,
        name: "hel1",
        network_zone: "eu-central",
    },
    {
        city: "Ashburn, VA",
        country: "US",
        description: "Ashburn, VA",
        id: 4,
        latitude: 39.045821,
        longitude: -77.487073,
        name: "ash",
        network_zone: "us-east",
    },
    {
        city: "Hillsboro, OR",
        country: "US",
        description: "Hillsboro, OR",
        id: 5,
        latitude: 45.54222,
        longitude: -122.951924,
        name: "hil",
        network_zone: "us-west",
    },
    {
        city: "Singapore",
        country: "SG",
        description: "Singapore",
        id: 6,
        latitude: 1.283333,
        longitude: 103.833333,
        name: "sin",
        network_zone: "ap-southeast",
    },
] as const;

export interface HETZNER_CREATE_SERVER_BODY {
    automount?: boolean;
    datacenter: string;
    firewalls?: HETZNER_CREATE_SERVER_BODY_FIREWALL[];
    image: string;
    labels?: { [k: string]: any };
    location: string;
    name: string;
    networks?: number[];
    placement_group?: number;
    public_net?: HETZNER_CREATE_SERVER_BODY_PUBLIC_NET;
    server_type: string;
    ssh_keys?: string[];
    start_after_create?: boolean;
    user_data?: string;
    volumes?: number[];
}

export interface HETZNER_CREATE_SERVER_BODY_FIREWALL {
    firewall: number;
}

export interface HETZNER_CREATE_SERVER_BODY_PUBLIC_NET {
    enable_ipv4?: boolean;
    enable_ipv6?: boolean;
    ipv4?: any;
    ipv6?: any;
}

export interface HETZNER_SERVER_TYPE {
    id: number;
    name: (typeof HetznerServerTypes)[number]["name"];
    description: (typeof HetznerServerTypes)[number]["description"];
    cores: number;
    memory: number;
    disk: number;
    deprecated: boolean;
    prices: HETZNER_SERVER_TYPE_PRICE[];
    storage_type: string;
    cpu_type: string;
    architecture: string;
    deprecation: any;
}

export interface HETZNER_SERVER_TYPE_PRICE {
    location: (typeof HetznerLocations)[number]["name"];
    price_hourly: HETZNER_SERVER_TYPE_PRICE_HOURLY;
    price_monthly: HETZNER_SERVER_TYPE_PRICE_MONTHLY;
    included_traffic: number;
    price_per_tb_traffic: HETZNER_SERVER_TYPE_PRICE_PER_TB_TRAFFIC;
}

export interface HETZNER_SERVER_TYPE_PRICE_HOURLY {
    net: string;
    gross: string;
}

export interface HETZNER_SERVER_TYPE_PRICE_MONTHLY {
    net: string;
    gross: string;
}

export interface HETZNER_SERVER_TYPE_PRICE_PER_TB_TRAFFIC {
    net: string;
    gross: string;
}

export interface HETZNER_API_ADD_SERVER_BODY {
    automount?: boolean;
    datacenter?: (typeof HetznerDatacenters)[number]["name"];
    firewalls?: HETZNER_API_ADD_SERVER_FIREWALL[];
    image: (typeof HetznerImages)[number]["name"];
    labels?: HETZNER_API_ADD_SERVER_BODY_LABELS;
    location: (typeof HetznerLocations)[number]["name"];
    name: string;
    networks?: number[];
    placement_group?: number;
    public_net?: HETZNER_API_ADD_SERVER_PUBLIC_NET;
    server_type: (typeof HetznerServerTypes)[number]["name"];
    ssh_keys?: ("Coderank" | "Tben")[];
    start_after_create?: boolean;
    user_data?: string;
    volumes?: number[];
}

export type HETZNER_API_ADD_SERVER_BODY_LABELS = { [k: string]: string };

export interface HETZNER_API_ADD_SERVER_FIREWALL {
    firewall: number;
}

export interface HETZNER_API_ADD_SERVER_PUBLIC_NET {
    enable_ipv4: boolean;
    enable_ipv6: boolean;
    ipv4?: any;
    ipv6?: any;
}

export type HETZNER_OS_IMAGE = {
    id: number;
    type: string;
    status: string;
    name: string;
    description: string;
    image_size: any;
    disk_size: number;
    created: string;
    created_from: any;
    bound_to: any;
    os_flavor: string;
    os_version: string;
    rapid_deploy: boolean;
    protection: {
        delete: boolean;
    };
    deprecated: any;
    labels: { [k: string]: string };
    deleted: any;
    architecture: string;
};

export interface HETZNER_NEW_SERVER_RESPONSE {
    action: HETZNER_NEW_SERVER_ACTIONS;
    next_actions: HETZNER_NEW_SERVER_NEW_ACTION[];
    root_password: string;
    server: HETZNER_NEW_SERVER;
}

export interface HETZNER_NEW_SERVER_ACTIONS {
    command: string;
    error: HETZNER_ERROR;
    finished: any;
    id: number;
    progress: number;
    resources: HETZNER_NEW_SERVER_RESOURCE[];
    started: string;
    status: (typeof HetznerServerStatus)[number];
}

export interface HETZNER_ERROR {
    code: string;
    message: string;
}

export interface HETZNER_NEW_SERVER_RESOURCE {
    id: number;
    type: string;
}

export interface HETZNER_NEW_SERVER_NEW_ACTION {
    command: string;
    error: HETZNER_ERROR;
    finished: any;
    id: number;
    progress: number;
    resources: HETZNER_NEW_SERVER_RESOURCE[];
    started: string;
    status: (typeof HetznerServerStatus)[number];
}

export interface HETZNER_ERROR {
    code: string;
    message: string;
}

export interface HETZNER_NEW_SERVER {
    backup_window: string;
    created: string;
    datacenter: HETZNER_NEW_SERVER_DATACENTER;
    id: number;
    image: HETZNER_NEW_SERVER_IMAGE;
    included_traffic: number;
    ingoing_traffic: number;
    iso: HETZNER_NEW_SERVER_ISO;
    labels: { [k: string]: string };
    load_balancers: any[];
    locked: boolean;
    name: string;
    outgoing_traffic: number;
    primary_disk_size: number;
    private_net?: HETZNER_NEW_SERVER_PRIVATE_NET[];
    protection?: HETZNER_NEW_SERVER_PROTECTION;
    public_net?: HETZNER_NEW_SERVER_PUBLIC_NET;
    rescue_enabled?: boolean;
    server_type: HETZNER_NEW_SERVER_SERVER_TYPE;
    status: (typeof HetznerServerStatus)[number];
    volumes: any[];
}

export interface HETZNER_NEW_SERVER_DATACENTER {
    description: string;
    id: number;
    location: HETZNER_LOCATION;
    name: string;
    server_types: HETZNER_NEW_SERVER_DATACENTER_SERVER_TYPE;
}

export interface HETZNER_LOCATION {
    city: string;
    country: string;
    description: string;
    id: number;
    latitude: number;
    longitude: number;
    name: string;
    network_zone: string;
}

export interface HETZNER_NEW_SERVER_DATACENTER_SERVER_TYPE {
    available: number[];
    available_for_migration: number[];
    supported: number[];
}

export interface HETZNER_NEW_SERVER_IMAGE {
    architecture: string;
    bound_to: any;
    created: string;
    created_from: HETZNER_NEW_SERVER_IMAGE_CREATED_FROM;
    deleted: any;
    deprecated: string;
    description: string;
    disk_size: number;
    id: number;
    image_size: number;
    labels: { [k: string]: string };
    name: string;
    os_flavor: string;
    os_version: string;
    protection: HETZNER_NEW_SERVER_PROTECTION;
    rapid_deploy: boolean;
    status: string;
    type: string;
}

export interface HETZNER_NEW_SERVER_IMAGE_CREATED_FROM {
    id: number;
    name: string;
}
export interface HETZNER_NEW_SERVER_ISO {
    architecture: string;
    deprecation: HETZNER_NEW_SERVER_ISO_DEPRECATION;
    description: string;
    id: number;
    name: string;
    type: string;
}

export interface HETZNER_NEW_SERVER_ISO_DEPRECATION {
    announced: string;
    unavailable_after: string;
}

export interface HETZNER_NEW_SERVER_PRIVATE_NET {
    alias_ips: any[];
    ip: string;
    mac_address: string;
    network: number;
}

export interface HETZNER_NEW_SERVER_PROTECTION {
    delete: boolean;
    rebuild?: boolean;
}

export interface HETZNER_NEW_SERVER_PUBLIC_NET {
    firewalls: HETZNER_NEW_SERVER_PUBLIC_NET_FIREWALL[];
    floating_ips: number[];
    ipv4?: HETZNER_NEW_SERVER_PUBLIC_NET_IPV4;
    ipv6?: HETZNER_NEW_SERVER_PUBLIC_NET_IPV6;
}

export interface HETZNER_NEW_SERVER_PUBLIC_NET_FIREWALL {
    id: number;
    status: string;
}

export interface HETZNER_NEW_SERVER_PUBLIC_NET_IPV4 {
    blocked: boolean;
    dns_ptr: string;
    ip: string;
}

export interface HETZNER_NEW_SERVER_PUBLIC_NET_IPV6 {
    blocked: boolean;
    dns_ptr: HETZNER_NEW_SERVER_PUBLIC_NET_DNS_PTR[];
    ip: string;
}

export interface HETZNER_NEW_SERVER_PUBLIC_NET_DNS_PTR {
    dns_ptr: string;
    ip: string;
}

export interface HETZNER_NEW_SERVER_SERVER_TYPE {
    architecture: string;
    cores: number;
    cpu_type: string;
    deprecated: boolean;
    description: string;
    disk: number;
    id: number;
    memory: number;
    name: string;
    prices: HETZNER_NEW_SERVER_SERVER_TYPE_PRICE[];
    storage_type: string;
}

export interface HETZNER_NEW_SERVER_SERVER_TYPE_PRICE {
    included_traffic: number;
    location: string;
    price_hourly: HETZNER_SERVER_TYPE_PRICE_HOURLY;
    price_monthly: HETZNER_SERVER_TYPE_PRICE_HOURLY;
    price_per_tb_traffic: HETZNER_SERVER_TYPE_PRICE_HOURLY;
}

export const HetznerServerStatus = [
    "running",
    "stopped",
    "initializing",
    "starting",
    "stopping",
    "off",
    "deleting",
    "migrating",
    "rebuilding",
    "unknown",
] as const;

export type HETZNER_EXISTING_SERVER = {
    id: number;
    name: string;
    status: (typeof HetznerServerStatus)[number];
    created: string;
    public_net?: HETZNER_NEW_SERVER_PUBLIC_NET;
    private_net?: HETZNER_NEW_SERVER_PRIVATE_NET[];
    server_type: HETZNER_SERVER_TYPE;
    datacenter: HETZNER_NEW_SERVER_DATACENTER;
    image: HETZNER_OS_IMAGE;
    iso: any;
    rescue_enabled: boolean;
    locked: boolean;
    backup_window: any;
    outgoing_traffic: number;
    ingoing_traffic: number;
    included_traffic: number;
    protection: HETZNER_NEW_SERVER_PROTECTION;
    labels: HETZNER_API_ADD_SERVER_BODY_LABELS;
    volumes: any[];
    load_balancers: any[];
    primary_disk_size: number;
    placement_group: any;
};

export type HETZNER_NETWORK = {
    name: string;
    created: string;
    id: number;
    ip_range: string;
    labels: { [k: string]: string };
    load_balancers: number[];
    servers: number[];
    protection: {
        delete: boolean;
    };
    routes: HETZNER_NETWORK_ROUTE[];
    subnets: HETZNER_NETWORK_SUBNET[];
    expose_routes_to_vswitch: boolean;
};

export type HETZNER_NETWORK_ROUTE = {
    destination: string;
    gateway: string;
};

export type HETZNER_NETWORK_SUBNET = {
    ip_range: string;
    network_zone: (typeof HetznerLocations)[number]["network_zone"];
    type: "cloud";
    vswitch_id: number | string | null;
    gateway?: string;
};

export type HETZNER_FIREWALL = {
    id: number;
    name: string;
    labels: { [k: string]: string };
    created: string;
    rules: HETZNER_FIREWALL_RULE[];
    applied_to: HETZNER_FIREWALL_APPLIED_TO[];
};

export type HETZNER_FIREWALL_RULE = {
    description: string | null;
    direction: "in" | "out";
    source_ips?: string[];
    destination_ips?: string[];
    protocol: "tcp";
    port: string;
};

export type HETZNER_FIREWALL_APPLIED_TO = {
    type: "server";
    server?: {
        id: number;
    };
    label_selector?: { [k: string]: string };
    applied_to_resources: {
        type: "server";
        server?: {
            id: number;
        };
    }[];
};

export type HETZNER_ACTION_RES = {
    id: number;
    command: (typeof HETZNER_API_ACTIONS)[number];
    status: (typeof HetznerServerStatus)[number];
    progress: number;
    started: string;
    finished: boolean | null;
    resources: HETZNER_ACTION_RES_RESOURCES[];
    error: HETZNER_ERROR;
};

export type HETZNER_ACTION_RES_RESOURCES = {
    id: number;
    type: "network";
};

export type HETZNER_SSH_KEY = {
    id: number;
    name: string;
    fingerprint: string;
    public_key: string;
    labels: { [k: string]: string };
    created: string;
};

export type HETZNER_PRIMARY_IPS = {
    assignee_id: number;
    assignee_type: "server";
    auto_delete: boolean;
    blocked: boolean;
    created: string;
    datacenter: HETZNER_NEW_SERVER_DATACENTER[];
    dns_ptr: any[];
    id: number;
    ip: string;
    labels?: { [k: string]: string };
    name: string;
    protection: { [k: string]: string };
    type: "ipv4";
};
