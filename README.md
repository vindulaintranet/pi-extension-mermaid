# pi-extension-mermaid

[![CI](https://github.com/vindulaintranet/pi-extension-mermaid/actions/workflows/ci.yml/badge.svg)](https://github.com/vindulaintranet/pi-extension-mermaid/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/vindulaintranet/pi-extension-mermaid)](https://github.com/vindulaintranet/pi-extension-mermaid/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

A standalone [Pi](https://github.com/badlogic/pi-mono) package that renders Mermaid code blocks as real inline images in chat and opens a larger image viewer on demand.

Created by [Fabio Rizzo Matos](https://github.com/fabiorizzomatos) · contact: `fabiorizzo@vindula.com.br`

## What it does

This package gives Pi two Mermaid-focused behaviors:

- renders fenced ```` ```mermaid ```` blocks inline as rendered diagrams
- opens a larger Mermaid viewer with:
  - `Ctrl+Shift+M`
  - `/mermaid`

It watches both:
- assistant responses
- user prompts

So if the operator or agent emits Mermaid in a normal fenced block, Pi shows a rendered diagram automatically instead of leaving only the raw code visible.

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
- the larger viewer stays available with `Ctrl+Shift+M` or `/mermaid`

## Rendering model

### Supported terminals

On terminals with inline image support, the extension renders actual diagram images:
- Kitty
- Ghostty
- WezTerm
- iTerm2

### Fallback

If the terminal does not support inline images, the extension falls back to ASCII rendering instead of failing.

## Viewer controls

Inside the viewer:

- `[` previous diagram
- `]` next diagram
- `Esc` close

If the terminal does not support inline images, the viewer falls back to the older ASCII mode with scroll controls.

## Implementation notes

- Uses [`beautiful-mermaid`](https://www.npmjs.com/package/beautiful-mermaid) to generate SVG diagrams.
- Uses [`@resvg/resvg-js`](https://www.npmjs.com/package/@resvg/resvg-js) to rasterize Mermaid SVG into PNG for terminal image protocols.
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
