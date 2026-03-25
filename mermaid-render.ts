import type { ImageDimensions } from "@mariozechner/pi-tui";
import { visibleWidth } from "@mariozechner/pi-tui";
import { Resvg } from "@resvg/resvg-js";
import { THEMES, renderMermaidASCII, renderMermaidSVG } from "beautiful-mermaid";
import { createHash } from "node:crypto";

export type MermaidPreset = {
  key: string;
  paddingX: number;
  boxBorderPadding: number;
};

export type RenderedDiagramAscii = {
  ansi: string;
  lines: string[];
  maxWidth: number;
  lineCount: number;
};

export type RenderedDiagramImage = {
  pngBase64: string;
  dimensions: ImageDimensions;
};

export type CachedDiagram = {
  image: RenderedDiagramImage;
  asciiByPreset: Map<string, RenderedDiagramAscii>;
};

export type RenderCache = {
  map: Map<string, CachedDiagram>;
  maxEntries: number;
};

export const PRESETS: MermaidPreset[] = [
  { key: "roomy", paddingX: 4, boxBorderPadding: 2 },
  { key: "normal", paddingX: 2, boxBorderPadding: 1 },
  { key: "tight", paddingX: 1, boxBorderPadding: 1 },
  { key: "tighter", paddingX: 1, boxBorderPadding: 0 },
  { key: "tightest", paddingX: 0, boxBorderPadding: 0 },
];

const IMAGE_THEME = {
  ...THEMES["github-dark"],
  transparent: true,
};

const MIN_TARGET_WIDTH_PX = 1400;
const MAX_TARGET_WIDTH_PX = 2200;

export function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex").slice(0, 8);
}

export function createCache(maxEntries = 128): RenderCache {
  return { map: new Map(), maxEntries };
}

export function renderImageWithCache(cache: RenderCache, code: string): RenderedDiagramImage {
  const entry = getOrCreateCacheEntry(cache, code);
  return entry.image;
}

export function renderAsciiWithCache(
  cache: RenderCache,
  code: string,
  preset: MermaidPreset,
): RenderedDiagramAscii {
  const entry = getOrCreateCacheEntry(cache, code);
  const existing = entry.asciiByPreset.get(preset.key);
  if (existing) {
    return existing;
  }

  const raw = renderMermaidASCII(code, {
    paddingX: preset.paddingX,
    boxBorderPadding: preset.boxBorderPadding,
    colorMode: "none",
  });

  const ansi = raw.trimEnd();
  const lines = ansi.split("\n");
  let maxWidth = 0;
  for (const line of lines) {
    const width = visibleWidth(line);
    if (width > maxWidth) maxWidth = width;
  }

  const rendered: RenderedDiagramAscii = {
    ansi,
    lines,
    maxWidth,
    lineCount: lines.length,
  };

  entry.asciiByPreset.set(preset.key, rendered);
  return rendered;
}

export function pickBestPreset(
  cache: RenderCache,
  code: string,
  width: number,
): { preset: MermaidPreset; rendered: RenderedDiagramAscii; overflowed: boolean } {
  let last: { preset: MermaidPreset; rendered: RenderedDiagramAscii } | undefined;

  for (const preset of PRESETS) {
    const rendered = renderAsciiWithCache(cache, code, preset);
    last = { preset, rendered };
    if (rendered.maxWidth <= width) {
      return { preset, rendered, overflowed: false };
    }
  }

  if (!last) {
    throw new Error("no Mermaid presets available");
  }

  return { ...last, overflowed: true };
}

function getOrCreateCacheEntry(cache: RenderCache, code: string): CachedDiagram {
  const key = hashCode(code);
  const existing = cache.map.get(key);
  if (existing) {
    touch(cache, key, existing);
    return existing;
  }

  const created: CachedDiagram = {
    image: renderPng(code),
    asciiByPreset: new Map(),
  };

  touch(cache, key, created);
  evictIfNeeded(cache);
  return created;
}

function touch(cache: RenderCache, key: string, entry: CachedDiagram): void {
  cache.map.delete(key);
  cache.map.set(key, entry);
}

function evictIfNeeded(cache: RenderCache): void {
  if (cache.map.size <= cache.maxEntries) return;
  const oldest = cache.map.keys().next().value;
  if (typeof oldest === "string") cache.map.delete(oldest);
}

function renderPng(code: string): RenderedDiagramImage {
  const svg = renderMermaidSVG(code, IMAGE_THEME);
  const base = new Resvg(svg, {
    background: "rgba(0,0,0,0)",
  });

  const targetWidth = Math.max(
    MIN_TARGET_WIDTH_PX,
    Math.min(MAX_TARGET_WIDTH_PX, Math.round(base.width || MIN_TARGET_WIDTH_PX)),
  );

  const raster = new Resvg(svg, {
    background: "rgba(0,0,0,0)",
    fitTo:
      targetWidth === Math.round(base.width || 0)
        ? { mode: "original" }
        : { mode: "width", value: targetWidth },
  }).render();

  return {
    pngBase64: raster.asPng().toString("base64"),
    dimensions: {
      widthPx: raster.width,
      heightPx: raster.height,
    },
  };
}
