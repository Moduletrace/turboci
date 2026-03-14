import type { Ora } from "ora";
import get from "./functions/get";
import type {
    PackageJson,
    SSHRelayServerReturn,
    TCIConfigService,
    TCIGlobalConfig,
} from "./types";
import ora from "ora";
import grabActiveConfig from "./utils/grab-active-config";
import exec from "./functions/exec";
import terminal from "./functions/terminal";

/**
 * # Declare Global Variables
 */
declare global {
    var PACKAGE_JSON: PackageJson;
    var CONFIGS: TCIGlobalConfig[] | undefined;
    var ACTIVE_CONFIGS: TCIGlobalConfig[] | undefined;
    var RELAY_SERVERS: { [k: string]: SSHRelayServerReturn };
    var ORA_SPINNER: Ora;
    var REBUILD_FIRST_SERVER: {
        deployment_name: string;
        service_name: string;
    }[];
    var LOAD_BALANCERS: TCIConfigService[];
    var UPDATE_LOAD_BALANCERS: boolean;
    var UPDATED_LOAD_BALANCERS: { [k: string]: boolean };
    var CURRENT_DEPLOYMENT_INDEX: number;
    var CURRENT_SERVICE_INDEX: number;
}

global.RELAY_SERVERS = {};
global.ORA_SPINNER = ora();
global.ORA_SPINNER.clear();

global.REBUILD_FIRST_SERVER = [];
global.LOAD_BALANCERS = [];
global.UPDATE_LOAD_BALANCERS = false;
global.UPDATED_LOAD_BALANCERS = {};

global.ACTIVE_CONFIGS = grabActiveConfig();

const turboci = {
    get,
    exec,
    terminal,
};

export default turboci;
