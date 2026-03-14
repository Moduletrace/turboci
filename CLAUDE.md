# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
bun run compile       # Standalone binary (~100MB, no runtime deps) → bin/
bun run build         # Minified JS file (~1MB, needs Node/Bun) → dist/
bun run build:all     # Both of the above
bun run upload:r2     # build:all + upload binaries to Cloudflare R2
```

TypeScript type-checking only (no emit):
```bash
bunx tsc --noEmit
```

## Running / Testing

There is no unit test framework. Tests are manual integration scripts in `test/` (gitignored). To run the CLI during development:

```bash
bun run bin.ts up          # Deploy
bun run bin.ts down        # Teardown
bun run bin.ts init        # Interactive config wizard
bun run bin.ts control     # Runtime control (get/exec/terminal)
```

Requires `.turboci/config.yaml` or `.turboci/config.ts` in the working directory, or `TURBOCI_DIR` env var pointing to a `.turboci/` folder.

## Architecture

### Entry Points
- **`bin.ts`** — CLI entry point. Declares global variables, registers Commander.js commands, calls `program.parse(Bun.argv)`.
- **`index.ts`** — Library entry point. Exports `turboci.get`, `turboci.exec`, `turboci.terminal` for programmatic use.

Both files declare the same globals (`CONFIGS`, `ACTIVE_CONFIGS`, `RELAY_SERVERS`, `ORA_SPINNER`, etc.). These globals are accessed throughout the codebase without imports.

### Global State Pattern
The codebase uses TypeScript `declare var` globals extensively. State flows top-down: CLI args → config parsing → globals → command functions. No dependency injection.

### Deployment Pipeline (`commands/up/`)
Three sequential phases:
1. **Setup** — Provision infra (servers, networks, firewalls, SSH keys) via cloud provider APIs
2. **Prepare** — Sync code local→relay→servers, install dependencies
3. **Run** — Preflight scripts → start services → postflight scripts → healthchecks

Rolling cluster updates: one cluster deployed at a time for zero downtime.

### Relay Server Pattern
Every deployment provisions a **relay server** (public IP, SSH only). Private servers have no public IP and are accessed exclusively through the relay via SSH tunneling. Files sync local→relay→private servers in parallel.

### Provider Abstraction
- `platforms/hetzner/`, `platforms/aws/`, `platforms/gcp/` — Provider API clients
- `functions/server/ssh_relay/` — Relay setup per provider
- `functions/server/load-balancers/` — Load balancer config per provider
- `commands/up/setup/functions/` — Provider-specific infra provisioning

Hetzner is the most complete implementation. AWS is functional. GCP/Azure are partial.

### Key Directories
| Path | Purpose |
|------|---------|
| `types.ts` | All TypeScript types and constants (`TCIGlobalConfig`, `CloudProviders`, etc.) |
| `data/app-data.ts` | Timeouts, max instances, ports (SSH: 50 retries, 5s; relay admin: 3772/3773) |
| `utils/ssh/` | SSH execution wrappers (direct and via relay) |
| `utils/grab-*.ts` | Config/state loading (config.yaml, active.yaml) |
| `utils/write-*.ts` | State persistence |
| `functions/` | Reusable server operation modules (exec, get, terminal, shell) |
| `presets/bun/` | Default Bun runtime presets |

### Configuration
`.turboci/config.yaml` (or `config.ts`) defines all deployments. `active.yaml` is auto-generated to track live state. Path resolution uses `TURBOCI_DIR` env var or walks up from CWD.

### Path Alias
`@/*` maps to the repo root (configured in `tsconfig.json`).
