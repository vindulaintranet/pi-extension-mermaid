# Contributing

Thanks for contributing to `pi-extension-mermaid`.

## What this repository contains

This repository ships a small Pi package with one extension:

- `mermaid.ts`

It provides:
- inline Mermaid rendering for fenced `mermaid` blocks
- a full viewer via `Ctrl+Shift+M`
- a full viewer via `/mermaid`

## Local setup

```bash
npm install
npm run validate
```

## Test commands

```bash
npm test
npm run check:bundle
npm run check:pack
npm run validate
```

What these checks cover:
- unit tests for Mermaid block extraction helpers
- bundle/syntax validation for the Pi extension entrypoint
- package validation with `npm pack --dry-run`

## Making a change

1. Create a branch from `main`
2. Make the change
3. Update docs if behavior changed:
   - `README.md`
   - `CHANGELOG.md`
   - `RELEASING.md` when release flow changes
4. Run:
   ```bash
   npm run validate
   ```
5. Open a pull request

## Pull requests

A good PR should include:
- what changed
- why it changed
- how it was tested
- any Pi compatibility or release implications

## Maintainer merge flow

For maintainers, the normal flow is:

1. Review PR
2. Ensure CI is green
3. Squash merge or merge commit into `main`
4. If the change should be published, follow `RELEASING.md`

## How Pi users get updates

### Unpinned git install

```bash
pi install git:github.com/vindulaintranet/pi-extension-mermaid
```

In this case, users can later run:

```bash
pi update
```

Pi will pull the latest default branch state for the package.

### Pinned git install

```bash
pi install git:github.com/vindulaintranet/pi-extension-mermaid@v0.1.0
```

Pinned installs are intentionally stable. `pi update` skips them until the user decides to move to another tag/ref.
