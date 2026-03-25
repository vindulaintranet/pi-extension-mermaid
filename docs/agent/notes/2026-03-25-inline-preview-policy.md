# inline Mermaid preview policy

## Goal
Stop skipping inline Mermaid previews for tall diagrams and always render them in chat.

## Context
The previous behavior skipped inline rendering for large diagrams and forced the user toward `/mermaid-open`. The user explicitly wants the inline preview to always appear, with larger viewing kept as an optional step.

## Decisions
- Remove the row-based guard that skipped tall inline Mermaid previews.
- Keep `/mermaid-open` and `/mermaid` as optional ways to inspect the diagram in a larger browser or viewer surface.
- Preserve the existing clickable `abrir grande` hint below the inline preview.

## Commands run
- `npm run validate`

## Files changed
- `mermaid.ts`
- `README.md`
- `CHANGELOG.md`
- `docs/agent/notes/2026-03-25-bootstrap.md`
- `docs/agent/notes/2026-03-25-inline-preview-policy.md`

## Tests
- `npm run validate`

## Risks
- Very tall diagrams will consume many terminal rows again.
- This may feel heavy in narrow terminals, but matches the requested behavior.

## Next
- Confirm the inline preview behavior in a real Pi session.
