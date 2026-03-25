# pi-extension-mermaid

[![CI](https://github.com/vindulaintranet/pi-extension-mermaid/actions/workflows/ci.yml/badge.svg)](https://github.com/vindulaintranet/pi-extension-mermaid/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/vindulaintranet/pi-extension-mermaid)](https://github.com/vindulaintranet/pi-extension-mermaid/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

A standalone [Pi](https://github.com/badlogic/pi-mono) package that renders Mermaid code blocks inline in chat and opens a full diagram viewer on demand.

Created by [Fabio Rizzo Matos](https://github.com/fabiorizzomatos) · contact: `fabiorizzo@vindula.com.br`

## What it does

This package gives Pi two Mermaid-focused behaviors:

- renders fenced ```` ```mermaid ```` blocks inline in the TUI
- opens a pannable Mermaid viewer with:
  - `Ctrl+Shift+M`
  - `/mermaid`

It watches both:
- assistant responses
- user prompts

So if the operator or agent emits Mermaid in a normal fenced block, Pi shows an inline ASCII diagram automatically.

## Install

### From GitHub

```bash
pi install git:github.com/vindulaintranet/pi-extension-mermaid
```

### Pin to a release tag

```bash
pi install git:github.com/vindulaintranet/pi-extension-mermaid@v0.1.0
```

### From a local path

```bash
pi install /absolute/path/to/pi-extension-mermaid
```

After installing, restart Pi or run:

```text
/reload
```

## Usage

Ask Pi or your model to answer with a Mermaid fenced block:

````markdown
```mermaid
flowchart LR
  User --> Pi
  Pi --> Mermaid
  Mermaid --> Viewer
```
````

What happens:
- the message gets scanned for Mermaid fences
- the diagram is rendered inline in the chat stream
- the full viewer stays available with `Ctrl+Shift+M` or `/mermaid`

## Viewer controls

Inside the viewer:

- `← → ↑ ↓` scroll
- `Shift+Arrow` or `Alt+Arrow` scroll faster
- `[` previous diagram
- `]` next diagram
- `Home` jump horizontal start
- `End` jump horizontal end
- `Esc` close

## Implementation notes

- Uses [`beautiful-mermaid`](https://www.npmjs.com/package/beautiful-mermaid) to render Mermaid as terminal-friendly ASCII.
- Stores diagram metadata in custom Pi session messages so diagrams survive normal session flow.
- Filters those custom messages out of LLM context, so the model does not see internal rendering payloads.

## Quality checks

Run everything locally with:

```bash
npm install
npm run validate
```

This runs:
- unit tests for Mermaid block extraction helpers
- bundle validation for the Pi extension entrypoint
- `npm pack --dry-run` to validate package contents

## Contributions

If you want to contribute:

1. fork the repository
2. create a branch
3. run `npm run validate`
4. open a pull request

See:
- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [RELEASING.md](./RELEASING.md)

## How updates reach Pi users

### Users installed from the default branch

```bash
pi install git:github.com/vindulaintranet/pi-extension-mermaid
```

They can later run:

```bash
pi update
```

and Pi will pull the latest package state from the default branch.

### Users installed from a pinned tag

```bash
pi install git:github.com/vindulaintranet/pi-extension-mermaid@v0.1.0
```

Pinned installs do not move automatically on `pi update`. They stay on that exact ref until the user upgrades intentionally.

## Package manifest

This repository is a Pi package via `package.json`:

```json
{
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./mermaid.ts"]
  }
}
```

## License

MIT
