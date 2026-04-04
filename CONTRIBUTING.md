# Contributing to OpenMerch SDK

Thanks for your interest in contributing. This guide covers local setup and expectations for pull requests.

## Local Setup

```bash
git clone https://github.com/openmerch/openmerch-sdk.git
cd openmerch-sdk
npm install
npm run build
```

This repo uses npm workspaces. All packages and examples are installed and linked from the root.

## Repo Layout

```
packages/       Publishable SDK packages (@openmerch/*)
examples/       Runnable examples demonstrating SDK usage
```

## Common Commands

```bash
npm run build       # Build all packages and examples
npm run typecheck   # Type-check without emitting
npm run test        # Run tests across all workspaces
npm run clean       # Remove build artifacts
```

## Pull Request Guidelines

- Keep PRs focused on a single change
- Include a clear description of what changed and why
- Ensure `npm run build` and `npm run typecheck` pass before submitting
- Add or update tests if you change runtime behavior
- Update relevant READMEs if you change public API surface

## Adding a New Package

1. Create a directory under `packages/` with `package.json`, `tsconfig.json`, `README.md`, and `src/index.ts`
2. Follow the metadata conventions from existing packages (repository, homepage, bugs, publishConfig)
3. Add an entry to the root README package table

## Adding an Example

1. Create a directory under `examples/` with `package.json`, `tsconfig.json`, `README.md`, and `src/index.ts`
2. Examples should run locally without private infrastructure
3. Add an entry to the root README examples table

## Questions

Open an issue or start a discussion on GitHub.
