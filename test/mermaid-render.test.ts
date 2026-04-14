import test from "node:test";
import assert from "node:assert/strict";

import { createCache, getSvgUrlWithCache, renderImageWithCache, renderSvgWithCache } from "../mermaid-render.ts";
import { ensureMermaidRuntimeDependencies } from "../mermaid-runtime.ts";

const SAMPLE = `flowchart TD
  A[User] --> B{Cached?}
  B -- Yes --> C[Return response]
  B -- No --> D[Resolve upstream]
  D --> C`;

test("renderSvgWithCache normalizes SVG for rasterization", async () => {
  await ensureMermaidRuntimeDependencies();
  const cache = createCache();
  const rendered = renderSvgWithCache(cache, SAMPLE);

  assert.ok(rendered.svg.includes("<svg"));
  assert.ok(!rendered.svg.includes("color-mix("));
  assert.ok(!rendered.svg.includes("var(--_"));
  assert.ok(rendered.dimensions.widthPx > 0);
  assert.ok(rendered.dimensions.heightPx > 0);
});

test("renderImageWithCache returns a PNG payload", async () => {
  await ensureMermaidRuntimeDependencies();
  const cache = createCache();
  const rendered = renderImageWithCache(cache, SAMPLE);

  assert.ok(rendered.pngBase64.startsWith("iVBORw0KGgo"));
  assert.ok(rendered.dimensions.widthPx > 0);
  assert.ok(rendered.dimensions.heightPx > 0);
});

test("getSvgUrlWithCache persists a clickable file URL", async () => {
  await ensureMermaidRuntimeDependencies();
  const cache = createCache();
  const url = getSvgUrlWithCache(cache, SAMPLE);

  assert.ok(url.startsWith("file://"));
  assert.ok(url.endsWith(".svg"));
});
