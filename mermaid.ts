import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Image, getCapabilities, truncateToWidth } from "@mariozechner/pi-tui";

import {
  captureContextSlice,
  extractMermaidBlocks,
  extractText,
  type MermaidBlock,
} from "./mermaid-extract.ts";
import {
  createCache,
  getSvgUrlWithCache,
  hashCode,
  pickBestPreset,
  renderImageWithCache,
  type RenderCache,
} from "./mermaid-render.ts";
import { openMermaidDiagram, openMermaidViewer, type DiagramEntry } from "./mermaid-viewer.ts";

const CUSTOM_TYPE = "pi-extension-mermaid";
const MAX_CODE_LENGTH = 20_000;
const MAX_DIAGRAMS = 100;
const INLINE_MAX_WIDTH_CELLS = 72;

export default function mermaidInlineExtension(pi: ExtensionAPI) {
  const cache: RenderCache = createCache();
  let diagrams: DiagramEntry[] = [];

  pi.registerMessageRenderer(CUSTOM_TYPE, (message, _options, theme) => {
    const entry = message.details as DiagramEntry | undefined;
    let imageComponent: Image | undefined;
    let currentImageKey: string | undefined;

    return {
      render(width: number): string[] {
        if (!entry?.block?.code) {
          return [truncateToWidth(theme.fg("dim", "diagram not found"), width)];
        }

        try {
          const label = truncateToWidth(
            theme.fg("customMessageLabel", theme.bold("mermaid")),
            width,
          );

          if (getCapabilities().images) {
            const renderedImage = renderImageWithCache(cache, entry.block.code);
            const maxWidthCells = Math.max(24, Math.min(INLINE_MAX_WIDTH_CELLS, width - 2));
            const imageKey = `${entry.id}:${maxWidthCells}`;
            if (!imageComponent || currentImageKey !== imageKey) {
              imageComponent = new Image(
                renderedImage.pngBase64,
                "image/png",
                {
                  fallbackColor: (text: string) => theme.fg("dim", text),
                },
                {
                  maxWidthCells,
                  filename: `mermaid-${entry.id}.png`,
                },
                renderedImage.dimensions,
              );
              currentImageKey = imageKey;
            }

            const svgUrl = getSvgUrlWithCache(cache, entry.block.code);
            return [
              label,
              ...imageComponent.render(width),
              truncateToWidth(
                theme.fg("accent", clickableOpenHint(svgUrl, getOpenHintLabel("abrir grande"))),
                width,
              ),
              truncateToWidth(theme.fg("dim", "/mermaid-open • /mermaid • ctrl+shift+m"), width),
            ];
          }

          const { preset, rendered, overflowed } = pickBestPreset(cache, entry.block.code, width);
          const lines: string[] = [
            overflowed
              ? `${label} ${theme.fg("dim", `[${preset.key}]`)}`
              : label,
            ...rendered.lines,
            theme.fg(
              "dim",
              overflowed
                ? "fallback ASCII — use /mermaid-open or /mermaid"
                : "ASCII fallback — terminal image protocol unavailable",
            ),
          ];
          return lines.map((line) => truncateToWidth(line, width));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return [truncateToWidth(theme.fg("dim", `render error: ${message}`), width)];
        }
      },
      invalidate() {},
    };
  });

  pi.on("agent_end", async (event) => {
    const pendingDisplay: DiagramEntry[] = [];

    for (const message of event.messages as Array<{ role?: string; customType?: string; content?: unknown }>) {
      if (message.role !== "assistant") continue;
      if (message.customType === CUSTOM_TYPE) continue;

      const text = extractText(message.content);
      if (!text) continue;

      const blocks = extractMermaidBlocks(text);
      for (const block of blocks) {
        if (block.code.length > MAX_CODE_LENGTH) continue;
        const entry = createDiagramEntry(text, block, "assistant");
        if (addDiagram(entry)) {
          pendingDisplay.push(entry);
        }
      }
    }

    if (pendingDisplay.length === 0) return;

    setTimeout(() => {
      for (const entry of pendingDisplay) {
        pushDiagramMessage(pi, entry);
      }
    }, 0);
  });

  pi.on("input", async (event) => {
    if (event.source === "extension") return { action: "continue" as const };

    const text = typeof event.text === "string" ? event.text : "";
    if (!text) return { action: "continue" as const };

    const blocks = extractMermaidBlocks(text);
    if (blocks.length === 0) return { action: "continue" as const };

    for (const block of blocks) {
      if (block.code.length > MAX_CODE_LENGTH) continue;
      const entry = createDiagramEntry(text, block, "user");
      addDiagram(entry);
    }

    return { action: "continue" as const };
  });

  pi.on("context", async (event) => ({
    messages: event.messages.filter(
      (message: { customType?: string }) => message.customType !== CUSTOM_TYPE,
    ),
  }));

  pi.on("session_switch", async () => {
    diagrams = [];
  });

  pi.registerShortcut("ctrl+shift+m", {
    description: "View Mermaid diagrams",
    handler: async (ctx) => {
      ensureDiagramsLoaded(ctx);
      if (diagrams.length === 0) {
        if (ctx.hasUI) ctx.ui.notify("no mermaid diagrams in session", "info");
        return;
      }
      await openMermaidViewer({ ctx, diagrams, cache });
    },
  });

  pi.registerCommand("mermaid", {
    description: "Open Mermaid diagram viewer",
    handler: async (_args, ctx) => {
      ensureDiagramsLoaded(ctx);
      if (diagrams.length === 0) {
        if (ctx.hasUI) ctx.ui.notify("no mermaid diagrams in session", "info");
        return;
      }
      await openMermaidViewer({ ctx, diagrams, cache });
    },
  });

  pi.registerCommand("mermaid-open", {
    description: "Open the latest Mermaid diagram directly in the browser",
    handler: async (_args, ctx) => {
      ensureDiagramsLoaded(ctx);
      const latest = diagrams.at(-1);
      if (!latest) {
        if (ctx.hasUI) ctx.ui.notify("no mermaid diagrams in session", "info");
        return;
      }
      await openMermaidDiagram({ ctx, entry: latest, cache });
    },
  });

  function createDiagramEntry(
    text: string,
    block: MermaidBlock,
    source: DiagramEntry["source"],
  ): DiagramEntry {
    const context = captureContextSlice(text, block, 5);
    const id = `${Date.now()}:${block.blockIndex}:${hashCode(block.code)}`;
    return { id, block, context, source };
  }

  function addDiagram(entry: DiagramEntry): boolean {
    const signature = diagramSignature(entry);
    if (diagrams.some((existing) => diagramSignature(existing) === signature)) {
      return false;
    }
    diagrams = [...diagrams, entry].slice(-MAX_DIAGRAMS);
    return true;
  }

  function pushDiagramMessage(extension: ExtensionAPI, entry: DiagramEntry): void {
    extension.sendMessage({
      customType: CUSTOM_TYPE,
      content: "",
      display: true,
      details: entry,
    });
  }

  function ensureDiagramsLoaded(ctx: ExtensionContext): void {
    if (diagrams.length > 0) return;

    const restored = new Map<string, DiagramEntry>();
    const entries = ctx.sessionManager.getBranch();

    for (const entry of entries) {
      if (entry.type !== "message") continue;
      const message = entry.message as { customType?: string; details?: unknown };
      if (message.customType === CUSTOM_TYPE && isDiagramEntry(message.details)) {
        restored.set(diagramSignature(message.details), message.details);
      }
    }

    for (const entry of entries) {
      if (entry.type !== "message") continue;

      const message = entry.message as {
        role?: string;
        content?: unknown;
      };

      if (message.role !== "assistant" && message.role !== "user") continue;

      const text = extractText(message.content);
      if (!text) continue;

      const blocks = extractMermaidBlocks(text);
      for (const block of blocks) {
        if (block.code.length > MAX_CODE_LENGTH) continue;
        const candidate: DiagramEntry = {
          id: `${entry.id}:${block.blockIndex}:${hashCode(block.code)}`,
          block,
          context: captureContextSlice(text, block, 5),
          source: message.role,
        };
        const signature = diagramSignature(candidate);
        if (restored.has(signature)) continue;
        restored.set(signature, candidate);
      }
    }

    diagrams = Array.from(restored.values()).slice(-MAX_DIAGRAMS);
  }
}

function diagramSignature(entry: DiagramEntry): string {
  return JSON.stringify({
    source: entry.source,
    code: entry.block.code,
    beforeLines: entry.context.beforeLines,
    afterLines: entry.context.afterLines,
  });
}

function isDiagramEntry(value: unknown): value is DiagramEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<DiagramEntry>;
  return (
    typeof entry.id === "string" &&
    Boolean(entry.block) &&
    typeof entry.block?.code === "string" &&
    typeof entry.block?.blockIndex === "number" &&
    typeof entry.block?.startLine === "number" &&
    typeof entry.block?.endLine === "number" &&
    Boolean(entry.context) &&
    Array.isArray(entry.context?.beforeLines) &&
    Array.isArray(entry.context?.afterLines) &&
    (entry.source === "assistant" || entry.source === "user" || entry.source === "command")
  );
}

function clickableOpenHint(url: string, label: string): string {
  return `\u001b]8;;${url}\u0007${label}\u001b]8;;\u0007`;
}

function getOpenHintLabel(action: string): string {
  const modifier = process.platform === "darwin" ? "Cmd+click" : "Ctrl+click";
  return `${modifier} ${action}`;
}
