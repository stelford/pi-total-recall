/**
 * Integration test: launch the FastMCP Python server over stdio with the same
 * client and transport the Pi extension uses, then round-trip a fact.
 *
 * Skips when the project virtualenv is missing so a fresh checkout still runs.
 */

import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { McpClient, StdioTransport } from "@earendil-works/pi-mcp";
import { describe, expect, it } from "vitest";

import type { FactRow, ToolPayload } from "../extensions/total-recall";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const python =
  process.env.TOTAL_RECALL_PYTHON ?? resolve(projectRoot, ".venv", "bin", "python");
const server = resolve(projectRoot, "server.py");

function normalize(value: unknown): ToolPayload {
  if (Array.isArray(value)) return value as FactRow[];
  if (value && typeof value === "object") {
    const record = value as { result?: unknown; total?: unknown };
    if (Array.isArray(record.result)) return record.result as FactRow[];
    if (typeof record.total === "number") return { total: record.total };
  }
  return undefined;
}

function payload(result: {
  data?: unknown;
  structuredContent?: unknown;
  structured_content?: unknown;
  content?: Array<{ type?: string; text?: string }>;
}): ToolPayload {
  const text = result.content?.find((block) => block.type === "text")?.text;
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = undefined;
  }
  return normalize(
    result.data ?? result.structuredContent ?? result.structured_content ?? parsed,
  );
}

describe.skipIf(!existsSync(python))("total-recall MCP server", () => {
  it(
    "lists the expected tools and round-trips a stored fact",
    async () => {
      const dir = mkdtempSync(join(tmpdir(), "total-recall-"));
      const client = new McpClient({ name: "vitest", version: "0.1.0" });
      await client.connect(
        new StdioTransport({
          command: python,
          args: [server],
          cwd: projectRoot,
          env: { TOTAL_RECALL_DB: join(dir, "facts.db") },
          inheritEnv: true,
          stderr: "pipe",
        }),
      );
      try {
        const names = (await client.listTools()).map((tool) => tool.name);
        expect(names).toEqual(
          expect.arrayContaining(["store_fact", "retrieve_facts", "stats"]),
        );

        await client.callTool("store_fact", { fact: "integration works", source: "vitest" });
        const stats = payload(await client.callTool("stats", {}));
        expect(stats).toEqual({ total: 1 });

        const facts = payload(await client.callTool("retrieve_facts", { query: "integration" }));
        expect(facts).toEqual([expect.objectContaining({ fact: "integration works" })]);
      } finally {
        await client.close();
      }
    },
    30_000,
  );
});
