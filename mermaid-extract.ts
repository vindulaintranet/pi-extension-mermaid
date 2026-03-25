export type MermaidBlock = {
  code: string;
  blockIndex: number;
  startLine: number;
  endLine: number;
};

export type MermaidContextSlice = {
  beforeLines: string[];
  afterLines: string[];
};

const OPENING_FENCE = /^\s*`{3,}\s*mermaid\b/i;
const CLOSING_FENCE = /^\s*`{3,}\s*$/;

export function extractMermaidBlocks(text: string, maxBlocks = 10): MermaidBlock[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MermaidBlock[] = [];
  let index = 0;

  while (index < lines.length && blocks.length < maxBlocks) {
    if (OPENING_FENCE.test(lines[index] ?? "")) {
      const startLine = index;
      index += 1;
      const codeLines: string[] = [];

      while (index < lines.length && !CLOSING_FENCE.test(lines[index] ?? "")) {
        codeLines.push(lines[index] ?? "");
        index += 1;
      }

      const endLine = index;
      const code = codeLines.join("\n").trimEnd();
      if (code.length > 0) {
        blocks.push({ code, blockIndex: blocks.length, startLine, endLine });
      }
    }

    index += 1;
  }

  return blocks;
}

export function captureContextSlice(
  text: string,
  block: MermaidBlock,
  radius = 5,
): MermaidContextSlice {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const beforeLines = lines.slice(Math.max(0, block.startLine - radius), block.startLine);
  const afterLines = lines.slice(
    block.endLine + 1,
    Math.min(lines.length, block.endLine + 1 + radius),
  );

  stripTrailingEmpty(beforeLines);
  stripTrailingEmpty(afterLines);

  return { beforeLines, afterLines };
}

export function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter(
        (part): part is { text: string } =>
          typeof part === "object" &&
          part !== null &&
          "text" in part &&
          typeof (part as { text?: unknown }).text === "string",
      )
      .map((part) => part.text)
      .join("\n");
  }
  return "";
}

function stripTrailingEmpty(lines: string[]): void {
  while (lines.length > 0 && (lines[lines.length - 1] ?? "").trim() === "") {
    lines.pop();
  }
}
