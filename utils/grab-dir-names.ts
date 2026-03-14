import path from "path";
import { AppNames } from "./app-names";
import { existsSync } from "fs";

type Params = {
    name?: string;
};

export default function grabDirNames(params?: Params) {
    let passedTurboCIDir = process.env.TURBOCI_DIR;

    if (passedTurboCIDir && !existsSync(passedTurboCIDir)) {
        console.error(`Turboci Dir \`${passedTurboCIDir}\` does not exist!`);
        process.exit(1);
    }

    if (passedTurboCIDir && passedTurboCIDir.endsWith(".turboci")) {
        passedTurboCIDir = path.resolve(passedTurboCIDir, "../");
    }

    const rootDir = passedTurboCIDir || process.cwd();
    const turbociDir = path.join(rootDir, ".turboci");
    const tmpDir = path.join(rootDir, ".tmp");

    const configYAML = path.join(turbociDir, "config.yaml");
    const activeConfigYAML = path.join(turbociDir, "active.yaml");
    const configTS = path.join(turbociDir, "config.ts");

    const activeDeploymentJSON = path.join(turbociDir, "deployment.json");

    const sshDir = path.join(turbociDir, ".ssh");
    const sshPublicKeyFile = path.join(
        sshDir,
        `${AppNames["TurboCISSHKeyName"]}.pub`,
    );
    const sshPrivateKeyFile = path.join(sshDir, AppNames["TurboCISSHKeyName"]);

    const relayTurboCIDir = "/root/.turboci";
    const relayDeploymentIDFile = path.join(relayTurboCIDir, "deployment_id");
    const relayConfigDir = path.join(relayTurboCIDir, ".config");
    const relayAdminDir = path.join(relayTurboCIDir, ".admin");
    const relayConfigJSON = path.join(relayConfigDir, "turboci.json");
    const relayServerSSHDir = path.join(relayTurboCIDir, ".ssh");
    const relayServerBunScriptsDir = path.join(relayTurboCIDir, ".bun");
    const relayServerBunScriptFile = path.join(
        relayServerBunScriptsDir,
        "run.ts",
    );
    const relayServerSshPublicKeyFile = path.join(
        relayServerSSHDir,
        `${AppNames["TurboCISSHKeyName"]}.pub`,
    );
    const relayServerSshPrivateKeyFile = path.join(
        relayServerSSHDir,
        AppNames["TurboCISSHKeyName"],
    );

    const relayServerRsyncDir = "/root/.turboci/.rsync";
    const relayShDir = "/root/.turboci/.sh";
    const relayShExecFile = path.join(relayShDir, "relay.sh");

    const relayNGINXConfigFile = `/etc/nginx/nginx.conf`;
    const relayNGINXConfigDir = `/etc/nginx/conf.d`;
    const relayNGINXDefaultServerConfigFile = path.join(
        relayNGINXConfigDir,
        "default.conf",
    );

    const localRelayShExecFile = path.join(turbociDir, "relay.sh");

    return {
        rootDir,
        turbociDir,
        configYAML,
        configTS,
        activeDeploymentJSON,
        sshDir,
        sshPublicKeyFile,
        sshPrivateKeyFile,
        activeConfigYAML,
        relayServerSSHDir,
        relayServerSshPublicKeyFile,
        relayServerSshPrivateKeyFile,
        relayServerRsyncDir,
        tmpDir,
        relayServerBunScriptsDir,
        relayServerBunScriptFile,
        relayShDir,
        relayShExecFile,
        localRelayShExecFile,
        relayConfigDir,
        relayConfigJSON,
        relayDeploymentIDFile,
        relayNGINXConfigFile,
        relayNGINXConfigDir,
        relayNGINXDefaultServerConfigFile,
        relayAdminDir,
    };
}
