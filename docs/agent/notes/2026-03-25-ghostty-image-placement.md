# ghostty image placement fix

## Goal
Remove the large apparent blank area before inline Mermaid diagrams in Ghostty.

## Context
The user reported a big empty area before the visible diagram. The screenshot showed signs of stale or duplicated image placements in the terminal graphics layer rather than true whitespace in the PNG.

## Decisions
- Reuse a stable Kitty/Ghostty image ID for each rendered Mermaid preview.
- Reuse a stable image ID inside the terminal fallback viewer as well.
- Avoid emitting fresh anonymous terminal images on every redraw, because that can leave ghost placements behind in Ghostty-compatible image protocols.

## Commands run
- `npm run validate`

## Files changed
- `mermaid.ts`
- `mermaid-viewer.ts`
- `docs/agent/notes/2026-03-25-ghostty-image-placement.md`

## Tests
- `npm run validate`

## Risks
- Image ID reuse assumes the terminal correctly replaces the previous image for the same ID.
- If a terminal behaves differently from Kitty/Ghostty, this may have no visible effect, but should remain safe.

## Next
- Confirm in Ghostty that inline Mermaid previews no longer leave ghost images or large apparent gaps before the diagram.
