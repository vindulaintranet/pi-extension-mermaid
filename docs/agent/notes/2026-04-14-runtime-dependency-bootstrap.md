# Mermaid runtime dependency bootstrap

## Goal
Make `pi install` of `pi-extension-mermaid` more resilient when runtime renderer dependencies are missing, especially for local-path installs and stale existing installs.

## Context
`@resvg/resvg-js` was already declared in `package.json`, but Pi only runs `npm install` automatically for git/npm package sources. Local path installs are loaded in place, and older existing installs can also end up with code that expects a dependency before `node_modules` has been refreshed.

## Decisions
- Keep `beautiful-mermaid` and `@resvg/resvg-js` declared in `dependencies`.
- Add `mermaid-runtime.ts` to preload renderer modules before the extension registers UI behavior.
- Make the extension factory async and await runtime dependency bootstrap at load time.
- If runtime imports fail, try `npm install --no-save --package-lock=false` with the versions declared in `package.json`.
- Remove direct top-level runtime imports from `mermaid-render.ts` so the extension does not crash before bootstrap runs.
- Add tests that explicitly verify runtime dependency preload before render tests run.
- Document the new behavior in `README.md`.

## Commands run
- `rg -n "resvg|@resvg/resvg-js|pi install|extension" -S .`
- `read /opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/docs/packages.md`
- `npm install`
- `npm test`
- `npm run check:bundle`
- `npm run check:pack`

## Files changed
- `README.md`
- `mermaid-render.ts`
- `mermaid-runtime.ts`
- `mermaid.ts`
- `package.json`
- `test/mermaid-render.test.ts`
- `test/mermaid-runtime.test.ts`

## Tests
- `npm test`
- `npm run check:bundle`
- `npm run check:pack`

## Risks
- Bootstrap now shells out to `npm` when the renderer runtime is missing, so first load can take longer on broken local installs.
- If `npm` is unavailable or blocked, the extension now reports a runtime warning instead of failing hard at import time.
- The bootstrap command intentionally avoids changing `package-lock.json`, but it still writes `node_modules` when recovery is needed.

## Next
- Re-test with a real `pi install /path/to/pi-extension-mermaid` flow where `node_modules` is absent.
- Re-test with an already-installed git checkout that predates the runtime dependency refresh.
