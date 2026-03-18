import type { ExecSyncOptions } from "child_process";

/** The CLI commands registered with Commander.js (`up`, `down`). */
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

/** Subset of package.json used when reading the CLI's own package metadata. */
export interface PackageJson {
    name?: string;
    version?: string;
    description?: string;
    bin?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    [key: string]: any;
}

/** Supported cloud providers. Used in the `init` wizard and config validation. */
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

/** Return shape of `grabConfig` — the parsed deployment list plus optional env file paths. */
export type GrabConfigReturn = {
    deployments: TCIGlobalConfig[];
    envs?: string[];
};

/**
 * Top-level shape of `.turboci/config.yaml` (or `config.ts`).
 * Accepts either a plain array of deployments or an object with a
 * `deployments` key plus optional `envs` (paths to `.env` files loaded
 * before any deployment runs).
 */
export type TCIConfig =
    | TCIConfigDeployment[]
    | {
          deployments: TCIConfigDeployment[];
          envs?: string[];
      };

/**
 * A single deployment definition as written in `config.yaml`.
 * One deployment maps to one cloud region/provider combination and owns
 * a set of named services.
 */
export type TCIConfigDeployment = {
    /** Unique identifier for this deployment. Used in CLI `--target` flags and state files. */
    deployment_name: string;
    /**
     * When set, this deployment is treated as a copy of the named deployment.
     * All services and settings are inherited and can be overridden.
     */
    duplicate_deployment_name?: string;
    description?: string;
    /** Provider-specific datacenter/region slug, e.g. `"ash"` for Hetzner Ashburn. */
    location?: string;
    /** Provider-specific availability zone, e.g. AWS `"us-east-1a"`. */
    availability_zone?: string;
    provider: (typeof CloudProviders)[number]["value"];
    /** Map of service name → service config. Key becomes the service identifier. */
    services: TCIConfigService;
    /** Environment variables injected into every service in this deployment. */
    env?: { [k: string]: string };
    /** Path to a `.env` file whose contents are injected into every service. */
    env_file?: string;
    /** Commands run once on the relay server before any service setup begins. */
    pre_deployment?: TCIRunObj;
    relay_server_options?: TCIConfigRelayServerOptions;
};

/** Options for the relay server provisioned for each deployment. */
export type TCIConfigRelayServerOptions = {
    /** Override the default relay server hardware type (e.g. `"cx22"` on Hetzner). */
    server_type?: string;
};

/**
 * Runtime deployment state used throughout the deployment pipeline.
 * Same as `TCIConfigDeployment` but with `services` resolved to an array
 * of `ParsedDeploymentServiceConfig` (names attached) and the relay server
 * IP recorded after provisioning.
 */
export type TCIGlobalConfig = Omit<TCIConfigDeployment, "services"> & {
    services: ParsedDeploymentServiceConfig[];
    /** Public IP of the relay server, populated after the setup phase. */
    relay_server_ip?: string;
};

/**
 * The `services` map as it appears in `config.yaml`.
 * Keys are service names; values are service configurations.
 */
export type TCIConfigService = {
    [k: string]: TCIConfigServiceConfig;
};

/**
 * Service type values. Drives which provisioning and deployment path is used:
 * - `default` — code-sync + run scripts on bare VMs
 * - `docker` — Docker / Compose workflow
 * - `load_balancer` — NGINX reverse proxy, no application code deployed
 */
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

/** OS images available when provisioning servers via the `init` wizard. */
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

/**
 * Dependency manager types used in `dependencies`:
 * - `apt` — installs packages via `apt-get`
 * - `turboci` — installs runtimes managed by TurboCI (bun, node, docker)
 */
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

/** Git hosting providers supported for `git` source syncing. */
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

/** Container registries supported for pulling Docker images. */
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

/**
 * Configuration for a single named service within a deployment.
 * A service represents one logical tier (e.g. `web`, `api`, `lb`).
 * The `type` field selects the deployment path; all other fields are
 * interpreted in the context of that type.
 */
export type TCIConfigServiceConfig = {
    /** Deployment strategy. Defaults to `"default"` (bare-VM + scripts). */
    type?: (typeof TCIServiceTypes)[number]["value"];
    /** OS image slug to use when creating servers for this service. */
    os?: string;
    /** Hardware/instance type slug, e.g. `"cpx21"` (Hetzner) or `"t3.small"` (AWS). */
    server_type?: string;
    /**
     * When `true`, servers for this service receive a public IP in addition to
     * their private IP. Defaults to `false` — servers are private-only and
     * accessed exclusively through the relay.
     */
    enable_public_ip?: boolean;
    /** Number of servers to provision per cluster. Defaults to `1`. */
    instances?: number;
    /**
     * Number of server clusters. During rolling updates, clusters are
     * deployed one at a time for zero-downtime. Defaults to `1`.
     */
    clusters?: number;
    /** Local → remote directory mappings synced before each deployment. */
    dir_mappings?: TCIConfigServiceConfigDirMApping[];
    /**
     * Packages to install on provisioned servers before running flight scripts.
     * Use `apt` for system packages, `turboci` for managed runtimes (bun, node, docker).
     */
    dependencies?: {
        [k in (typeof TCIServiceDependecyTypes)[number]["value"]]?: string[];
    };
    /** Environment variables injected into this service's servers. */
    env?: { [k: string]: string };
    /** Path to a `.env` file loaded into this service's environment. */
    env_file?: string;
    /**
     * Target services this load balancer proxies to.
     * Only used when `type` is `"load_balancer"`.
     */
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
     * Only applies to `load_balancer` services.
     */
    allow_ips?: string[];
    /** Preflight, start, and postflight shell scripts for this service. */
    run?: TCIConfigServiceConfigRun;
    /** SSL/TLS configuration. Triggers Certbot certificate provisioning. */
    ssl?: TCIConfigServiceSSL;
    /**
     * When set, this service is treated as a copy of the named service
     * within the same deployment.
     */
    duplicate_service_name?: string;
    /** Healthcheck run after the service starts to verify it is live. */
    healthcheck?: TCIConfigServiceHealthcheck;
    /** Shell commands run once on first deploy (not on re-deploys). */
    init?: string[];
    /**
     * Commands or log sources tailed when `turboci control` streams logs
     * for this service.
     */
    logs?: TCIConfigServiceConfigLog[];
    /** Git repository source(s) to clone/pull onto target servers. */
    git?: TCIConfigServiceConfigGit | TCIConfigServiceConfigGit[];
};

/** Configuration for pulling a git repository onto target servers. */
export type TCIConfigServiceConfigGit = {
    /** Git hosting provider. Affects clone URL construction and auth. */
    paradigm?: (typeof TCIGitParadigms)[number]["value"];
    repo_url: string;
    branch?: string;
    /**
     * Absolute path on target servers where the repo is cloned.
     * Defaults to `/app`.
     */
    work_dir?: string;
    /** If `true`, clones without authentication (no deploy key required). */
    public_repo?: boolean;
    username?: string;
    /** Custom git host, used for self-hosted Gitea/Gitlab instances. */
    host?: string;
    /** API key or personal access token for private repo access. */
    api_key?: string;
    /**
     * If `true`, TurboCI continuously polls the repository and re-runs
     * the flight scripts whenever new commits are detected.
     */
    keep_updated?: boolean;
};

/** Configuration for Docker-based services. */
export type TCIConfigServiceConfigDocker = {
    container_registry_paradigm?: (typeof TCIContainerRegistryParadigms)[number]["value"];
    container_registry_url?: string;
    /** Inline Docker Compose service definitions merged into the final compose file. */
    compose?: { [k: string]: any };
    /** Absolute path to the Dockerfile on target servers. */
    docker_file_path?: { [k: string]: any };
    /**
     * Working directory on target servers that contains `docker-compose.yaml`
     * or `Dockerfile`.
     */
    work_dir?: string;
};

/**
 * A log source entry for a service. Either a plain shell command string or
 * an object with an explicit `cmd` key.
 */
export type TCIConfigServiceConfigLog =
    | string
    | {
          cmd: string;
      };

/**
 * Healthcheck run after service startup. `cmd` is executed on the server;
 * `test` is the expected output or exit condition.
 */
export type TCIConfigServiceHealthcheck = {
    cmd: string;
    test: string;
};

/** An explicitly named domain, used as an alternative to a plain domain string. */
export type TCIConfigServiceDomain = {
    domain_name: string;
};

/** SSL configuration. The email is passed to Certbot for Let's Encrypt registration. */
export type TCIConfigServiceSSL = {
    email: string;
};

/** Rate limiting configuration for a single NGINX location block. */
export type TCIConfigLBRateLimit = {
    /** Request rate, e.g. `"10r/s"` or `"100r/m"`. */
    rate: string;
    /** Burst queue size — requests exceeding the rate are queued up to this limit. */
    burst?: number;
    /** If `true`, burst requests are served immediately rather than delayed. */
    nodelay?: boolean;
    /**
     * NGINX rate limit key. Defaults to `"$binary_remote_addr"` (per client IP).
     * Can be any NGINX variable, e.g. `"$http_x_forwarded_for"`.
     */
    key?: string;
};

/**
 * A custom NGINX `location` block rendered inside a load balancer server block.
 * By default each location proxies to the upstream; set `proxy: false` for
 * locations that should be handled locally (static files, redirects, etc.).
 */
export type TCIConfigLBLocation = {
    /**
     * NGINX location path or pattern.
     * Supports all NGINX matching prefixes: `"/"`, `"/api/"`, `"= /ping"`,
     * `"~* \\.(jpg|png)$"`, etc.
     */
    path: string;
    /** Rate limiting applied to this location. */
    rate_limit?: TCIConfigLBRateLimit;
    /**
     * Arbitrary NGINX directives added verbatim inside this location block.
     * String values emit a single directive; array values emit one line per entry.
     *
     * Example:
     * ```yaml
     * directives:
     *   root: /var/www/html
     *   add_header:
     *     - "Cache-Control 'public'"
     *     - "X-Frame-Options DENY"
     * ```
     */
    directives?: { [directive: string]: string | string[] };
    /**
     * If `false`, the upstream `proxy_pass` block is omitted for this location.
     * Use when serving static files, issuing redirects, or returning custom
     * responses. Defaults to `true`.
     */
    proxy?: boolean;
};

/**
 * A single upstream target for a load balancer service.
 * Each target maps to one NGINX `upstream` block and one `server` block.
 */
export type TCIConfigServiceConfigLBTarget = {
    /** Name of the service in the same deployment to proxy traffic to. */
    service_name: string;
    /** Port the target service listens on. */
    port: number;
    /** NGINX upstream weight for weighted round-robin load distribution. */
    weight?: number;
    /** If `true`, this target is used as a fallback when all primary servers are down. */
    backup?: boolean;
    /**
     * Domains to attach to this target's server block. Triggers TLS termination
     * when `ssl` is configured on the parent service. Accepts plain strings or
     * `TCIConfigServiceDomain` objects.
     */
    domains?: (string | TCIConfigServiceDomain)[];
    /**
     * Custom NGINX `location` blocks rendered inside this target's server block.
     * The default `location /` proxy block is auto-generated unless a `"/"` path
     * is explicitly defined here.
     */
    locations?: TCIConfigLBLocation[];
};

/**
 * Flight scripts for a service. Executed in order:
 * `preflight` → `start` → `postflight`.
 */
export type TCIConfigServiceConfigRun = {
    /** Commands run before the service starts (install deps, migrations, etc.). */
    preflight?: TCIRunObj;
    /** Commands that start the service process (must be non-blocking or daemonised). */
    start?: TCIRunObj;
    /** Commands run after the service starts (smoke tests, cache warm-up, etc.). */
    postflight?: TCIRunObj;
    /** Default working directory for all scripts in this run block. */
    work_dir?: string;
};

/**
 * A set of shell commands or a script file to execute on target servers.
 * `cmds` and `file` are mutually exclusive — use one or the other.
 */
export type TCIRunObj = {
    /** Inline shell commands executed sequentially. */
    cmds?: string[];
    /** Working directory for the commands or script. */
    work_dir?: string;
    /** Path to a shell script file on the target server to execute instead of `cmds`. */
    file?: string;
};

/** A local → remote directory sync mapping used during the prepare phase. */
export type TCIConfigServiceConfigDirMApping = {
    /** Local source path (relative to the `.turboci` directory). */
    src: string;
    /** Absolute destination path on target servers. */
    dst: string;
    /** Path to an rsync-style ignore file. */
    ignore_file?: string;
    /** Explicit patterns to exclude from the sync. */
    ignore_patterns?: string[];
    /** If `true`, applies the project's `.gitignore` as rsync exclude rules. */
    use_gitignore?: boolean;
    /** Patterns excluded only on the local → relay leg of the sync. */
    relay_ignore?: string[];
};

/** Options accepted by the `up` and `down` CLI commands. */
export type TCICommandOptions = {
    /** Path to an alternative config file (overrides default `.turboci/config.yaml`). */
    file?: string;
};

/** Options for the programmatic TurboCI library API (`index.ts`). */
export type TCIOptions = {
    config?: TCIConfig;
};

/**
 * OS name fragments used to identify Debian/Ubuntu servers.
 * Server type lookups filter against these strings to prefer
 * known-good OS images.
 */
export const TurboCIPreferedOS = ["debian", "ubuntu"] as const;

/** Regexp built from `TurboCIPreferedOS` for case-insensitive OS name matching. */
export const TurboCIOsPreferenceRegexp = new RegExp(
    `${TurboCIPreferedOS.join("|")}`,
    `i`,
);

/** IPs returned after a relay server is provisioned. */
export type SSHRelayServerReturn = {
    /** Public IP used for the initial SSH connection from the local machine. */
    ip: string;
    /** Private IP used for internal relay → server communication. */
    private_ip: string;
};

/**
 * A cloud server reduced to just its IP addresses.
 * Used wherever provider-specific server objects need to be handled uniformly.
 */
export type NormalizedServerObject = {
    public_ip?: string;
    private_ip?: string;
};

/** Parameters for rsync-based directory synchronisation to remote servers. */
export type SyncRemoteDirsParams = {
    /** Single target IP (use `ips` for multiple). */
    ip?: string;
    /** Multiple target IPs for parallel syncs. */
    ips?: string[];
    /** SSH user on the target servers. Defaults to `"root"`. */
    user?: string;
    src: string;
    dst: string;
    ignore_path?: string;
    ignore_patterns?: string[];
    use_gitignore?: boolean;
    /** If `true`, files deleted locally are also deleted on the remote. */
    delete?: boolean;
    debug?: boolean;
    /** If `true`, routes the sync through the relay server (local → relay → server). */
    use_relay_server?: boolean;
    deployment?: Omit<TCIConfigDeployment, "services">;
    options?: ExecSyncOptions;
    service?: TCIConfigServiceConfig;
    service_name?: string;
    relay_ignore?: string[];
};

/** Parameters passed to prepare-phase handlers (`commands/up/prepare/`). */
export type DefaultPrepParams = {
    service: ParsedDeploymentServiceConfig;
    deployment: TCIGlobalConfig;
    servers: NormalizedServerObject[];
};

/** A shell script string bundled with the service/deployment context it belongs to. */
export type ServiceScriptObject = {
    sh: string;
    service_name: string;
    deployment_name: string;
    work_dir?: string;
};

/**
 * Runtime service config with identity fields attached.
 * Extends `TCIConfigServiceConfig` with the service name (the key from the
 * `services` map), an optional parent name (for duplicated services), and
 * the list of provisioned servers assigned to this service.
 */
export interface ParsedDeploymentServiceConfig extends TCIConfigServiceConfig {
    service_name: string;
    /** Set when this service was created via `duplicate_service_name`. */
    parent_service_name?: string;
    /** Servers provisioned for this service, populated after the setup phase. */
    servers?: NormalizedServerObject[];
}

/** Parameters passed to run-phase handlers (`commands/up/run/`). */
export type DefaultDeploymentParams = {
    service: ParsedDeploymentServiceConfig;
    deployment: TCIGlobalConfig;
};

/** Default CLI flags shared by `up` and `down` commands. */
export type CommanderDefaultOptions = {
    /** Service names to skip during this run. */
    skip?: string[];
    /** Only operate on these service names (ignore all others). */
    target?: string[];
};

/**
 * A server entry returned by `turboci control`, enriched with its
 * deployment and service context for display and SSH targeting.
 */
export interface TurbociControlServer extends NormalizedServerObject {
    /**
     * Service name this server belongs to, or `"__relay"` for the
     * deployment's relay server.
     */
    service_name?: "__relay" | (string & {});
    deployment_name?: string;
}

/** Return value from `turboci control` commands. */
export type TurbociControlReturn = {
    servers?: TurbociControlServer[];
};

/**
 * Runtimes that TurboCI can install automatically via the `turboci`
 * dependency type.
 */
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

/**
 * Computed diff used by the rolling-update logic: which services need to
 * be redeployed and which can be skipped this run.
 */
export type DeploymentAndServicesToUpdate = {
    deployment: TCIGlobalConfig;
    services: ParsedDeploymentServiceConfig[];
    skipped_services: ParsedDeploymentServiceConfig[];
};

/** Generic success/error envelope returned by provider API wrappers. */
export type ResponseObject = {
    success: boolean;
    msg?: string;
};
