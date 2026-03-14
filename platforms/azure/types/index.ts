export type AZURE_VM = {
    id?: string;
    name?: string;
    location?: string;
    tags?: { [k: string]: string };
    properties?: {
        provisioningState?: string;
        hardwareProfile?: {
            vmSize?: string;
        };
        storageProfile?: {
            imageReference?: {
                publisher?: string;
                offer?: string;
                sku?: string;
                version?: string;
            };
            osDisk?: {
                name?: string;
                managedDisk?: { id?: string };
            };
        };
        osProfile?: {
            computerName?: string;
            adminUsername?: string;
            linuxConfiguration?: {
                ssh?: {
                    publicKeys?: Array<{
                        path?: string;
                        keyData?: string;
                    }>;
                };
            };
        };
        networkProfile?: {
            networkInterfaces?: Array<{
                id?: string;
                properties?: {
                    primary?: boolean;
                };
            }>;
        };
        instanceView?: {
            statuses?: Array<{
                code?: string;
                displayStatus?: string;
            }>;
        };
    };
};

export type AZURE_VNET = {
    id?: string;
    name?: string;
    location?: string;
    tags?: { [k: string]: string };
    properties?: {
        provisioningState?: string;
        addressSpace?: {
            addressPrefixes?: string[];
        };
        subnets?: AZURE_SUBNET[];
    };
};

export type AZURE_SUBNET = {
    id?: string;
    name?: string;
    properties?: {
        provisioningState?: string;
        addressPrefix?: string;
        networkSecurityGroup?: {
            id?: string;
        };
        routeTable?: {
            id?: string;
        };
    };
};

export type AZURE_NSG = {
    id?: string;
    name?: string;
    location?: string;
    tags?: { [k: string]: string };
    properties?: {
        provisioningState?: string;
        securityRules?: AZURE_NSG_RULE[];
    };
};

export type AZURE_NSG_RULE = {
    name?: string;
    properties?: {
        protocol?: string;
        sourcePortRange?: string;
        destinationPortRange?: string;
        sourceAddressPrefix?: string;
        destinationAddressPrefix?: string;
        access?: string;
        priority?: number;
        direction?: string;
        provisioningState?: string;
    };
};

export type AZURE_PUBLIC_IP = {
    id?: string;
    name?: string;
    location?: string;
    properties?: {
        provisioningState?: string;
        ipAddress?: string;
        publicIPAllocationMethod?: string;
    };
};

export type AZURE_NIC = {
    id?: string;
    name?: string;
    location?: string;
    properties?: {
        provisioningState?: string;
        enableIPForwarding?: boolean;
        networkSecurityGroup?: { id?: string };
        ipConfigurations?: Array<{
            id?: string;
            name?: string;
            properties?: {
                privateIPAddress?: string;
                privateIPAllocationMethod?: string;
                subnet?: { id?: string };
                publicIPAddress?: { id?: string };
            };
        }>;
    };
};

export type AZURE_ROUTE_TABLE = {
    id?: string;
    name?: string;
    location?: string;
    tags?: { [k: string]: string };
    properties?: {
        provisioningState?: string;
        routes?: AZURE_ROUTE[];
    };
};

export type AZURE_ROUTE = {
    id?: string;
    name?: string;
    properties?: {
        provisioningState?: string;
        addressPrefix?: string;
        nextHopType?: string;
        nextHopIpAddress?: string;
    };
};
