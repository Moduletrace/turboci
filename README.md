# TurboCI

A simple yet powerful cloud deployment CLI tool that scales.

`current version: 1.1.0`

TurboCI is a configuration-driven infrastructure orchestrator for deploying and managing multi-cloud server stacks. It handles server provisioning, SSH key management, private networking, load balancing, file synchronization, dependency installation, and rolling zero-downtime deployments — all from a single YAML file.

Every deployment includes a **relay server** that runs two persistent admin processes: a **web admin panel** for managing services and users, and a **cron-based auto-healing daemon** that continuously monitors every service against its healthcheck and automatically restarts failing servers.

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Commands](#commands)
    - [turboci up](#turboci-up)
    - [turboci down](#turboci-down)
    - [turboci init](#turboci-init)
    - [turboci control](#turboci-control)
    - [turboci spec](#turboci-spec)
- [How It Works](#how-it-works)
    - [Relay Server](#relay-server)
    - [Admin Panel](#admin-panel)
    - [Auto-Healing](#auto-healing)
    - [Private Network](#private-network)
    - [SSH Key Management](#ssh-key-management)
    - [Firewalls](#firewalls)
    - [Deployment Phases](#deployment-phases)
    - [Rolling Updates & Zero Downtime](#rolling-updates--zero-downtime)
- [Configuration](#configuration)
    - [File Location](#file-location)
    - [Deployment Fields](#deployment-fields)
    - [Service Config Fields](#service-config-fields)
    - [dir_mappings](#dir_mappings)
    - [dependencies](#dependencies)
    - [env & env_file](#env--env_file)
    - [run](#run)
    - [healthcheck](#healthcheck)
    - [init](#init)
    - [logs](#logs)
    - [target_services (Load Balancer)](#target_services-load-balancer)
    - [ssl](#ssl)
    - [Deployment Duplication](#deployment-duplication)
    - [Service Duplication](#service-duplication)
    - [pre_deployment](#pre_deployment)
    - [TypeScript Config Format](#typescript-config-format)
    - [Full Type Reference](#full-type-reference)
- [Example Configurations](#example-configurations)
    - [Simple Single Service](#simple-single-service)
    - [High Availability with Load Balancer](#high-availability-with-load-balancer)
    - [Multi-Cloud Deployment](#multi-cloud-deployment)
    - [SSL with Custom Domains](#ssl-with-custom-domains)
- [Cloud Providers](#cloud-providers)
    - [Hetzner](#hetzner)
    - [AWS](#aws)
    - [GCP](#gcp)
    - [Azure](#azure)
- [Project Structure](#project-structure)

---

## Installation

Download the latest binary from the [GitHub Releases page](https://github.com/Moduletrace/turboci/releases/latest).

The standalone binary has no runtime dependencies — Node.js or Bun are not required.

```bash
# Download the latest binary
curl -L https://github.com/Moduletrace/turboci/releases/latest/download/turboci -o turboci

# Make it executable and move to PATH
chmod +x ./turboci
sudo mv ./turboci /usr/local/bin/turboci

# Verify
turboci --version
```

### Building from Source

If you have Bun installed, you can build TurboCI from source:

```bash
# Install dependencies
bun install

# Build standalone binary (~100MB, no dependencies needed)
bun run compile

# Build JS file (~1MB, requires Node.js)
bun run build

# Build both
bun run build:all
```

---

## Quick Start

**1. Set up your API keys** (see [Environment Variables](#environment-variables)):

```bash
export TURBOCI_HETZNER_API_KEY=your-hetzner-api-key
```

**2. Create a config file** at `.turboci/config.yaml` in your project root, or run the interactive wizard:

```bash
turboci init
```

**3. Deploy your stack:**

```bash
turboci up
```

That's it. TurboCI will provision servers, configure networking, sync your code, install dependencies, and start your application.

---

## Environment Variables

TurboCI reads cloud provider credentials from environment variables or a `.env` file in your working directory.

### Cloud Provider Keys

| Variable                                  | Provider | Description                     |
| ----------------------------------------- | -------- | ------------------------------- |
| `TURBOCI_HETZNER_API_KEY`                 | Hetzner  | Hetzner Cloud API token         |
| `TURBOCI_AWS_ACCESS_KEY`                  | AWS      | AWS access key ID               |
| `TURBOCI_AWS_SECRET_ACCESS_KEY`           | AWS      | AWS secret access key           |
| `TURBOCI_GCP_PROJECT_ID`                  | GCP      | Google Cloud project ID         |
| `TURBOCI_GCP_SERVICE_ACCOUNT_EMAIL`       | GCP      | GCP service account email       |
| `TURBOCI_GCP_SERVICE_ACCOUNT_PRIVATE_KEY` | GCP      | GCP service account private key |
| `TURBOCI_AZURE_API_KEY`                   | Azure    | Azure API key                   |

### Optional Variables

| Variable      | Description                                                                        |
| ------------- | ---------------------------------------------------------------------------------- |
| `TURBOCI_DIR` | Path to the `.turboci` directory. Defaults to `.turboci` in the working directory. |

Place these in a `.env` file in your project root, or export them in your shell before running TurboCI.

---

## Commands

### `turboci up`

Deploy or update a stack using the configuration found in `.turboci/config.yaml`. If no configuration exists, it automatically runs `turboci init`.

```bash
turboci up
```

#### Flags

| Flag       | Alias | Description                                     |
| ---------- | ----- | ----------------------------------------------- |
| `--target` | `-t`  | Only deploy the specified service(s)            |
| `--skip`   | `-s`  | Deploy all services except the specified one(s) |

#### Targeting Specific Services

Target a single service in a deployment:

```bash
turboci up -t deployment_name.service_name
```

Target multiple specific services:

```bash
turboci up -t deployment_name.web -t deployment_name.api
```

Target all services in a deployment using the wildcard `*`:

```bash
turboci up -t "deployment_name.*"
```

Target a service across all deployments (omit the deployment name):

```bash
turboci up -t web
```

#### Skipping Services

Skip a specific service and deploy everything else:

```bash
turboci up -s deployment_name.service_name
```

Skip all services but still run default infrastructure setup (networks, SSH keys, relay server, firewalls):

```bash
turboci up -s "*.*"
```

---

### `turboci down`

Tear down and delete all cloud resources for a deployment. This is irreversible and will terminate all servers, remove networks, delete firewalls, and clean up SSH keys.

```bash
turboci down
```

Also accepts the `-t` (target) and `-s` (skip) flags, but only at the **deployment level** (not service level):

```bash
turboci down -t deployment_name
```

> **Note:** To remove a single service without taking down the whole deployment, simply delete or comment out the service block in your config and run `turboci up`. TurboCI will detect the missing service and terminate its servers automatically.

Teardown order:

1. Service servers
2. Relay server
3. Firewalls
4. Private network
5. SSH keys
6. Active config file (`.turboci/active.yaml`)

---

### `turboci init`

Bootstrap a new configuration interactively, or edit an existing one. Guides you through setting up deployments, services, providers, and all configuration options via prompts.

```bash
turboci init
```

Creates `.turboci/config.yaml` (or `config.ts` for TypeScript format) in your working directory.

---

### `turboci control`

An interactive management interface for active deployments. Use this to inspect running infrastructure and gain SSH terminal access to servers.

```bash
turboci control
```

---

### `turboci spec`

View available server specifications for each cloud provider, including locations, server types, and OS options.

```bash
turboci spec
```

### `turboci info`

Get information about your current deployment.

```bash
turboci info
```

---

## How It Works

### Relay Server

Every deployment gets a dedicated **relay server** (also called the control plane). The relay server is the backbone of TurboCI's architecture:

- **Public entry point:** The only server in a deployment with a public IP address exposed externally. Only port 22 (SSH) is open.
- **NAT gateway:** Routes internet traffic for private servers that have no public IP. Essential for providers without a managed NAT solution (e.g., Hetzner).
- **Distribution hub:** When syncing files or running commands across many servers, TurboCI first pushes to the relay server, then fans out from the relay to all target servers in parallel. This minimizes local bandwidth and speeds up large-scale deploys.
- **State store:** Holds deployment metadata, SSH configuration, and the active config.
- **Admin plane:** Runs the web admin panel and the auto-healing cron process as persistent services.

The relay server is automatically created on first deploy and reused on subsequent runs.

After a successful `turboci up`, the CLI prints the relay server IP and the SSH tunnel command needed to access the admin panel:

```
 - Relay Server IP address:
   - 1.2.3.4
   - Connect to the Admin Panel:
     - ssh -N -L 3772:localhost:80 -i .turboci/.ssh/id_rsa root@1.2.3.4
   - Connect to the Relay Server via SSH:
     - ssh -i .turboci/.ssh/id_rsa root@1.2.3.4
```

### Admin Panel

The relay server runs a **web admin panel** that lets you manage your entire deployment from a browser. It is exposed through NGINX on the relay and is **not publicly accessible** — access is gated behind an SSH tunnel.

**Accessing the admin panel:**

1. Establish an SSH tunnel to the relay server:

    ```bash
    ssh -N -L 3772:localhost:80 -i .turboci/.ssh/id_rsa root@<relay-server-ip>
    ```

2. Open `http://localhost:3772` in your browser.

**What the admin panel provides:**

- **Service management** — View the status of all services and servers in the deployment, trigger restarts, and inspect logs.
- **User management** — Create and manage external users who can access the admin panel. External users authenticate through the panel rather than SSH.
- **Terminal access** — Open a browser-based terminal into any server in the deployment (powered by `ttyd`, proxied via NGINX at `/ttyd/<port>`).

**Technical details:**

| Component       | Port    | NGINX path     |
| --------------- | ------- | -------------- |
| Web UI (HTTP)   | 3772    | `/`            |
| WebSocket       | 3773    | `/ws`          |
| Terminal (ttyd) | dynamic | `/ttyd/<port>` |

The admin panel process is managed by PM2 and starts automatically during relay initialization. Its database is encrypted at rest using a randomly generated 32-character password and 16-character salt, both unique per deployment.

### Auto-Healing

The relay server runs a **cron-based auto-healing daemon** alongside the admin panel. This process continuously monitors the health of every service in the deployment and automatically recovers failing servers.

**How it works:**

1. On a recurring schedule, the daemon runs the configured `healthcheck` for each service against every server in the deployment.
2. If a server fails its healthcheck, the daemon re-runs the full three-stage recovery sequence on that server:
    - `preflight` commands (reinstall, rebuild, migrate, etc.)
    - `start` commands (restart the application)
    - `postflight` commands (verification, reloads)
3. After the recovery sequence completes, the healthcheck is run again to confirm the server is back online.

**Result:** Servers that crash, run out of memory, or encounter transient errors are automatically brought back to a healthy state without any manual intervention.

> The auto-healing daemon uses the same `healthcheck`, `run.preflight`, `run.start`, and `run.postflight` configuration defined in your `config.yaml`. No additional configuration is required to enable it.

### Private Network

Every deployment gets its own **private network**. All servers in the deployment communicate over this network using private IP addresses. Services without `enable_public_ip: true` are completely isolated from the public internet, accessible only through the relay server or load balancer.

### SSH Key Management

TurboCI automatically generates an SSH key pair for each project and registers the public key with your cloud provider. The private key is stored at `.turboci/.ssh/`. This key is used for all SSH operations and can be used to manually connect to the relay server:

```bash
ssh -i .turboci/.ssh/id_rsa root@<relay-server-ip>
```

### Firewalls

TurboCI automatically creates two firewall rules per deployment:

1. **SSH firewall** — Allows inbound traffic on port 22 only. Applied to all servers.
2. **HTTP firewall** — Allows inbound traffic on ports 80 and 443. Applied to load balancer servers.

All other inbound traffic is blocked by default.

### Deployment Phases

When you run `turboci up`, each service goes through three phases in order:

#### Phase 1: Setup

Provider-specific infrastructure is provisioned:

- Private network is created (if not already present)
- SSH keys are registered (if not already present)
- Firewall rules are created (if not already present)
- Servers are provisioned to match the desired count (`instances × clusters`)
- Excess servers are terminated if scaling down
- Servers are attached to the private network and firewalls

#### Phase 2: Prepare

Each server is prepared for the application:

1. SSH connectivity is verified (polls until the server is ready)
2. Source code / directories are synced via rsync (local → relay → servers in parallel)
3. APT packages are installed (`dependencies.apt`)
4. TurboCI-managed runtimes are installed (`dependencies.turboci`: docker, bun, node)
5. Environment variables are exported to the shell

#### Phase 3: Run

The application is started on each server (one cluster at a time):

1. **Preflight** commands run (builds, installs, migrations, etc.)
2. **Start** commands run (application startup)
3. **Postflight** commands run (verification, process listing, etc.)
4. **Healthcheck** is executed to confirm the service is healthy
5. The load balancer upstream is updated to include the newly started cluster

### Rolling Updates & Zero Downtime

TurboCI deploys clusters sequentially, one at a time. For a service with `instances: 2` and `clusters: 3` (6 total servers):

```
Cluster 1 (servers 1-2) → deployed and healthy → LB updated
Cluster 2 (servers 3-4) → deployed and healthy → LB updated
Cluster 3 (servers 5-6) → deployed and healthy → LB updated
```

At every step, at least one cluster remains live and serving traffic. This gives you **zero-downtime rolling deployments** out of the box.

---

## Configuration

### File Location

TurboCI looks for its configuration in the `.turboci/` directory relative to where the command is run. The directory structure is:

```
.turboci/
├── config.yaml        # Main configuration file (or config.ts)
├── active.yaml        # Auto-generated: current active deployment state
├── .ssh/              # Auto-generated: SSH keys
│   ├── id_rsa
│   └── id_rsa.pub
└── .config/           # Auto-generated: server-side config storage
```

The directory can be relocated using the `TURBOCI_DIR` environment variable.

TurboCI also automatically detects `turboci.ignore` files in any directory being synced and uses them to exclude patterns (similar to `.gitignore`).

---

### Deployment Fields

`config.yaml` is an array of deployment objects. Each object represents a full infrastructure stack on one cloud provider.

#### `deployment_name` string — _Required_

A unique name for the deployment. Must contain only lowercase letters and underscores.

```yaml
deployment_name: my_production_stack
```

#### `provider` string — _Required_

The cloud provider to deploy to. Accepted values: `hetzner`, `aws`, `gcp`, `azure`.

```yaml
provider: hetzner
```

#### `location` string

The data center region for the deployment. Available locations depend on the provider. Use `turboci spec` to list available options.

```yaml
location: ash # Ashburn, USA (Hetzner)
```

#### `availability_zone` string

For providers that support availability zones (e.g., AWS), specify the zone within the region.

```yaml
availability_zone: us-east-1a
```

#### `description` string

An optional human-readable description for the deployment.

```yaml
description: Production stack for my-app on Hetzner
```

#### `duplicate_deployment_name` string

Clone the full configuration of another deployment. All fields from the source are imported, and any fields specified in this deployment override the inherited values. Useful for multi-cloud or multi-environment setups.

```yaml
- deployment_name: my_app_aws
  duplicate_deployment_name: my_app_hetzner
  provider: aws
  location: us-east-1
```

#### `env` object

Key-value environment variables applied to all services in the deployment. These are exported before any commands run on the servers.

```yaml
env:
    NODE_ENV: production
    DATABASE_URL: postgres://...
```

#### `env_file` string

Path to a `.env` file to load environment variables from, relative to the working directory.

```yaml
env_file: ./secrets/prod.env
```

#### `pre_deployment` object

Commands to run locally before the deployment begins (on your machine, not the server). Useful for local build steps.

```yaml
pre_deployment:
    work_dir: .
    cmds:
        - npm run build
        - docker build -t my-app .
```

#### `relay_server_options` object

Options for the relay server provisioned for this deployment.

```yaml
relay_server_options:
    server_type: cpx21
```

| Field         | Type   | Description                                                        |
| ------------- | ------ | ------------------------------------------------------------------ |
| `server_type` | string | Machine type for the relay server. Defaults to provider base tier. |

#### `services` object — _Required_

A map of service names to service configurations. See [Service Config Fields](#service-config-fields).

---

### Service Config Fields

A **service** is a group of servers that all share the same configuration. Service names must be unique within a deployment.

#### `type` string

The service type. Defaults to `default`.

| Value           | Description                                                       |
| --------------- | ----------------------------------------------------------------- |
| `default`       | A standard server running your chosen OS                          |
| `docker`        | A server with Docker pre-installed and configured                 |
| `load_balancer` | A server with NGINX configured as a reverse proxy / load balancer |

```yaml
type: load_balancer
```

#### `os` string

The operating system image. Defaults to Debian 12 for Hetzner, or an equivalent for other providers. Use `turboci spec` to see available options.

| Value           | OS                 |
| --------------- | ------------------ |
| `debian_12`     | Debian 12 Bookworm |
| `debian_13`     | Debian 13 Trixie   |
| `ubuntu_23_0_4` | Ubuntu 23.04       |

```yaml
os: debian_12
```

#### `server_type` string

The machine type/size as defined by the cloud provider. Defaults to `cpx11` on Hetzner, or equivalent base tier on other providers. Use `turboci spec` to see available types.

```yaml
server_type: cpx21
```

#### `enable_public_ip` boolean

Whether servers in this service get a public IP address. Defaults to `false` for all service types except `load_balancer`, which always gets a public IP.

```yaml
enable_public_ip: true
```

#### `instances` number

The number of servers within each cluster. Defaults to `1`.

```yaml
instances: 2
```

#### `clusters` number

The number of clusters in the service. Clusters are deployed and updated one at a time, enabling zero-downtime rolling updates. The total server count is `instances × clusters`. Defaults to `1`.

```yaml
clusters: 3
```

> With `instances: 2` and `clusters: 3`, TurboCI creates 6 servers and deploys them in 3 batches of 2.

#### `duplicate_service_name` string

Clone the configuration of another service within the same deployment. All fields are inherited and can be selectively overridden.

```yaml
services:
    web_prod:
        instances: 3
        server_type: cpx31
        # ... full config ...
    web_staging:
        duplicate_service_name: web_prod
        instances: 1
        server_type: cpx11
```

---

### `dir_mappings`

An array of directory or file mappings to sync from your local machine to the servers.

```yaml
dir_mappings:
    - src: .
      dst: /app
    - src: ./secrets/prod.env
      dst: /app/.env
```

Sync uses `rsync` under the hood, routed through the relay server for efficiency.

| Field             | Type     | Description                                                      |
| ----------------- | -------- | ---------------------------------------------------------------- |
| `src`             | string   | Local source path (file or directory)                            |
| `dst`             | string   | Remote destination path on the server                            |
| `ignore_file`     | string   | Path to a file containing rsync-style ignore patterns            |
| `ignore_patterns` | string[] | Array of patterns to exclude during sync                         |
| `use_gitignore`   | boolean  | Whether to apply the project's `.gitignore` patterns during sync |
| `relay_ignore`    | string[] | Patterns to ignore when syncing from relay → target servers only |

**Automatic ignore file:** If a file named `turboci.ignore` exists in the directory being synced, TurboCI automatically uses its patterns for the local → relay sync step.

**`relay_ignore` note:** When syncing from relay to servers, TurboCI uses the `--delete` flag to keep directories in sync. If a server creates a file not present in the relay directory, it will be deleted on the next sync. Add those paths to `relay_ignore` to preserve them.

---

### `dependencies`

Packages and runtimes to install on the servers before running your application.

```yaml
dependencies:
    apt:
        - rsync
        - git
        - curl
        - neofetch
    turboci:
        - bun
        - node
        - docker
```

| Key       | Description                                                                    |
| --------- | ------------------------------------------------------------------------------ |
| `apt`     | Debian APT packages, installed via `apt-get install`                           |
| `turboci` | Cross-platform runtimes managed by TurboCI. Supported: `docker`, `bun`, `node` |

---

### `env` & `env_file`

Environment variables to export on the server before any commands run. These can be defined at the **deployment level** (applies to all services) or at the **service level** (applies to this service only).

```yaml
# Service-level env object (key-value map)
env:
    NODE_ENV: production
    PORT: "3000"
    API_URL: https://api.example.com

# Or load from a file
env_file: ./secrets/prod.env
```

---

### `run`

Defines the commands to execute on servers once they are set up. Split into three stages:

```yaml
run:
    preflight:
        work_dir: /app
        cmds:
            - bun add -g pm2
            - pm2 kill
            - bun install
            - bunx next build
    start:
        work_dir: /app
        cmds:
            - pm2 start "bunx next start"
            - pm2 start "bun websocket.ts"
    postflight:
        work_dir: /app
        cmds:
            - pm2 list
            - nginx -s reload
```

| Stage        | Description                                                                           |
| ------------ | ------------------------------------------------------------------------------------- |
| `preflight`  | Runs before the application starts. Use for installs, builds, migrations, etc.        |
| `start`      | Starts the application. These commands are expected to launch long-running processes. |
| `postflight` | Runs after the application starts. Use for verification, reloads, or notifications.   |

Each stage supports:

| Field      | Type     | Description                                                     |
| ---------- | -------- | --------------------------------------------------------------- |
| `cmds`     | string[] | Commands to run, in order                                       |
| `work_dir` | string   | Working directory for the commands                              |
| `file`     | string   | Path to a shell script file to execute instead of inline `cmds` |

A top-level `work_dir` on the `run` object applies to all stages unless overridden per-stage.

**Shell script files:** Instead of inline `cmds`, you can point to shell scripts:

```yaml
run:
    preflight:
        file: ./turboci.preflight.sh
    start:
        file: ./turboci.start.sh
    postflight:
        file: ./turboci.postflight.sh
```

TurboCI also automatically detects and uses these default filenames if they exist in the project root.

---

### `healthcheck`

A healthcheck to verify the service is running correctly after startup. TurboCI runs the check up to **5 times with 5-second delays** between attempts. If it never passes, the deployment is marked as failed.

```yaml
healthcheck:
    cmd: curl http://localhost:3000/api/healthcheck
    test: "Server Running"
```

| Field  | Type   | Description                                                                  |
| ------ | ------ | ---------------------------------------------------------------------------- |
| `cmd`  | string | Command to execute on the server (can be any shell command, not just `curl`) |
| `test` | string | A string that must appear in the command's output for the check to pass      |

---

### `init`

Init is an array of commands to be run on first initialization

```yaml
init:
    - cp /setup/init.sh /usr/local/bin/init
    - chmod +x /usr/local/bin/init
    - init
```

---

### `logs`

An array of commands used to stream or collect logs from the service. Each entry can be a plain string or an object with a `cmd` key.

```yaml
logs:
    - journalctl -u myapp -f
    - cmd: tail -f /var/log/myapp/error.log
```

Each entry is either:

- A **string** — the shell command to run
- An **object** with a `cmd` field — equivalent to the string form, useful when you need to add future per-entry options

---

### `target_services` (Load Balancer)

Only used when `type: load_balancer`. Defines the upstream services that the NGINX load balancer will proxy traffic to.

```yaml
services:
    load_balancer:
        type: load_balancer
        target_services:
            - service_name: web_prod
              port: 3000
            - service_name: web_dev
              port: 5813
            - service_name: web_example
              port: 3000
              weight: 2
              backup: false
              domains:
                  - example.com
                  - www.example.com
            - service_name: web_dev_example
              port: 5813
              domains:
                  - domain_name: dev.example.com
```

| Field          | Type                 | Description                                                                                                                                                                             |
| -------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `service_name` | string               | Name of the service to load balance                                                                                                                                                     |
| `port`         | number               | Port that the upstream service is listening on. Defaults to `80`.                                                                                                                       |
| `weight`       | number               | NGINX upstream weight. Higher values send more requests to this service.                                                                                                                |
| `backup`       | boolean              | Mark this upstream as a backup (only used when primary servers are unavailable)                                                                                                         |
| `domains`      | string[] or object[] | Domains to route to this service. When set, NGINX is configured to route requests for these domains to this upstream. Domains can be plain strings or objects with a `domain_name` key. |

---

### `ssl`

SSL/TLS configuration for the load balancer service. TurboCI uses Let's Encrypt (Certbot) to automatically provision and renew certificates.

```yaml
ssl:
    email: admin@example.com
```

| Field   | Type   | Description                                                                     |
| ------- | ------ | ------------------------------------------------------------------------------- |
| `email` | string | Email address used for Let's Encrypt registration and certificate notifications |

SSL requires that your domains are already pointed at the load balancer's public IP address before `turboci up` runs.

---

### Deployment Duplication

Use `duplicate_deployment_name` to clone an existing deployment's configuration. This is ideal for:

- **Multi-cloud:** Same app deployed to Hetzner, AWS, and GCP simultaneously
- **Multi-region:** Same config deployed to multiple geographic regions
- **Multi-environment:** Production and staging sharing the same service definitions

```yaml
- deployment_name: my_app_hetzner
  provider: hetzner
  location: ash
  services:
      web:
          instances: 3
          server_type: cpx21
          # ... full service config ...

- deployment_name: my_app_aws
  provider: aws
  location: us-east-1
  duplicate_deployment_name: my_app_hetzner
  # All services from my_app_hetzner are inherited.
  # Provider and location are overridden above.

- deployment_name: my_app_staging
  provider: hetzner
  location: fsn1
  duplicate_deployment_name: my_app_hetzner
  services:
      web:
          instances: 1 # Override: fewer servers for staging
          server_type: cpx11
```

---

### Service Duplication

Within a single deployment, use `duplicate_service_name` to clone a service:

```yaml
services:
    web:
        instances: 2
        clusters: 2
        server_type: cpx21
        dir_mappings:
            - src: .
              dst: /app
        dependencies:
            turboci:
                - bun
        run:
            start:
                work_dir: /app
                cmds:
                    - pm2 start "bunx next start"

    web_secondary:
        duplicate_service_name: web
        instances: 1 # Override only instance count
```

---

### `pre_deployment`

Commands to run on your **local machine** before the deployment starts (not on the remote server). Use this for local build steps that must complete before code is synced to servers.

```yaml
pre_deployment:
    work_dir: ./frontend
    cmds:
        - bun install
        - bun run build
```

| Field      | Type     | Description                             |
| ---------- | -------- | --------------------------------------- |
| `cmds`     | string[] | Commands to run locally, in order       |
| `work_dir` | string   | Local working directory                 |
| `file`     | string   | Path to a local shell script to execute |

---

### TypeScript Config Format

As an alternative to `config.yaml`, you can write your configuration in TypeScript as `config.ts`. This gives you type safety, code reuse, and the full power of the language for building dynamic configurations.

The `TCIConfig` type accepts either a plain array of deployments or an object with a `deployments` key and an optional `envs` array of global environment strings.

**Array format (simple):**

```typescript
import type { TCIConfig } from "@moduletrace/turboci";

const config: TCIConfig = [
    {
        deployment_name: "my_app",
        provider: "hetzner",
        location: "ash",
        services: {
            web: {
                instances: 2,
                clusters: 2,
                server_type: "cpx21",
                dir_mappings: [{ src: ".", dst: "/app" }],
                dependencies: {
                    apt: ["rsync"],
                    turboci: ["bun"],
                },
                run: {
                    preflight: {
                        work_dir: "/app",
                        cmds: ["bun install", "bun run build"],
                    },
                    start: {
                        work_dir: "/app",
                        cmds: ['pm2 start "bunx next start"'],
                    },
                    postflight: {
                        cmds: ["pm2 list"],
                    },
                },
                healthcheck: {
                    cmd: "curl http://localhost:3000/api/healthcheck",
                    test: "Server Running",
                },
            },
            load_balancer: {
                type: "load_balancer",
                target_services: [{ service_name: "web", port: 3000 }],
            },
        },
    },
];

export default config;
```

**Object format (with global envs):**

```typescript
import type { TCIConfig } from "@moduletrace/turboci";

const config: TCIConfig = {
    envs: ["NODE_ENV=production", "REGION=us-east"],
    deployments: [
        {
            deployment_name: "my_app",
            provider: "hetzner",
            location: "ash",
            services: {
                web: {
                    instances: 2,
                    server_type: "cpx21",
                    dir_mappings: [{ src: ".", dst: "/app" }],
                    run: {
                        start: {
                            work_dir: "/app",
                            cmds: ['pm2 start "bun server.ts"'],
                        },
                    },
                },
            },
        },
    ],
};

export default config;
```

---

### Full Type Reference

```typescript
// Top-level export — use this type for your config file
type TCIConfig =
    | TCIConfigDeployment[]
    | {
          deployments: TCIConfigDeployment[];
          envs?: string[];
      };

type TCIConfigDeployment = {
    deployment_name: string;
    provider: "hetzner" | "aws" | "gcp" | "azure";
    location?: string;
    availability_zone?: string;
    description?: string;
    duplicate_deployment_name?: string;
    services: { [service_name: string]: TCIConfigServiceConfig };
    env?: { [key: string]: string };
    env_file?: string;
    pre_deployment?: TCIRunObj;
    relay_server_options?: TCIConfigRelayServerOptions;
};

type TCIConfigRelayServerOptions = {
    server_type?: string;
};

type TCIConfigServiceConfig = {
    type?: "default" | "docker" | "load_balancer";
    os?: string;
    server_type?: string;
    enable_public_ip?: boolean;
    instances?: number;
    clusters?: number;
    duplicate_service_name?: string;
    dir_mappings?: TCIConfigServiceConfigDirMapping[];
    dependencies?: {
        apt?: string[];
        turboci?: string[];
    };
    env?: { [key: string]: string };
    env_file?: string;
    target_services?: TCIConfigServiceConfigLBTarget[];
    run?: TCIConfigServiceConfigRun;
    ssl?: TCIConfigServiceSSL;
    healthcheck?: TCIConfigServiceHealthcheck;
    init?: string[];
};

type TCIConfigServiceConfigDirMapping = {
    src: string;
    dst: string;
    ignore_file?: string;
    ignore_patterns?: string[];
    use_gitignore?: boolean;
    relay_ignore?: string[];
};

type TCIConfigServiceConfigRun = {
    preflight?: TCIRunObj;
    start?: TCIRunObj;
    postflight?: TCIRunObj;
    work_dir?: string;
};

type TCIRunObj = {
    cmds?: string[];
    work_dir?: string;
    file?: string;
};

type TCIConfigServiceConfigLBTarget = {
    service_name: string;
    port: number;
    weight?: number;
    backup?: boolean;
    domains?: (string | { domain_name: string })[];
};

type TCIConfigServiceSSL = {
    email: string;
};

type TCIConfigServiceHealthcheck = {
    cmd: string;
    test: string;
};
```

---

## Example Configurations

### Simple Single Service

Deploy a Next.js app with PM2 to a single Hetzner server:

```yaml
- deployment_name: my_app
  provider: hetzner
  location: ash
  services:
      web:
          server_type: cpx21
          dir_mappings:
              - src: .
                dst: /app
          dependencies:
              apt:
                  - rsync
              turboci:
                  - bun
                  - node
          run:
              preflight:
                  work_dir: /app
                  cmds:
                      - bun add -g pm2
                      - bun install
                      - bunx next build
              start:
                  work_dir: /app
                  cmds:
                      - pm2 start "bunx next start"
              postflight:
                  cmds:
                      - pm2 list
          healthcheck:
              cmd: curl http://localhost:3000
              test: "200 OK"
      db:
          server_type: cpx21
          dir_mappings:
              - src: db-setup
                dst: /db-setup
          dependencies:
              apt:
                  - mariadb-server
          init:
              - cp /db-setup/init.sh /usr/local/bin/init
              - chmod +x /usr/local/bin/init
              - /init
```

### High Availability with Load Balancer

Deploy 4 servers (2 clusters × 2 instances) behind an NGINX load balancer. Clusters are updated one at a time for zero downtime:

```yaml
- deployment_name: my_app_prod
  provider: hetzner
  location: ash
  services:
      web:
          instances: 2
          clusters: 2
          server_type: cpx21
          dir_mappings:
              - src: .
                dst: /app
              - src: ./secrets/prod.env
                dst: /app/.env
          dependencies:
              apt:
                  - rsync
              turboci:
                  - bun
                  - node
          run:
              preflight:
                  work_dir: /app
                  cmds:
                      - bun add -g pm2
                      - pm2 kill
                      - bun install
                      - bunx next build
              start:
                  work_dir: /app
                  cmds:
                      - pm2 start "bunx next start"
              postflight:
                  cmds:
                      - pm2 list
          healthcheck:
              cmd: curl http://localhost:3000/api/healthcheck
              test: "Server Running"
      load_balancer:
          type: load_balancer
          target_services:
              - service_name: web
                port: 3000
```

### Multi-Cloud Deployment

Deploy the same app to both Hetzner and AWS simultaneously. The AWS deployment inherits all config from Hetzner and only overrides the provider and location:

```yaml
- deployment_name: my_app_hetzner
  provider: hetzner
  location: ash
  description: Hetzner production deployment
  services:
      web:
          instances: 2
          clusters: 2
          server_type: cpx21
          dir_mappings:
              - src: .
                dst: /app
          dependencies:
              turboci:
                  - bun
          run:
              start:
                  work_dir: /app
                  cmds:
                      - pm2 start "bun server.ts"
          healthcheck:
              cmd: curl http://localhost:3000/health
              test: "ok"
      load_balancer:
          type: load_balancer
          target_services:
              - service_name: web
                port: 3000

- deployment_name: my_app_aws
  provider: aws
  location: us-east-1
  description: AWS production deployment (mirrors Hetzner)
  duplicate_deployment_name: my_app_hetzner
```

### SSL with Custom Domains

Configure the load balancer with SSL certificates from Let's Encrypt and route domains to specific services:

```yaml
- deployment_name: my_app_prod
  provider: hetzner
  location: ash
  services:
      web_main:
          instances: 2
          clusters: 2
          server_type: cpx21
          # ... service config ...

      web_api:
          instances: 1
          clusters: 2
          server_type: cpx21
          # ... service config ...

      load_balancer:
          type: load_balancer
          ssl:
              email: admin@example.com
          target_services:
              - service_name: web_main
                port: 3000
                domains:
                    - example.com
                    - www.example.com
              - service_name: web_api
                port: 4000
                domains:
                    - api.example.com
```

---

## Cloud Providers

### Hetzner

**Required env vars:** `TURBOCI_HETZNER_API_KEY`

Get your API token from the [Hetzner Cloud Console](https://console.hetzner.cloud/) → Project → Security → API Tokens.

Hetzner is the most mature supported provider. Key details:

- Supports private networks, firewalls, and SSH key management natively
- No managed NAT — TurboCI's relay server acts as the NAT gateway for private servers
- Example locations: `ash` (Ashburn, US), `hil` (Hillsboro, US), `fsn1` (Falkenstein, DE), `nbg1` (Nuremberg, DE), `hel1` (Helsinki, FI)
- Example server types: `cpx11` (2 vCPU, 2 GB RAM), `cpx21` (3 vCPU, 4 GB RAM), `cpx31` (4 vCPU, 8 GB RAM), `cx11`, `cx21`, etc.

### AWS

**Required env vars:** `TURBOCI_AWS_ACCESS_KEY`, `TURBOCI_AWS_SECRET_ACCESS_KEY`

Uses EC2 for compute, with security groups for firewall management and VPC for private networking.

### GCP

**Required env vars:** `TURBOCI_GCP_PROJECT_ID`, `TURBOCI_GCP_SERVICE_ACCOUNT_EMAIL`, `TURBOCI_GCP_SERVICE_ACCOUNT_PRIVATE_KEY`

Uses Compute Engine. Partial implementation.

### Azure

**Required env vars:** `TURBOCI_AZURE_API_KEY`

Partial implementation.

---

## Project Structure

```
turboci/
├── bin.ts                              # CLI entry point (Commander.js setup)
├── index.ts                            # Core exports + global state initialization
├── types.ts                            # All TypeScript types and constants
├── package.json
│
├── commands/
│   ├── up/                             # `turboci up` command
│   │   ├── index.ts                    # Orchestrates setup → prepare → run
│   │   ├── setup/                      # Phase 1: Infrastructure provisioning
│   │   │   ├── index.ts
│   │   │   ├── functions/
│   │   │   │   ├── setup-hetzner-server.ts
│   │   │   │   ├── setup-aws-server.ts
│   │   │   │   └── setup-hetzner-server-trim-excess-servers.ts
│   │   ├── prepare/                    # Phase 2: Server preparation
│   │   │   ├── index.ts
│   │   │   └── prepare-servers.ts
│   │   ├── run/                        # Phase 3: Application startup
│   │   │   └── index.ts
│   │   └── cleanup/                    # Post-deployment cleanup
│   │       └── index.ts
│   ├── down/                           # `turboci down` command
│   │   └── index.ts
│   ├── init/                           # `turboci init` command
│   │   └── index.ts
│   └── control/                        # `turboci control` command
│       └── index.ts
│
├── functions/
│   ├── get/                            # Query active deployment state
│   ├── exec/                           # Execute commands on running servers
│   ├── terminal/                       # SSH terminal access
│   ├── server/
│   │   ├── ssh_relay/                  # Relay server setup (Hetzner, AWS)
│   │   ├── load-balancers/             # LB config generation (Hetzner, AWS)
│   │   └── shell/                      # NGINX config generators
│   └── platforms/
│       ├── grab-server-locations.ts    # List available regions
│       ├── grab-server-types.ts        # List available instance types
│       └── grab-server-os-types.ts     # List available OS images
│
├── utils/
│   ├── ssh/
│   │   ├── exec-ssh.ts                 # Direct SSH command execution
│   │   ├── relay-exec-ssh.ts           # SSH via relay server
│   │   ├── grab-ssh-prefix.ts          # Build SSH command prefix
│   │   ├── grab-sh-env.ts              # Generate env export strings
│   │   └── shell-scripts/              # Shell script generators
│   ├── bun-scripts/                    # Bun script generation utilities
│   ├── grab-config.ts                  # Parse and normalize config files
│   ├── grab-active-config.ts           # Load active deployment state
│   ├── write-config.ts                 # Write config to YAML
│   ├── grab-dir-names.ts               # Resolve .turboci directory path
│   ├── sync-remote-dirs.ts             # rsync wrapper (direct to server)
│   ├── sync-relay-remote-dirs.ts       # rsync via relay (local→relay→servers)
│   ├── sync-directories.ts             # High-level sync coordinator
│   ├── install-apt-dependencies.ts     # APT package installation
│   ├── install-turboci-dependencies.ts # docker/bun/node installation
│   ├── grab-normalized-servers.ts      # Unified server object abstraction
│   └── grab-server-instance-name.ts    # Generate standardized server names
│
└── test/
    └── next-app/                       # Example Next.js project
        └── .turboci/
            └── config.yaml             # Example TurboCI configuration
```
