import type { ImageDimensions } from "@mariozechner/pi-tui";
import { calculateImageRows, getCellDimensions, visibleWidth } from "@mariozechner/pi-tui";
import { Resvg } from "@resvg/resvg-js";
import { THEMES, renderMermaidASCII, renderMermaidSVG, type DiagramColors } from "beautiful-mermaid";
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

export type RenderedDiagramSvg = {
  svg: string;
  dimensions: ImageDimensions;
};

export type RenderedDiagramImage = {
  pngBase64: string;
  dimensions: ImageDimensions;
};

export type CachedDiagram = {
  svg: RenderedDiagramSvg;
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

const IMAGE_THEME: DiagramColors = {
  ...THEMES["github-dark"],
  surface: "#161b22",
  border: "#30363d",
};

const MIX = {
  textSec: 60,
  textMuted: 40,
  textFaint: 25,
  line: 50,
  arrow: 85,
  nodeFill: 3,
  nodeStroke: 20,
  groupHeader: 5,
  innerStroke: 12,
  keyBadge: 10,
} as const;

const MIN_TARGET_WIDTH_PX = 900;
const MAX_TARGET_WIDTH_PX = 1800;

export function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex").slice(0, 8);
}

export function createCache(maxEntries = 128): RenderCache {
  return { map: new Map(), maxEntries };
}

export function renderSvgWithCache(cache: RenderCache, code: string): RenderedDiagramSvg {
  const entry = getOrCreateCacheEntry(cache, code);
  return entry.svg;
}

export function renderImageWithCache(cache: RenderCache, code: string): RenderedDiagramImage {
  const entry = getOrCreateCacheEntry(cache, code);
  return entry.image;
}

export function estimateRowsForWidth(dimensions: ImageDimensions, maxWidthCells: number): number {
  return calculateImageRows(dimensions, maxWidthCells, getCellDimensions());
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

  const created = renderDiagram(code);
  touch(cache, key, created);
  evictIfNeeded(cache);
  return created;
}

function renderDiagram(code: string): CachedDiagram {
  const rawSvg = renderMermaidSVG(code, IMAGE_THEME);
  const svg = normalizeSvgForRaster(rawSvg, IMAGE_THEME);

  const base = new Resvg(svg, {
    background: IMAGE_THEME.bg,
  });

  const targetWidth = Math.max(
    MIN_TARGET_WIDTH_PX,
    Math.min(MAX_TARGET_WIDTH_PX, Math.round((base.width || MIN_TARGET_WIDTH_PX) * 2)),
  );

  const raster = new Resvg(svg, {
    background: IMAGE_THEME.bg,
    fitTo:
      targetWidth === Math.round(base.width || 0)
        ? { mode: "original" }
        : { mode: "width", value: targetWidth },
  }).render();

  return {
    svg: {
      svg,
      dimensions: {
        widthPx: Math.max(1, Math.round(base.width || raster.width)),
        heightPx: Math.max(1, Math.round(base.height || raster.height)),
      },
    },
    image: {
      pngBase64: raster.asPng().toString("base64"),
      dimensions: {
        widthPx: raster.width,
        heightPx: raster.height,
      },
    },
    asciiByPreset: new Map(),
  };
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

function normalizeSvgForRaster(svg: string, colors: DiagramColors): string {
  const resolved = resolveRasterColors(colors);

  return svg
    .replace(/\sstyle="[^"]*"/, "")
    .replace(
      /<style>[\s\S]*?<\/style>/,
      `<style>text { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }</style>`,
    )
    .replaceAll("var(--bg)", resolved.bg)
    .replaceAll("var(--fg)", resolved.fg)
    .replaceAll("var(--_text)", resolved.text)
    .replaceAll("var(--_text-sec)", resolved.textSec)
    .replaceAll("var(--_text-muted)", resolved.textMuted)
    .replaceAll("var(--_text-faint)", resolved.textFaint)
    .replaceAll("var(--_line)", resolved.line)
    .replaceAll("var(--_arrow)", resolved.arrow)
    .replaceAll("var(--_node-fill)", resolved.nodeFill)
    .replaceAll("var(--_node-stroke)", resolved.nodeStroke)
    .replaceAll("var(--_group-fill)", resolved.groupFill)
    .replaceAll("var(--_group-hdr)", resolved.groupHdr)
    .replaceAll("var(--_inner-stroke)", resolved.innerStroke)
    .replaceAll("var(--_key-badge)", resolved.keyBadge);
}

function resolveRasterColors(colors: DiagramColors) {
  return {
    bg: colors.bg,
    fg: colors.fg,
    text: colors.fg,
    textSec: colors.muted ?? mixColors(colors.fg, colors.bg, MIX.textSec),
    textMuted: colors.muted ?? mixColors(colors.fg, colors.bg, MIX.textMuted),
    textFaint: mixColors(colors.fg, colors.bg, MIX.textFaint),
    line: colors.line ?? mixColors(colors.fg, colors.bg, MIX.line),
    arrow: colors.accent ?? mixColors(colors.fg, colors.bg, MIX.arrow),
    nodeFill: colors.surface ?? mixColors(colors.fg, colors.bg, MIX.nodeFill),
    nodeStroke: colors.border ?? mixColors(colors.fg, colors.bg, MIX.nodeStroke),
    groupFill: colors.bg,
    groupHdr: mixColors(colors.fg, colors.bg, MIX.groupHeader),
    innerStroke: mixColors(colors.fg, colors.bg, MIX.innerStroke),
    keyBadge: mixColors(colors.fg, colors.bg, MIX.keyBadge),
  };
}

function mixColors(fg: string, bg: string, pct: number): string {
  const f = parseHex(fg);
  const b = parseHex(bg);
  const mix = (a: number, z: number) => Math.round(a * (pct / 100) + z * (1 - pct / 100));
  const r = mix(f.r, b.r);
  const g = mix(f.g, b.g);
  const bl = mix(f.b, b.b);
  return `#${[r, g, bl].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const value = hex.trim().replace(/^#/, "");
  const normalized = value.length === 3 ? value.split("").map((char) => char + char).join("") : value;

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    throw new Error(`unsupported hex color: ${hex}`);
  }

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}
