import type { ExecSyncOptions } from "child_process";

export const TCICommands = [
    {
        name: "up",
        description: "Deploy Stack",
    },
    {
        name: "down",
        description: "Destroy Stack",
    },
] as const;

export interface PackageJson {
    name?: string;
    version?: string;
    description?: string;
    bin?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    [key: string]: any;
}

export const CloudProviders = [
    {
        title: "Hetzner",
        value: "hetzner",
    },
    {
        title: "Amazon Web Services",
        value: "aws",
    },
    {
        title: "Google Cloud Platform",
        value: "gcp",
    },
    {
        title: "Microsoft Azure",
        value: "azure",
    },
] as const;

export type GrabConfigReturn = {
    deployments: TCIGlobalConfig[];
    envs?: string[];
};

export type TCIConfig =
    | TCIConfigDeployment[]
    | {
          deployments: TCIConfigDeployment[];
          envs?: string[];
      };

export type TCIConfigDeployment = {
    deployment_name: string;
    duplicate_deployment_name?: string;
    description?: string;
    location?: string;
    availability_zone?: string;
    provider: (typeof CloudProviders)[number]["value"];
    services: TCIConfigService;
    env?: { [k: string]: string };
    env_file?: string;
    pre_deployment?: TCIRunObj;
    relay_server_options?: TCIConfigRelayServerOptions;
};

export type TCIConfigRelayServerOptions = {
    server_type?: string;
};

export type TCIGlobalConfig = Omit<TCIConfigDeployment, "services"> & {
    services: ParsedDeploymentServiceConfig[];
    relay_server_ip?: string;
};

export type TCIConfigService = {
    [k: string]: TCIConfigServiceConfig;
};

export const TCIServiceTypes = [
    {
        title: "Default Service",
        value: "default",
    },
    {
        title: "Docker",
        value: "docker",
    },
    {
        title: "Load Balancer",
        value: "load_balancer",
    },
] as const;

export const TCIServiceOS = [
    {
        title: "Debian 12 Bookworm",
        value: "debian_12",
    },
    {
        title: "Debian 13 Buster",
        value: "debian_13",
    },
    {
        title: "Ubuntu 23.0.4",
        value: "ubuntu_23_0_4",
    },
] as const;

export const TCIServiceDependecyTypes = [
    {
        title: "Debian APT",
        value: "apt",
    },
    {
        title: "Turbo CI",
        value: "turboci",
    },
] as const;

export const TCIGitParadigms = [
    {
        title: "Github",
        value: "github",
    },
    {
        title: "Gitlab",
        value: "gitlab",
    },
    {
        title: "Gitea",
        value: "gitea",
    },
] as const;

export const TCIContainerRegistryParadigms = [
    {
        title: "Docker Hub",
        value: "dockerhub",
    },
    {
        title: "Github Container Registry",
        value: "ghcr",
    },
] as const;

export type TCIConfigServiceConfig = {
    type?: (typeof TCIServiceTypes)[number]["value"];
    os?: string;
    server_type?: string;
    enable_public_ip?: boolean;
    instances?: number;
    clusters?: number;
    dir_mappings?: TCIConfigServiceConfigDirMApping[];
    dependencies?: {
        [k in (typeof TCIServiceDependecyTypes)[number]["value"]]?: string[];
    };
    env?: { [k: string]: string };
    env_file?: string;
    target_services?: TCIConfigServiceConfigLBTarget[];
    /**
     * Restrict inbound requests to these IPs/CIDRs only. All other IPs are
     * denied. Applies to all server blocks on this load balancer.
     *
     * Accepts raw IPs/CIDRs or named providers which are automatically
     * expanded to their published ranges. Supported providers: "cloudflare".
     *
     * Example: ["cloudflare", "5.78.1.245"]
     *
     * Only applies to load_balancer services.
     */
    allow_ips?: string[];
    run?: TCIConfigServiceConfigRun;
    ssl?: TCIConfigServiceSSL;
    duplicate_service_name?: string;
    healthcheck?: TCIConfigServiceHealthcheck;
    /**
     * Commoands to Run on first run
     */
    init?: string[];
    logs?: TCIConfigServiceConfigLog[];
    git?: TCIConfigServiceConfigGit | TCIConfigServiceConfigGit[];
};

export type TCIConfigServiceConfigGit = {
    paradigm?: (typeof TCIGitParadigms)[number]["value"];
    repo_url: string;
    branch?: string;
    /**
     * Directory in target servers where the repo should
     * live. Defaults to `/app`
     */
    work_dir?: string;
    public_repo?: boolean;
    username?: string;
    host?: string;
    api_key?: string;
    /**
     * If true, this will continuosly pull from the git source
     * and rerun the flight commands
     */
    keep_updated?: boolean;
};

export type TCIConfigServiceConfigDocker = {
    container_registry_paradigm?: (typeof TCIContainerRegistryParadigms)[number]["value"];
    container_registry_url?: string;

    compose?: { [k: string]: any };
    /**
     * Location of the dockerfile in the target servers
     */
    docker_file_path?: { [k: string]: any };
    /**
     * Directory in target servers which is the docker
     * reference for files like `docker-compose.yaml` or
     * `Dockerfile`.
     */
    work_dir?: string;
};

export type TCIConfigServiceConfigLog =
    | string
    | {
          cmd: string;
      };

export type TCIConfigServiceHealthcheck = {
    cmd: string;
    test: string;
};

export type TCIConfigServiceDomain = {
    domain_name: string;
};

export type TCIConfigServiceSSL = {
    email: string;
};

export type TCIConfigLBRateLimit = {
    /** Request rate, e.g. "10r/s", "100r/m" */
    rate: string;
    /** Burst queue size */
    burst?: number;
    /** If true, excess requests are served without delay (nginx nodelay) */
    nodelay?: boolean;
    /** Rate limit key. Defaults to "$binary_remote_addr" */
    key?: string;
};

export type TCIConfigLBLocation = {
    /** Location path pattern, e.g. "/", "/api/", "~* \\.(jpg|png)$" */
    path: string;
    /** Rate limiting for this location */
    rate_limit?: TCIConfigLBRateLimit;
    /**
     * Additional nginx directives as key-value pairs.
     * Array values emit one directive line per entry.
     */
    directives?: { [directive: string]: string | string[] };
    /**
     * If false, disables proxy_pass to the upstream for this location.
     * Defaults to true.
     */
    proxy?: boolean;
};

export type TCIConfigServiceConfigLBTarget = {
    service_name: string;
    port: number;
    weight?: number;
    backup?: boolean;
    domains?: (string | TCIConfigServiceDomain)[];
    /** Custom NGINX location blocks rendered inside this target's server block */
    locations?: TCIConfigLBLocation[];
};

export type TCIConfigServiceConfigRun = {
    preflight?: TCIRunObj;
    start?: TCIRunObj;
    postflight?: TCIRunObj;
    work_dir?: string;
};

export type TCIRunObj = {
    cmds?: string[];
    work_dir?: string;
    file?: string;
};

export type TCIConfigServiceConfigDirMApping = {
    src: string;
    dst: string;
    ignore_file?: string;
    ignore_patterns?: string[];
    use_gitignore?: boolean;
    relay_ignore?: string[];
};

export type TCICommandOptions = {
    file?: string;
};

export type TCIOptions = {
    config?: TCIConfig;
};

export const TurboCIPreferedOS = ["debian", "ubuntu"] as const;

export const TurboCIOsPreferenceRegexp = new RegExp(
    `${TurboCIPreferedOS.join("|")}`,
    `i`,
);

export type SSHRelayServerReturn = {
    ip: string;
    private_ip: string;
};

export type NormalizedServerObject = {
    public_ip?: string;
    private_ip?: string;
};

export type SyncRemoteDirsParams = {
    ip?: string;
    ips?: string[];
    user?: string;
    src: string;
    dst: string;
    ignore_path?: string;
    ignore_patterns?: string[];
    use_gitignore?: boolean;
    delete?: boolean;
    debug?: boolean;
    use_relay_server?: boolean;
    deployment?: Omit<TCIConfigDeployment, "services">;
    options?: ExecSyncOptions;
    service?: TCIConfigServiceConfig;
    service_name?: string;
    relay_ignore?: string[];
};

export type DefaultPrepParams = {
    service: ParsedDeploymentServiceConfig;
    deployment: TCIGlobalConfig;
    servers: NormalizedServerObject[];
};

export type ServiceScriptObject = {
    sh: string;
    service_name: string;
    deployment_name: string;
    work_dir?: string;
};

export interface ParsedDeploymentServiceConfig extends TCIConfigServiceConfig {
    service_name: string;
    parent_service_name?: string;
    servers?: NormalizedServerObject[];
}

export type DefaultDeploymentParams = {
    service: ParsedDeploymentServiceConfig;
    deployment: TCIGlobalConfig;
};

export type CommanderDefaultOptions = {
    skip?: string[];
    target?: string[];
};

export interface TurbociControlServer extends NormalizedServerObject {
    service_name?: "__relay" | (string & {});
    deployment_name?: string;
}

export type TurbociControlReturn = {
    servers?: TurbociControlServer[];
};

export const TurboCIDependencies = [
    {
        package_name: "bun",
    },
    {
        package_name: "node",
    },
    {
        package_name: "docker",
    },
] as const;

export type DeploymentAndServicesToUpdate = {
    deployment: TCIGlobalConfig;
    services: ParsedDeploymentServiceConfig[];
    skipped_services: ParsedDeploymentServiceConfig[];
};

export type ResponseObject = {
    success: boolean;
    msg?: string;
};
