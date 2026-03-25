# pi-extension-mermaid bootstrap

## Goal
Create a standalone Pi package that renders Mermaid fenced blocks inline and opens a viewer with `Ctrl+Shift+M` and `/mermaid`.

## Context
This package mirrors the standalone packaging direction already used for `pi-extension-ssh` and `pi-extension-search`, but focuses only on Mermaid rendering and browsing.

## Decisions
- Keep the package focused on Mermaid only.
- Render Mermaid as real images in supported terminals using `beautiful-mermaid` for SVG generation and `@resvg/resvg-js` for PNG rasterization.
- Keep ASCII rendering only as a fallback for terminals without inline image support.
- Store diagram metadata in custom Pi messages and hide those messages from LLM context.
- Ship a standalone package entrypoint at `mermaid.ts` with small helper files for extraction, rendering, and viewer behavior.

## Commands run
- `npm install`
- `npm run validate`

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
- runtime smoke test for PNG rasterization via local Node script

## Risks
- Runtime rendering now depends on native platform bindings from `@resvg/resvg-js` being installed correctly on the target machine.
- Inline image quality still depends on the terminal supporting Pi's image protocols.
- On unsupported terminals, the experience still falls back to ASCII.

## Next
- Publish a tagged release once the visual result is confirmed in real Pi sessions.
