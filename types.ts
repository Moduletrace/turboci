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
 * - `maxscale` — MariaDB MaxScale proxy (read/write split, connection routing)
 * - `mariadb-galera` — MariaDB Galera multi-master cluster
 * - `postgres` — PostgreSQL server (standalone or with streaming replication)
 * - `haproxy` — HAProxy TCP/HTTP proxy (works with any backend: postgres, mysql, mariadb, redis, etc.)
 * - `mysql` — MySQL server (standalone or with primary/replica replication)
 * - `proxysql` — ProxySQL connection proxy for MySQL and MariaDB (not PostgreSQL)
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
    {
        title: "MaxScale (MariaDB/MySQL Proxy)",
        value: "maxscale",
    },
    {
        title: "MariaDB Galera Cluster",
        value: "mariadb-galera",
    },
    {
        title: "PostgreSQL",
        value: "postgres",
    },
    {
        title: "HAProxy",
        value: "haproxy",
    },
    {
        title: "MySQL",
        value: "mysql",
    },
    {
        title: "ProxySQL (MySQL/MariaDB Proxy)",
        value: "proxysql",
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
     * MaxScale proxy configuration (routers, monitors, admin API).
     * Only used when `type` is `"maxscale"`.
     */
    maxscale?: TCIConfigMaxScaleConfig;
    /**
     * HAProxy proxy configuration (frontends, backends, health checks, stats).
     * Only used when `type` is `"haproxy"`.
     */
    haproxy?: TCIConfigHAProxyConfig;
    /**
     * ProxySQL proxy configuration (hostgroups, query rules, monitor user).
     * Only used when `type` is `"proxysql"`.
     */
    proxysql?: TCIConfigProxySQLConfig;
    /**
     * MariaDB Galera cluster configuration (cluster name, SST method, databases).
     * Only used when `type` is `"mariadb-galera"`.
     */
    mariadb_galera?: TCIConfigMariadbGaleraConfig;
    /**
     * PostgreSQL server configuration (port, users, replication).
     * Only used when `type` is `"postgres"`.
     */
    postgres?: TCIConfigPostgresConfig;
    /**
     * MySQL server configuration (port, users, replication).
     * Only used when `type` is `"mysql"`.
     */
    mysql?: TCIConfigMysqlConfig;
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

// ---------------------------------------------------------------------------
// Database service types
// ---------------------------------------------------------------------------

/**
 * A database and optional user to create during service initialisation.
 * Used by `mariadb-galera`, `postgres`, and `mysql` service types.
 */
export type TCIConfigDatabaseSpec = {
    /** Database name to create. */
    name: string;
    /** Database user to create and grant privileges to this database. */
    user?: string;
    /** Password for the database user. */
    password?: string;
    /** Character set (e.g. `"utf8mb4"`). Only applies to MySQL/MariaDB. */
    charset?: string;
    /** Collation (e.g. `"utf8mb4_unicode_ci"`). Only applies to MySQL/MariaDB. */
    collation?: string;
};

// ---------------------------------------------------------------------------
// MaxScale
// ---------------------------------------------------------------------------

/**
 * A single backend server entry for a MaxScale proxy service.
 * Points to a `mariadb-galera` or `mysql` service in the same deployment.
 */
export type TCIConfigMaxScaleTarget = {
    /** Name of the service in the same deployment to route DB traffic to. */
    service_name: string;
    /** MySQL-protocol port the target service listens on (typically `3306`). */
    port: number;
    /** Relative weight for connection distribution. Higher values receive more connections. */
    weight?: number;
    /** If `true`, this target is used only when all non-backup servers are unavailable. */
    backup?: boolean;
};

/**
 * MaxScale proxy configuration.
 * MaxScale supports MySQL 5.5+ and all MariaDB versions including Galera clusters.
 * It does **not** support PostgreSQL.
 *
 * Only used when `type` is `"maxscale"`.
 */
export type TCIConfigMaxScaleConfig = {
    /**
     * Backend services MaxScale will route connections to.
     * Typically points to a `mariadb-galera` or `mysql` service.
     */
    target_services?: TCIConfigMaxScaleTarget[];
    /**
     * MySQL-protocol port MaxScale listens on for client connections.
     * Defaults to `3306`.
     */
    listen_port?: number;
    /**
     * MaxScale router module.
     * - `readwritesplit` — routes writes to primary, distributes reads across replicas (default)
     * - `readconnroute` — simple round-robin connection routing
     * - `schemarouter` — routes by schema name (sharding)
     */
    router?: "readwritesplit" | "readconnroute" | "schemarouter";
    /**
     * MaxScale monitor module.
     * - `galeramon` — for MariaDB Galera clusters (detects primary/donor/joiner state)
     * - `mariadbmon` — for MariaDB/MySQL primary-replica setups
     * - `mysqlmon` — legacy monitor for older MySQL setups
     */
    monitor?: "galeramon" | "mariadbmon" | "mysqlmon";
    /** Port for the MaxScale REST API and GUI. Defaults to `8989`. */
    admin_port?: number;
    /** MaxScale admin REST API username. Defaults to `"admin"`. */
    admin_user?: string;
    /** MaxScale admin REST API password. */
    admin_password?: string;
    /**
     * Database user MaxScale uses for monitoring and service authentication.
     * This user must have `REPLICATION CLIENT`, `SHOW DATABASES`, and `SELECT` privileges.
     */
    user?: string;
    /** Password for the MaxScale database user. */
    password?: string;
};

// ---------------------------------------------------------------------------
// HAProxy
// ---------------------------------------------------------------------------

/**
 * Health check configuration for an HAProxy backend server.
 * HAProxy supports protocol-aware checks for common databases.
 */
export type TCIConfigHAProxyCheck = {
    /**
     * Health check protocol.
     * - `tcp` — basic TCP connection check (works for any service)
     * - `http` — HTTP request check
     * - `mysql` — MySQL/MariaDB protocol handshake check
     * - `pgsql` — PostgreSQL startup message check
     * - `redis` — Redis PING check
     */
    type?: "tcp" | "http" | "mysql" | "pgsql" | "redis";
    /**
     * Time between health checks (e.g. `"2s"`, `"500ms"`).
     * Defaults to `"2s"`.
     */
    interval?: string;
    /** Number of consecutive successes required to mark a server UP. Defaults to `2`. */
    rise?: number;
    /** Number of consecutive failures required to mark a server DOWN. Defaults to `3`. */
    fall?: number;
};

/**
 * A single backend server entry for an HAProxy service.
 * HAProxy is a generic TCP/HTTP proxy and can route to any service type.
 */
export type TCIConfigHAProxyTarget = {
    /** Name of the service in the same deployment to proxy traffic to. */
    service_name: string;
    /** Port the target service listens on. */
    port: number;
    /** Relative weight for load distribution. */
    weight?: number;
    /** If `true`, this server is only used when all non-backup servers are down. */
    backup?: boolean;
    /** Health check settings for this backend server. */
    check?: TCIConfigHAProxyCheck;
};

/**
 * HAProxy proxy configuration.
 * HAProxy is a generic TCP/HTTP proxy. Unlike MaxScale or ProxySQL, it works
 * across database types — PostgreSQL, MySQL, MariaDB, Redis, MongoDB, and any
 * other TCP service. It does not parse or modify the database protocol.
 *
 * Only used when `type` is `"haproxy"`.
 */
export type TCIConfigHAProxyConfig = {
    /**
     * Backend services HAProxy will proxy traffic to.
     * Accepts any service type (postgres, mysql, mariadb-galera, etc.).
     */
    target_services?: TCIConfigHAProxyTarget[];
    /**
     * Port HAProxy's frontend listens on for client connections.
     * Defaults to `5432` for postgres mode, `3306` for mysql mode.
     */
    listen_port?: number;
    /**
     * Proxy mode.
     * - `tcp` — layer-4 pass-through, required for databases (default)
     * - `http` — layer-7 HTTP proxy with header inspection
     */
    mode?: "tcp" | "http";
    /**
     * Load balancing algorithm.
     * - `roundrobin` — each server in turn (default)
     * - `leastconn` — server with fewest active connections (best for databases)
     * - `first` — first available server (useful for active/passive failover)
     * - `source` — sticky sessions based on client IP
     */
    balance?: "roundrobin" | "leastconn" | "first" | "source";
    /** Port for the HAProxy statistics web page. Defaults to `8404`. */
    stats_port?: number;
    /** Username for the HAProxy statistics page. */
    stats_user?: string;
    /** Password for the HAProxy statistics page. */
    stats_password?: string;
    /** TCP connection timeout (e.g. `"5s"`). Defaults to `"5s"`. */
    timeout_connect?: string;
    /** Client inactivity timeout (e.g. `"30s"`). Defaults to `"30s"`. */
    timeout_client?: string;
    /** Server response timeout (e.g. `"30s"`). Defaults to `"30s"`. */
    timeout_server?: string;
};

// ---------------------------------------------------------------------------
// MariaDB Galera
// ---------------------------------------------------------------------------

/**
 * MariaDB Galera cluster configuration.
 * Galera provides synchronous multi-primary replication. A minimum of 3 nodes
 * is required for quorum. Pair with a `maxscale` or `haproxy` service for
 * client-facing load balancing and read/write splitting.
 *
 * Only used when `type` is `"mariadb-galera"`.
 */
export type TCIConfigMariadbGaleraConfig = {
    /**
     * `wsrep_cluster_name` — shared identifier all Galera nodes must agree on.
     * Defaults to `"turboci_galera_cluster"`.
     */
    cluster_name?: string;
    /**
     * State Snapshot Transfer method used when a new node joins the cluster.
     * - `mariabackup` — hot backup via MariaDB Backup (recommended, no locks)
     * - `rsync` — rsync-based full copy (simple, blocks writes during transfer)
     * - `xtrabackup-v2` — Percona XtraBackup (for MySQL-based setups)
     */
    sst_method?: "mariabackup" | "rsync" | "xtrabackup-v2";
    /** MariaDB root user password. */
    root_password?: string;
    /** MySQL-protocol port the cluster nodes listen on. Defaults to `3306`. */
    port?: number;
    /** Databases and users to create after cluster bootstrap. */
    databases?: TCIConfigDatabaseSpec[];
    /**
     * Address to bind the MySQL listener to.
     * Use `"0.0.0.0"` to accept connections from all interfaces (required for
     * MaxScale or HAProxy to reach private cluster IPs). Defaults to `"0.0.0.0"`.
     */
    bind_address?: string;
};

// ---------------------------------------------------------------------------
// PostgreSQL
// ---------------------------------------------------------------------------

/**
 * Streaming replication configuration for PostgreSQL.
 * When enabled, non-primary instances are configured as hot standbys.
 */
export type TCIConfigPostgresReplication = {
    /** Enable streaming replication. Defaults to `false`. */
    enabled?: boolean;
    /** Replication user created on the primary. Defaults to `"replicator"`. */
    user?: string;
    /** Password for the replication user. */
    password?: string;
    /**
     * Maximum number of concurrent WAL sender processes.
     * Should be ≥ the number of replica instances. Defaults to `5`.
     */
    max_wal_senders?: number;
};

/**
 * PostgreSQL server configuration.
 * Pair with a `haproxy` service for client-side load balancing; HAProxy supports
 * a native `pgsql` health check. ProxySQL and MaxScale do **not** support PostgreSQL.
 *
 * Only used when `type` is `"postgres"`.
 */
export type TCIConfigPostgresConfig = {
    /** Port PostgreSQL listens on. Defaults to `5432`. */
    port?: number;
    /** Password for the `postgres` superuser. */
    root_password?: string;
    /** Databases and users to create after initialisation. */
    databases?: TCIConfigDatabaseSpec[];
    /**
     * Maximum number of client connections. Defaults to `100`.
     * Increase when using a connection pooler like PgBouncer or HAProxy.
     */
    max_connections?: number;
    /**
     * Shared memory buffer size (e.g. `"256MB"`, `"1GB"`).
     * Rule of thumb: set to 25% of available RAM. Defaults to `"128MB"`.
     */
    shared_buffers?: string;
    /**
     * Interfaces PostgreSQL listens on.
     * Use `"*"` to accept connections from all interfaces (required for HAProxy
     * to reach private server IPs). Defaults to `"localhost"`.
     */
    listen_addresses?: string;
    /** Streaming replication configuration. */
    replication?: TCIConfigPostgresReplication;
};

// ---------------------------------------------------------------------------
// MySQL
// ---------------------------------------------------------------------------

/**
 * MySQL replication configuration.
 * When enabled, non-primary instances are set up as asynchronous replicas.
 */
export type TCIConfigMysqlReplication = {
    /** Enable MySQL binary-log replication. Defaults to `false`. */
    enabled?: boolean;
    /** Replication user created on the primary. Defaults to `"replicator"`. */
    user?: string;
    /** Password for the replication user. */
    password?: string;
    /**
     * Unique numeric server identifier required for replication.
     * Must be distinct across all nodes. The primary is typically `1`;
     * replicas auto-assign from `2` upward if not specified.
     */
    server_id?: number;
};

/**
 * MySQL server configuration.
 * Pair with a `proxysql` service for query routing and read/write splitting,
 * or with `haproxy` for simple TCP load balancing. MaxScale also supports MySQL 5.5+.
 *
 * Only used when `type` is `"mysql"`.
 */
export type TCIConfigMysqlConfig = {
    /** MySQL port. Defaults to `3306`. */
    port?: number;
    /** MySQL root user password. */
    root_password?: string;
    /** Databases and users to create after initialisation. */
    databases?: TCIConfigDatabaseSpec[];
    /**
     * Address MySQL binds to.
     * Use `"0.0.0.0"` to accept connections from all interfaces (required for
     * ProxySQL or HAProxy to reach private server IPs). Defaults to `"0.0.0.0"`.
     */
    bind_address?: string;
    /** Maximum number of simultaneous client connections. Defaults to `151`. */
    max_connections?: number;
    /** Replication configuration. */
    replication?: TCIConfigMysqlReplication;
};

// ---------------------------------------------------------------------------
// ProxySQL
// ---------------------------------------------------------------------------

/**
 * A query routing rule for ProxySQL.
 * Rules are evaluated in ascending `rule_id` order; the first matching rule wins.
 */
export type TCIConfigProxySQLQueryRule = {
    /**
     * Numeric rule identifier. Lower numbers are evaluated first.
     * Defaults to insertion order if omitted.
     */
    rule_id?: number;
    /**
     * Regular expression matched against the normalised query digest.
     * Example: `"^SELECT"` matches all SELECT statements.
     */
    match_digest?: string;
    /** Hostgroup to send matching queries to. */
    destination_hostgroup?: number;
    /**
     * If `true`, stop evaluating further rules once this rule matches.
     * Defaults to `true`.
     */
    apply?: boolean;
    /** Human-readable annotation stored in the ProxySQL rule table. */
    comment?: string;
};

/**
 * A single backend server entry for a ProxySQL service.
 * Maps to one `mysql_servers` row in the ProxySQL admin database.
 */
export type TCIConfigProxySQLTarget = {
    /** Name of the service in the same deployment to route traffic to. */
    service_name: string;
    /** MySQL-protocol port the target service listens on (typically `3306`). */
    port: number;
    /** Relative connection weight within the hostgroup. */
    weight?: number;
    /** If `true`, this server is placed in the OFFLINE_SOFT state initially. */
    backup?: boolean;
    /**
     * ProxySQL hostgroup ID. Use separate hostgroups for writers and readers
     * (e.g. writers: `10`, readers: `20`) to enable read/write splitting via query rules.
     * Defaults to `0`.
     */
    hostgroup?: number;
    /** Maximum number of connections ProxySQL will open to this backend server. */
    max_connections?: number;
};

/**
 * ProxySQL connection proxy configuration.
 * ProxySQL supports MySQL 5.5+ and MariaDB 5.5+ for query routing, read/write
 * splitting, connection multiplexing, and query caching.
 * It does **not** support PostgreSQL — use HAProxy for PostgreSQL proxying.
 *
 * Only used when `type` is `"proxysql"`.
 */
export type TCIConfigProxySQLConfig = {
    /**
     * Backend services ProxySQL will route connections to.
     * Typically points to a `mysql` service. Use different `hostgroup` values
     * on target entries to separate writer and reader pools.
     */
    target_services?: TCIConfigProxySQLTarget[];
    /**
     * MySQL-protocol port clients connect to on ProxySQL.
     * Defaults to `6033`.
     */
    listen_port?: number;
    /**
     * ProxySQL admin interface port (MySQL protocol, admin credentials required).
     * Defaults to `6032`.
     */
    admin_port?: number;
    /** ProxySQL admin username. Defaults to `"admin"`. */
    admin_user?: string;
    /** ProxySQL admin password. */
    admin_password?: string;
    /**
     * MySQL user ProxySQL uses to monitor backend health via `SELECT 1` queries.
     * This user needs `USAGE` privilege on the backend servers.
     */
    monitor_user?: string;
    /** Password for the ProxySQL monitor user. */
    monitor_password?: string;
    /**
     * Hostgroup ID for write traffic (INSERT, UPDATE, DELETE, DDL).
     * Defaults to `10`.
     */
    writer_hostgroup?: number;
    /**
     * Hostgroup ID for read traffic (SELECT).
     * Defaults to `20`.
     */
    reader_hostgroup?: number;
    /**
     * Query routing rules evaluated against incoming query digests.
     * Rules are applied in ascending `rule_id` order.
     */
    query_rules?: TCIConfigProxySQLQueryRule[];
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
    match: string;
    /**
     * Path to target on the upstream. If left empty, the default path
     * will be used.
     */
    target_path?: string;
    /**
     * Port on the target upstream to target. Default port is the one
     * set on the parent `target_services` onject.
     */
    target_port?: number;
    /**
     * Rate limiting applied to this location.
     */
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
     * If `true`, the upstream `proxy_pass` block is omitted for this location.
     * Use when serving static files, issuing redirects, or returning custom
     * responses. Defaults to `false`.
     */
    no_proxy?: boolean;
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
    /**
     * Custom NGINX `location` block added to the base("/") location
     */
    target_location?: TCIConfigLBLocation;
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
