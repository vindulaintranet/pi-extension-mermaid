# pi-extension-mermaid bootstrap

## Goal
Create a standalone Pi package that renders Mermaid fenced blocks inline and opens a viewer with `Ctrl+Shift+M` and `/mermaid`.

## Context
This package mirrors the standalone packaging direction already used for `pi-extension-ssh` and `pi-extension-search`, but focuses only on Mermaid rendering and browsing.

## Decisions
- Keep the package focused on Mermaid only.
- Generate Mermaid SVG with `beautiful-mermaid`.
- Normalize the SVG before rasterizing it with `@resvg/resvg-js`, because the raw SVG relies on CSS variables and `color-mix()` that do not rasterize cleanly in `resvg`.
- Persist a normalized SVG file to temp storage so the terminal preview can expose a clickable `file://` link for opening the diagram large in the browser.
- Add `/mermaid-open` as the reliable, terminal-independent way to open the latest Mermaid diagram directly in the browser.
- Always render inline PNG previews when the terminal supports images; opening larger is an extra action, not a replacement for the inline preview.
- Avoid injecting the preview from `message_end`, because that can place the custom message before the assistant message in history and look like duplicated output. Instead, collect diagrams and append the preview after `agent_end`.
- For full-quality viewing, open a browser-based SVG viewer first and keep terminal viewers as fallback paths.
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
- `test/mermaid-render.test.ts`

## Tests
- extraction helper tests
- renderer normalization test
- PNG generation test
- SVG file URL persistence test
- bundle validation
- `npm pack --dry-run`

## Risks
- Runtime rendering now depends on native platform bindings from `@resvg/resvg-js` being installed correctly on the target machine.
- Browser viewer quality depends on the local machine being able to open a browser from the Pi process.
- On headless or restricted environments, the extension falls back to terminal viewers.

## Next
- Confirm the new preview ordering in a real Pi session.
- Publish a tagged release once the visual result is confirmed.
