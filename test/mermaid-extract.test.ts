import assert from "node:assert/strict";
import test from "node:test";

import {
  captureContextSlice,
  extractMermaidBlocks,
  extractText,
} from "../mermaid-extract.ts";

test("extractMermaidBlocks finds multiple mermaid fenced blocks", () => {
  const text = [
    "Intro",
    "```mermaid",
    "flowchart LR",
    "  A --> B",
    "```",
    "Middle",
    "```mermaid",
    "sequenceDiagram",
    "  Alice->>Bob: hi",
    "```",
  ].join("\n");

  const blocks = extractMermaidBlocks(text);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0]?.code, ["flowchart LR", "  A --> B"].join("\n"));
  assert.equal(blocks[1]?.code, ["sequenceDiagram", "  Alice->>Bob: hi"].join("\n"));
});

test("captureContextSlice keeps nearby non-empty context", () => {
  const text = [
    "before 1",
    "before 2",
    "",
    "```mermaid",
    "flowchart LR",
    "  A --> B",
    "```",
    "",
    "after 1",
    "after 2",
  ].join("\n");

  const [block] = extractMermaidBlocks(text);
  assert.ok(block);

  const context = captureContextSlice(text, block, 3);
  assert.deepEqual(context.beforeLines, ["before 1", "before 2"]);
  assert.deepEqual(context.afterLines, ["", "after 1", "after 2"]);
});

test("extractText joins text parts and ignores non-text content", () => {
  const content = [
    { type: "text", text: "hello" },
    { type: "image", source: { type: "base64", data: "abc" } },
    { type: "text", text: "world" },
  ];

  assert.equal(extractText(content), "hello\nworld");
  assert.equal(extractText("plain text"), "plain text");
  assert.equal(extractText(null), "");
});
