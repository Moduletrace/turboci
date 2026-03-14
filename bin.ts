#!/usr/bin/env node

import { program } from "commander";
import up from "./commands/up";
import down from "./commands/down";
import type {
    NormalizedServerObject,
    PackageJson,
    SSHRelayServerReturn,
    TCIConfigService,
    TCIGlobalConfig,
} from "./types";
import init from "./commands/init";
import ora, { type Ora } from "ora";
import grabActiveConfig from "./utils/grab-active-config";
import control from "./commands/control";

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
    var NEW_SERVERS: NormalizedServerObject[];
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
global.NEW_SERVERS = [];
global.UPDATE_LOAD_BALANCERS = false;
global.UPDATED_LOAD_BALANCERS = {};

global.ACTIVE_CONFIGS = grabActiveConfig();

/**
 * # Describe Program
 */
program
    .name(`turboci`)
    .description(`A simple and fast cloud deployment CLI tool`)
    .version(`1.0.0`);

/**
 * # Declare Commands
 */
program.addCommand(up());
program.addCommand(down());
program.addCommand(init());
program.addCommand(control());

/**
 * # Handle Unavailable Commands
 */
program.on("command:*", () => {
    console.error(
        "Invalid command: %s\nSee --help for a list of available commands.",
        program.args.join(" "),
    );
    process.exit(1);
});

/**
 * # Parse Arguments
 */
program.parse(Bun.argv);
