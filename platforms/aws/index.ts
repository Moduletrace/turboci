import locationsList from "./actions/locations/list";

import serverTypesList from "./actions/server_types/list";

import imagesList from "./actions/images/list";
import imagesGet from "./actions/images/get";

import networksList from "./actions/networks/list";
import routeTablesList from "./actions/networks/list_route_tables";
import natGatewaysList from "./actions/networks/list_nat_gateways";
import subnetsList from "./actions/networks/list_subnets";
import securityGroupsList from "./actions/networks/list_security_groups";
import networksCreate from "./actions/networks/create";
import natGatewayCreate from "./actions/networks/create_nat";
import routeTableCreate from "./actions/networks/create_route_table";
import networksGet from "./actions/networks/get";
import networksUpdate from "./actions/networks/update";
import networksDelete from "./actions/networks/delete";
import routeTablesDelete from "./actions/networks/delete_route_tables";
import subnetsDelete from "./actions/networks/delete_subnets";
import internetGatewayDelete from "./actions/networks/delete_internet_gateway";

import serversList from "./actions/servers/list";
import serversCreate from "./actions/servers/create";
import serversGet from "./actions/servers/get";
import serversUpdate from "./actions/servers/update";
import serversDelete from "./actions/servers/delete";

import firewallsList from "./actions/firewalls/list";
import firewallsCreate from "./actions/firewalls/create";
import firewallsGet from "./actions/firewalls/get";
import firewallsUpdate from "./actions/firewalls/update";
import firewallsDelete from "./actions/firewalls/delete";

import sshKeysList from "./actions/ssh_keys/list";
import sshKeysCreate from "./actions/ssh_keys/create";
import sshKeysGet from "./actions/ssh_keys/get";
import sshKeysDelete from "./actions/ssh_keys/delete";

const TurboCIAWS = {
    locations: {
        list: locationsList,
    },
    // datacenters: {
    //     list: datacentersList,
    // },
    images: {
        list: imagesList,
        get: imagesGet,
    },
    networks: {
        list: networksList,
        list_route_tables: routeTablesList,
        create: networksCreate,
        create_nat_gateway: natGatewayCreate,
        create_route_table: routeTableCreate,
        get: networksGet,
        update: networksUpdate,
        delete: networksDelete,
        delete_route_tables: routeTablesDelete,
        delete_subnets: subnetsDelete,
        list_subnets: subnetsList,
        list_nat_gateways: natGatewaysList,
        list_security_groups: securityGroupsList,
        delete_internet_gateway: internetGatewayDelete,
    },
    servers: {
        list: serversList,
        create: serversCreate,
        get: serversGet,
        update: serversUpdate,
        delete: serversDelete,
    },
    server_types: {
        list: serverTypesList,
    },
    firewalls: {
        list: firewallsList,
        create: firewallsCreate,
        get: firewallsGet,
        update: firewallsUpdate,
        delete: firewallsDelete,
    },
    ssh_keys: {
        list: sshKeysList,
        create: sshKeysCreate,
        get: sshKeysGet,
        delete: sshKeysDelete,
    },
};

export default TurboCIAWS;
