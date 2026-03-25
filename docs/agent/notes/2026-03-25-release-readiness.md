# release readiness

## Goal
Polish release-facing repository docs, verify release flow, and cut the first public tag.

## Context
The repository is already functionally ready, but the release materials need to clearly explain installation, commands, large-view behavior, terminal caveats, and the exact tag-based release flow.

## Decisions
- Keep the current package version at `0.1.0` and use it for the first public tag.
- Make `/mermaid-open` the recommended reliable large-view path in docs.
- Document that OSC 8 `file://` hyperlinks are terminal-dependent and should be treated as convenience, not the primary workflow.
- Keep release distribution Git-based via tags and GitHub Releases rather than npm publishing.

## Commands run
- `git status`
- `git tag --list`
- `npm run validate`
- `git tag -a v0.1.0 -m "v0.1.0"`
- `git push origin main --follow-tags`

## Files changed
- `README.md`
- `RELEASING.md`
- `CHANGELOG.md`
- `CONTRIBUTING.md`
- `package.json`
- `docs/agent/notes/2026-03-25-release-readiness.md`

## Tests
- `npm run validate`

## Risks
- GitHub Release creation depends on the tag-triggered workflow completing successfully after push.
- Public release notes and README are accurate to the current implementation, but future behavior changes must be reflected before the next tag.

## Next
- Verify the GitHub release workflow finishes and the `v0.1.0` release page is populated.
- Optionally test pinned installation from a fresh Pi environment.
