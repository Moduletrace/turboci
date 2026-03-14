import locationsList from "./actions/locations/list";

import networksList from "./actions/networks/list";
import networksCreate from "./actions/networks/create";
import networksGet from "./actions/networks/get";
import networksUpdate from "./actions/networks/update";
import networksDelete from "./actions/networks/delete";
import networksCreateSubnet from "./actions/networks/create_subnet";
import networksListSubnets from "./actions/networks/list_subnets";
import networksGetSubnet from "./actions/networks/get_subnet";
import networksCreatePublicIP from "./actions/networks/create_public_ip";
import networksGetPublicIP from "./actions/networks/get_public_ip";
import networksDeletePublicIP from "./actions/networks/delete_public_ip";
import networksCreateNIC from "./actions/networks/create_nic";
import networksDeleteNIC from "./actions/networks/delete_nic";
import networksCreateRouteTable from "./actions/networks/create_route_table";

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

const TurboCIAzure = {
    locations: {
        list: locationsList,
    },
    networks: {
        list: networksList,
        create: networksCreate,
        get: networksGet,
        update: networksUpdate,
        delete: networksDelete,
        create_subnet: networksCreateSubnet,
        list_subnets: networksListSubnets,
        get_subnet: networksGetSubnet,
        create_public_ip: networksCreatePublicIP,
        get_public_ip: networksGetPublicIP,
        delete_public_ip: networksDeletePublicIP,
        create_nic: networksCreateNIC,
        delete_nic: networksDeleteNIC,
        create_route_table: networksCreateRouteTable,
    },
    servers: {
        list: serversList,
        create: serversCreate,
        get: serversGet,
        update: serversUpdate,
        delete: serversDelete,
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

export default TurboCIAzure;
