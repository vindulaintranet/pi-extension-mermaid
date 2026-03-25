import type { ExtensionContext, Theme } from "@mariozechner/pi-coding-agent";
import { execSync } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { Image, Key, getCapabilities, matchesKey, visibleWidth } from "@mariozechner/pi-tui";

import type { MermaidContextSlice } from "./mermaid-extract.ts";
import type { RenderCache } from "./mermaid-render.ts";

import { getSvgUrlWithCache, pickBestPreset, renderImageWithCache, renderSvgWithCache } from "./mermaid-render.ts";

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

  if (await openBrowserViewer(ctx, diagrams, startIndex, cache)) {
    return;
  }

  if (getCapabilities().images) {
    await openImageViewer(ctx, diagrams, startIndex, cache);
    return;
  }

  await openAsciiViewer(ctx, diagrams, startIndex, cache);
}

async function openBrowserViewer(
  ctx: ExtensionContext,
  diagrams: DiagramEntry[],
  focusIndex: number,
  cache: RenderCache,
): Promise<boolean> {
  try {
    const payload = diagrams.map((entry) => ({
      id: entry.id,
      source: entry.source,
      lines: `${entry.block.startLine}-${entry.block.endLine}`,
      before: summarizeContext(entry.context.beforeLines),
      after: summarizeContext(entry.context.afterLines),
      svg: renderSvgWithCache(cache, entry.block.code).svg,
    }));

    const html = buildBrowserViewerHtml(payload, focusIndex);
    const filePath = join(tmpdir(), `pi-mermaid-viewer-${Date.now()}.html`);
    await fs.writeFile(filePath, html, "utf8");

    const url = pathToFileURL(filePath).href;
    openExternal(url);
    ctx.ui.notify("opened Mermaid SVG viewer in browser", "info");
    return true;
  } catch {
    return false;
  }
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
  private currentImageKey?: string;

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
      this.currentImageKey = undefined;
      this.image = undefined;
    } else if (data === "]" || matchesKey(data, Key.tab)) {
      this.activeIndex = (this.activeIndex + 1) % this.diagrams.length;
      this.currentImageKey = undefined;
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
      this.theme.fg(
        "customMessageLabel",
        this.theme.bold(`mermaid ${this.activeIndex + 1}/${this.diagrams.length}`),
      ),
    );
    lines.push(this.theme.fg("dim", "browser viewer unavailable — showing terminal fallback"));

    const before = summarizeContext(entry.context.beforeLines);
    if (before) {
      lines.push(this.theme.fg("dim", truncate(before, width)));
    }

    const rendered = renderImageWithCache(this.cache, entry.block.code);
    const maxWidthCells = Math.max(32, Math.min(width - 2, 88));
    const imageKey = `${entry.id}:${maxWidthCells}`;
    if (!this.image || this.currentImageKey !== imageKey) {
      this.image = new Image(
        rendered.pngBase64,
        "image/png",
        {
          fallbackColor: (text: string) => this.theme.fg("dim", text),
        },
        {
          maxWidthCells,
          filename: `mermaid-${entry.id}.png`,
        },
        rendered.dimensions,
      );
      this.currentImageKey = imageKey;
    }

    lines.push(...this.image.render(width));
    lines.push(
      truncate(
        this.theme.fg(
          "accent",
          clickableOpenHint(getSvgUrlWithCache(this.cache, entry.block.code), getOpenHintLabel("abrir grande")),
        ),
        width,
      ),
    );

    const after = summarizeContext(entry.context.afterLines);
    if (after) {
      lines.push(this.theme.fg("dim", truncate(after, width)));
    }

    lines.push(this.theme.fg("dim", "[] prev/next • esc close"));
    this.cachedLines = lines;
    this.cachedWidth = width;
    return this.cachedLines;
  }

  invalidate(): void {
    this.cachedLines = undefined;
    this.cachedWidth = undefined;
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

function buildBrowserViewerHtml(
  diagrams: Array<{
    id: string;
    source: string;
    lines: string;
    before: string;
    after: string;
    svg: string;
  }>,
  focusIndex: number,
): string {
  const payload = JSON.stringify(diagrams);
  const safeIndex = Math.max(0, Math.min(focusIndex, diagrams.length - 1));

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pi Mermaid Viewer</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0b0f14;
      --panel: #11161d;
      --border: #243040;
      --fg: #e6edf3;
      --muted: #8b949e;
      --accent: #4493f8;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--fg);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 14px 18px;
      background: rgba(11, 15, 20, 0.92);
      border-bottom: 1px solid var(--border);
      backdrop-filter: blur(8px);
    }
    .meta { color: var(--muted); font-size: 13px; }
    .actions { display: flex; gap: 8px; }
    button {
      border: 1px solid var(--border);
      background: var(--panel);
      color: var(--fg);
      border-radius: 10px;
      padding: 8px 12px;
      cursor: pointer;
    }
    button:hover { border-color: var(--accent); }
    main {
      padding: 18px;
      display: grid;
      gap: 14px;
      grid-template-rows: auto auto 1fr auto;
      min-height: 0;
      flex: 1;
    }
    .card {
      border: 1px solid var(--border);
      background: var(--panel);
      border-radius: 14px;
      padding: 14px;
    }
    .context {
      white-space: pre-wrap;
      color: var(--muted);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 13px;
      line-height: 1.45;
    }
    .viewer {
      overflow: auto;
      min-height: 50vh;
      display: flex;
      align-items: flex-start;
      justify-content: center;
    }
    .viewer svg {
      max-width: none;
      height: auto;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
      border-radius: 12px;
    }
    .hint {
      color: var(--muted);
      font-size: 13px;
    }
  </style>
</head>
<body>
  <header>
    <div>
      <div id="title">Mermaid</div>
      <div id="meta" class="meta"></div>
    </div>
    <div class="actions">
      <button id="prev">← Prev</button>
      <button id="next">Next →</button>
    </div>
  </header>
  <main>
    <div id="before" class="card context"></div>
    <div class="card viewer"><div id="svg-host"></div></div>
    <div id="after" class="card context"></div>
    <div class="hint">Use ←/→ or [ ] to navigate. Scroll inside the SVG panel for large diagrams.</div>
  </main>
  <script>
    const diagrams = ${payload};
    let index = ${safeIndex};
    const title = document.getElementById('title');
    const meta = document.getElementById('meta');
    const before = document.getElementById('before');
    const after = document.getElementById('after');
    const host = document.getElementById('svg-host');

    function render() {
      const current = diagrams[index];
      title.textContent = 'Mermaid ' + (index + 1) + '/' + diagrams.length;
      meta.textContent = current.source + ' • lines ' + current.lines;
      before.textContent = current.before || 'No preceding context.';
      after.textContent = current.after || 'No following context.';
      host.innerHTML = current.svg;
      history.replaceState(null, '', '#diagram-' + (index + 1));
    }

    function move(delta) {
      index = (index + delta + diagrams.length) % diagrams.length;
      render();
    }

    document.getElementById('prev').addEventListener('click', () => move(-1));
    document.getElementById('next').addEventListener('click', () => move(1));
    window.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft' || event.key === '[') move(-1);
      if (event.key === 'ArrowRight' || event.key === ']') move(1);
    });

    render();
  </script>
</body>
</html>`;
}

function openExternal(url: string): void {
  if (process.platform === "darwin") {
    execSync(`open "${url}"`);
    return;
  }
  if (process.platform === "linux") {
    execSync(`xdg-open "${url}"`);
    return;
  }
  if (process.platform === "win32") {
    execSync(`start "" "${url}"`);
    return;
  }
  throw new Error(`unsupported platform: ${process.platform}`);
}

function summarizeContext(lines: string[]): string {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, 2000);
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

function clickableOpenHint(url: string, label: string): string {
  return `\u001b]8;;${url}\u0007${label}\u001b]8;;\u0007`;
}

function getOpenHintLabel(action: string): string {
  const modifier = process.platform === "darwin" ? "Cmd+click" : "Ctrl+click";
  return `${modifier} ${action}`;
}
