import test from "node:test";
import assert from "node:assert/strict";

import { ensureMermaidRuntimeDependencies, getMermaidRuntimeModules } from "../mermaid-runtime.ts";

test("Mermaid runtime dependencies resolve before rendering", async () => {
  const status = await ensureMermaidRuntimeDependencies();

  assert.equal(status.ready, true);

  const modules = getMermaidRuntimeModules();
  assert.equal(typeof modules.Resvg, "function");
  assert.equal(typeof modules.renderMermaidASCII, "function");
  assert.equal(typeof modules.renderMermaidSVG, "function");
  assert.ok("github-dark" in modules.THEMES);
});
