import locationsList from "./actions/locations/list";

import serverTypesList from "./actions/server_types/list";

import datacentersList from "./actions/datacenters/list";

import imagesList from "./actions/images/list";

import networksList from "./actions/networks/list";
import networksCreate from "./actions/networks/create";
import networksGet from "./actions/networks/get";
import networksUpdate from "./actions/networks/update";
import networksDelete from "./actions/networks/delete";
import networksAddRoute from "./actions/networks/add-route";

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
import sshKeysUpdate from "./actions/ssh_keys/update";
import sshKeysDelete from "./actions/ssh_keys/delete";

import primaryIPsList from "./actions/primary_ips/list";
import primaryIPsCreate from "./actions/primary_ips/create";
import primaryIPsGet from "./actions/primary_ips/get";
import primaryIPsUpdate from "./actions/primary_ips/update";
import primaryIPsDelete from "./actions/primary_ips/delete";

const Hetzner = {
    locations: {
        list: locationsList,
    },
    datacenters: {
        list: datacentersList,
    },
    images: {
        list: imagesList,
    },
    networks: {
        list: networksList,
        create: networksCreate,
        get: networksGet,
        update: networksUpdate,
        delete: networksDelete,
        add_route: networksAddRoute,
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
        update: sshKeysUpdate,
        delete: sshKeysDelete,
    },
    primary_ips: {
        list: primaryIPsList,
        create: primaryIPsCreate,
        get: primaryIPsGet,
        update: primaryIPsUpdate,
        delete: primaryIPsDelete,
    },
};

export default Hetzner;
