# Contributing

Thanks for contributing to `pi-extension-mermaid`.

## Scope of this repository

This repository ships a focused Pi package for Mermaid rendering.

Main behaviors:
- render fenced `mermaid` blocks inline in Pi chat
- open the latest diagram with `/mermaid-open`
- open the session viewer with `/mermaid` or `Ctrl+Shift+M`

## Local setup

```bash
npm install
npm run validate
```

## Validation commands

```bash
npm test
npm run check:bundle
npm run check:pack
npm run validate
```

These checks cover:
- Mermaid block extraction
- SVG normalization and PNG rendering
- bundle validation for the Pi extension entrypoint
- package contents via `npm pack --dry-run`

## Making a change

1. Start from `main`
2. Make the smallest coherent change you can
3. Update docs when behavior changes:
   - `README.md`
   - `CHANGELOG.md`
   - `RELEASING.md` if release flow changed
4. For non-trivial work, add or update a note in:
   - `docs/agent/notes/`
5. Run:

```bash
npm run validate
```

## Pull requests

A good PR should include:
- what changed
- why it changed
- how it was tested
- any terminal-compatibility, Pi-compatibility, or release implications

## Maintainer release flow

If a change is ready to publish, follow [RELEASING.md](./RELEASING.md).

## How Pi users consume updates

### Moving branch install

```bash
pi install git:github.com/vindulaintranet/pi-extension-mermaid
pi update
```

### Pinned release install

```bash
pi install git:github.com/vindulaintranet/pi-extension-mermaid@v0.1.0
```

Pinned installs are intentionally stable and do not move automatically on `pi update`.
