import type { ExtensionContext, Theme } from "@mariozechner/pi-coding-agent";
import { Key, matchesKey, visibleWidth } from "@mariozechner/pi-tui";

import type { MermaidContextSlice } from "./mermaid-extract.ts";
import type { RenderCache } from "./mermaid-render.ts";

import { pickBestPreset } from "./mermaid-render.ts";

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

  await ctx.ui.custom<void>(
    (tui, theme, _kb, done) => {
      const viewer = new MermaidViewer(diagrams, startIndex, cache, theme, tui, done);
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

class MermaidViewer {
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
    private tui: { requestRender(): void },
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
