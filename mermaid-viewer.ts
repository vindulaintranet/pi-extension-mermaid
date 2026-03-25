import type { ExtensionContext, Theme } from "@mariozechner/pi-coding-agent";
import { Image, Key, getCapabilities, matchesKey, visibleWidth } from "@mariozechner/pi-tui";

import type { MermaidContextSlice } from "./mermaid-extract.ts";
import type { RenderCache } from "./mermaid-render.ts";

import { pickBestPreset, renderImageWithCache } from "./mermaid-render.ts";

export type DiagramEntry = {
  id: string;
  block: {
    code: string;
    blockIndex: number;
    startLine: number;
    endLine: number;
  };
  context: MermaidContextSlice;
  source: "assistant" | "user" | "command";
};

const BODY_HEIGHT = 20;

export async function openMermaidViewer(args: {
  ctx: ExtensionContext;
  diagrams: DiagramEntry[];
  focusIndex?: number;
  cache: RenderCache;
}): Promise<void> {
  const { ctx, diagrams, cache } = args;
  if (!ctx.hasUI || diagrams.length === 0) return;

  const startIndex = args.focusIndex ?? diagrams.length - 1;

  if (getCapabilities().images) {
    await openImageViewer(ctx, diagrams, startIndex, cache);
    return;
  }

  await openAsciiViewer(ctx, diagrams, startIndex, cache);
}

async function openImageViewer(
  ctx: ExtensionContext,
  diagrams: DiagramEntry[],
  startIndex: number,
  cache: RenderCache,
): Promise<void> {
  await ctx.ui.custom<void>(
    (tui, theme, _kb, done) => {
      const viewer = new MermaidImageViewer(diagrams, startIndex, cache, theme, done);
      return {
        render: (width: number) => viewer.render(width),
        handleInput: (data: string) => {
          viewer.handleInput(data);
          tui.requestRender();
        },
        invalidate: () => viewer.invalidate(),
        get focused() {
          return viewer.focused;
        },
        set focused(value: boolean) {
          viewer.focused = value;
        },
      };
    },
    {
      overlay: true,
      overlayOptions: {
        anchor: "top-center",
        width: "92%",
        minWidth: 60,
        maxHeight: "92%",
        offsetY: 1,
      },
    },
  );
}

async function openAsciiViewer(
  ctx: ExtensionContext,
  diagrams: DiagramEntry[],
  startIndex: number,
  cache: RenderCache,
): Promise<void> {
  await ctx.ui.custom<void>(
    (tui, theme, _kb, done) => {
      const viewer = new MermaidAsciiViewer(diagrams, startIndex, cache, theme, done);
      return {
        render: (width: number) => viewer.render(width),
        handleInput: (data: string) => {
          viewer.handleInput(data);
          tui.requestRender();
        },
        invalidate: () => viewer.invalidate(),
        get focused() {
          return viewer.focused;
        },
        set focused(value: boolean) {
          viewer.focused = value;
        },
      };
    },
    {
      overlay: true,
      overlayOptions: {
        anchor: "top-center",
        width: 100,
        minWidth: 40,
        maxHeight: "80%",
        offsetY: 1,
      },
    },
  );
}

class MermaidImageViewer {
  private activeIndex: number;
  focused = false;
  private cachedLines?: string[];
  private cachedWidth?: number;
  private image?: Image;
  private currentCode?: string;

  constructor(
    private diagrams: DiagramEntry[],
    initialIndex: number,
    private cache: RenderCache,
    private theme: Theme,
    private done: () => void,
  ) {
    this.activeIndex = Math.max(0, Math.min(initialIndex, diagrams.length - 1));
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c"))) {
      this.done();
      return;
    }

    if (data === "[" || matchesKey(data, Key.shift("tab"))) {
      this.activeIndex = (this.activeIndex - 1 + this.diagrams.length) % this.diagrams.length;
      this.currentCode = undefined;
      this.image = undefined;
    } else if (data === "]" || matchesKey(data, Key.tab)) {
      this.activeIndex = (this.activeIndex + 1) % this.diagrams.length;
      this.currentCode = undefined;
      this.image = undefined;
    }

    this.invalidate();
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) {
      return this.cachedLines;
    }

    const entry = this.diagrams[this.activeIndex];
    const lines: string[] = [];
    lines.push(
      this.theme.fg("customMessageLabel", this.theme.bold(`mermaid ${this.activeIndex + 1}/${this.diagrams.length}`)),
    );

    const before = summarizeContext(entry.context.beforeLines);
    if (before) {
      lines.push(this.theme.fg("dim", truncate(before, width)));
    }

    const rendered = renderImageWithCache(this.cache, entry.block.code);
    if (!this.image || this.currentCode !== entry.block.code) {
      this.image = new Image(
        rendered.pngBase64,
        "image/png",
        {
          fallbackColor: (text: string) => this.theme.fg("dim", text),
        },
        {
          maxWidthCells: 180,
          filename: `mermaid-${entry.id}.png`,
        },
        rendered.dimensions,
      );
      this.currentCode = entry.block.code;
    }

    lines.push(...this.image.render(width));

    const after = summarizeContext(entry.context.afterLines);
    if (after) {
      lines.push(this.theme.fg("dim", truncate(after, width)));
    }

    lines.push(this.theme.fg("dim", "[] prev/next • esc close"));
    this.cachedLines = lines;
    this.cachedWidth = width;
    return lines;
  }

  invalidate(): void {
    this.cachedLines = undefined;
    this.cachedWidth = undefined;
    this.image?.invalidate();
  }
}

class MermaidAsciiViewer {
  private activeIndex: number;
  private panX = 0;
  private panY = 0;
  focused = false;

  private cachedLines?: string[];
  private cachedWidth?: number;

  constructor(
    private diagrams: DiagramEntry[],
    initialIndex: number,
    private cache: RenderCache,
    private theme: Theme,
    private done: () => void,
  ) {
    this.activeIndex = Math.max(0, Math.min(initialIndex, diagrams.length - 1));
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c"))) {
      this.done();
      return;
    }

    if (matchesKey(data, Key.left)) {
      this.panX -= 1;
    } else if (matchesKey(data, Key.right)) {
      this.panX += 1;
    } else if (matchesKey(data, Key.up)) {
      this.panY -= 1;
    } else if (matchesKey(data, Key.down)) {
      this.panY += 1;
    } else if (matchesKey(data, Key.shift("left")) || matchesKey(data, Key.alt("left"))) {
      this.panX -= 10;
    } else if (matchesKey(data, Key.shift("right")) || matchesKey(data, Key.alt("right"))) {
      this.panX += 10;
    } else if (matchesKey(data, Key.shift("up")) || matchesKey(data, Key.alt("up"))) {
      this.panY -= 5;
    } else if (matchesKey(data, Key.shift("down")) || matchesKey(data, Key.alt("down"))) {
      this.panY += 5;
    } else if (matchesKey(data, Key.home)) {
      this.panX = 0;
    } else if (matchesKey(data, Key.end)) {
      this.panX = Number.POSITIVE_INFINITY;
    } else if (data === "[" || matchesKey(data, Key.shift("tab"))) {
      this.activeIndex = (this.activeIndex - 1 + this.diagrams.length) % this.diagrams.length;
      this.panX = 0;
      this.panY = 0;
    } else if (data === "]" || matchesKey(data, Key.tab)) {
      this.activeIndex = (this.activeIndex + 1) % this.diagrams.length;
      this.panX = 0;
      this.panY = 0;
    }

    this.invalidate();
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) {
      return this.cachedLines;
    }

    const theme = this.theme;
    const innerWidth = width - 4;
    const dim = (text: string) => theme.fg("dim", text);

    const entry = this.diagrams[this.activeIndex];
    const { rendered } = pickBestPreset(this.cache, entry.block.code, innerWidth);

    const content: string[] = [];
    for (const line of entry.context.beforeLines) {
      content.push(dim(line));
    }
    if (entry.context.beforeLines.length > 0) content.push("");

    for (const line of rendered.lines) {
      content.push(line);
    }

    if (entry.context.afterLines.length > 0) content.push("");
    for (const line of entry.context.afterLines) {
      content.push(dim(line));
    }

    const maxPanY = Math.max(0, content.length - BODY_HEIGHT);
    const maxPanX = Math.max(0, rendered.maxWidth - innerWidth);
    this.panY = Math.max(0, Math.min(this.panY, maxPanY));
    this.panX = Math.max(0, Math.min(this.panX, maxPanX));

    const visible = content.slice(this.panY, this.panY + BODY_HEIGHT);
    const lines: string[] = [];

    const label = ` mermaid ${this.activeIndex + 1}/${this.diagrams.length} `;
    const topFill = "─".repeat(Math.max(0, innerWidth + 2 - label.length));
    lines.push(`┌${label}${topFill}┐`);

    for (let index = 0; index < BODY_HEIGHT; index += 1) {
      const raw = index < visible.length ? visible[index] ?? "" : "";
      const sliced = sliceAnsiByColumns(raw, this.panX, innerWidth);
      const padded = padToWidth(sliced, innerWidth);
      lines.push(`│ ${padded} │`);
    }

    const footer = dim("←→↑↓ scroll • [] prev/next • esc close");
    lines.push(`├${"─".repeat(innerWidth + 2)}┤`);
    lines.push(`│ ${padToWidth(footer, innerWidth)} │`);
    lines.push(`└${"─".repeat(innerWidth + 2)}┘`);

    this.cachedLines = lines;
    this.cachedWidth = width;
    return lines;
  }

  invalidate(): void {
    this.cachedLines = undefined;
    this.cachedWidth = undefined;
  }
}

function summarizeContext(lines: string[]): string {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .slice(0, 240);
}

function truncate(text: string, width: number): string {
  if (visibleWidth(text) <= width) return text;
  return `${text.slice(0, Math.max(0, width - 3))}...`;
}

function sliceAnsiByColumns(line: string, startCol: number, maxCols: number): string {
  let col = 0;
  let output = "";
  let index = 0;

  while (index < line.length) {
    if (line[index] === "\u001b" && line[index + 1] === "[") {
      const sequence = readAnsiEscape(line, index);
      if (sequence) {
        if (col >= startCol && col < startCol + maxCols) {
          output += sequence;
        } else if (col < startCol) {
          output += sequence;
        }
        index += sequence.length;
        continue;
      }
    }

    if (col >= startCol && col < startCol + maxCols) {
      output += line[index] ?? "";
    }

    col += 1;
    if (col >= startCol + maxCols) break;
    index += 1;
  }

  return output + "\u001b[0m";
}

function readAnsiEscape(line: string, start: number): string | undefined {
  if (line[start] !== "\u001b" || line[start + 1] !== "[") return undefined;

  let end = start + 2;
  while (end < line.length) {
    const code = line.charCodeAt(end);
    if (code >= 0x40 && code <= 0x7e) {
      return line.slice(start, end + 1);
    }
    end += 1;
  }

  return undefined;
}

function padToWidth(text: string, target: number): string {
  const width = visibleWidth(text);
  if (width >= target) return text;
  return text + " ".repeat(target - width);
}
