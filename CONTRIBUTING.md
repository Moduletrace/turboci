# Contributing to TurboCI

Thanks for your interest in contributing!

## Prerequisites

- [Bun](https://bun.sh) v1.0+
- TypeScript 5+

## Setup

```bash
git clone https://github.com/Moduletrace/turboci.git
cd turboci
bun install
```

## Development

Run the CLI directly during development:

```bash
bun run bin.ts up
bun run bin.ts down
bun run bin.ts init
```

Requires a `.turboci/config.yaml` or `.turboci/config.ts` in the working directory, or a `TURBOCI_DIR` env var pointing to a `.turboci/` folder.

## Type Checking

```bash
bunx tsc --noEmit
```

## Building

```bash
bun run build       # Minified JS → dist/
bun run compile     # Standalone binary → bin/
bun run build:all   # Both
```

## Submitting a Pull Request

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Run `bunx tsc --noEmit` and ensure there are no type errors
4. Open a pull request against `main` with a clear description of the change

## Reporting Issues

Use the GitHub issue tracker. Please include:
- TurboCI version
- Cloud provider (Hetzner, AWS, etc.)
- Steps to reproduce
- Expected vs actual behavior
