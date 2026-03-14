import locationsList from "./actions/locations/list";

import networksList from "./actions/networks/list";
import networksCreate from "./actions/networks/create";
import networksGet from "./actions/networks/get";
import networksDelete from "./actions/networks/delete";
import networksAddRoute from "./actions/networks/add-route";
import networksCreateSubnet from "./actions/networks/create_subnet";
import networksListSubnets from "./actions/networks/list_subnets";

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

const TurboCIGCP = {
    locations: {
        list: locationsList,
    },
    networks: {
        list: networksList,
        create: networksCreate,
        get: networksGet,
        delete: networksDelete,
        add_route: networksAddRoute,
        create_subnet: networksCreateSubnet,
        list_subnets: networksListSubnets,
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

export default TurboCIGCP;
