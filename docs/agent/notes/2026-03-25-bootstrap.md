# pi-extension-mermaid bootstrap

## Goal
Create a standalone Pi package that renders Mermaid fenced blocks inline and opens a viewer with `Ctrl+Shift+M` and `/mermaid`.

## Context
This package mirrors the standalone packaging direction already used for `pi-extension-ssh` and `pi-extension-search`, but focuses only on Mermaid rendering and browsing.

## Decisions
- Keep the package focused on Mermaid only.
- Use `beautiful-mermaid` for terminal-friendly ASCII rendering.
- Store rendered diagram metadata in custom Pi messages and hide those messages from LLM context.
- Ship a standalone package entrypoint at `mermaid.ts` with small helper files for extraction, rendering, and viewer behavior.

## Commands run
- `npm test`
- `npm run check:bundle`
- `npm run check:pack`

## Files changed
- `package.json`
- `mermaid.ts`
- `mermaid-extract.ts`
- `mermaid-render.ts`
- `mermaid-viewer.ts`
- `README.md`
- `CHANGELOG.md`
- `test/mermaid-extract.test.ts`

## Tests
- extraction helper tests
- bundle validation
- `npm pack --dry-run`

## Risks
- Runtime behavior depends on `beautiful-mermaid` output staying compatible with the current viewer assumptions.
- The viewer uses fixed-height rendering, so very large diagrams still require scrolling.

## Next
- Publish the repo and wire CI/release automation if desired.
