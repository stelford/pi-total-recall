/**
 * pi-total-recall — Pi extension for durable, SQLite-backed fact memory.
 *
 * At the end of every agent cycle (`agent_end`) the extension extracts short
 * facts from the run and stores them through the FastMCP server over MCP. It
 * also registers that server so the model can call `store_fact`,
 * `retrieve_facts`, and `stats` directly, and adds `/recall` and
 * `/recall-stats` commands.
 */

import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { McpClient, StdioTransport, type CallToolResult } from "@earendil-works/pi-mcp";

import type {
  AgentMessage,
  ExtensionAPI,
  ExtensionContext,
} from "./pi-types";

const SERVER_NAME = "total-recall";
const DEFAULT_MAX_FACTS = 3;
const MAX_FACT_LENGTH = 500;
const RETRIEVAL_LIMIT = 5;

/**
 * Pure helper: pick up to `max` non-empty user facts, newest first, deduped.
 * Kept separate from the MCP/extension wiring so it is easy to unit test.
 */
export function extractFacts(
  messages: readonly AgentMessage[],
  max: number = DEFAULT_MAX_FACTS,
): string[] {
  const facts: string[] = [];
  const seen = new Set<string>();
  for (let index = messages.length - 1; index >= 0 && facts.length < max; index -= 1) {
    const text = messageText(messages[index]).trim();
    if (!text) continue;
    const fact = text.slice(0, MAX_FACT_LENGTH);
    if (seen.has(fact)) continue;
    seen.add(fact);
    facts.push(fact);
  }
  return facts;
}

function messageText(message: AgentMessage | undefined): string {
  if (!message || message.role !== "user") return "";
  const { content } = message;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map(partText)
    .filter((text) => text.length > 0)
    .join(" ");
}

function partText(part: unknown): string {
  if (part && typeof part === "object" && (part as { type?: unknown }).type === "text") {
    const text = (part as { text?: unknown }).text;
    return typeof text === "string" ? text : "";
  }
  return "";
}

function projectRoot(): string {
  try {
    return resolve(dirname(fileURLToPath(import.meta.url)), "..");
  } catch {
    return process.cwd();
  }
}

function pythonCommand(): string {
  return process.env.TOTAL_RECALL_PYTHON ?? resolve(projectRoot(), ".venv", "bin", "python");
}

function databasePath(): string {
  return process.env.TOTAL_RECALL_DB ?? resolve(homedir(), ".pi", "total-recall", "facts.db");
}

/** Run `fn` against a short-lived MCP client connected to the Python server. */
async function withClient<T>(fn: (client: McpClient) => Promise<T>): Promise<T> {
  const root = projectRoot();
  const client = new McpClient({ name: "total-recall-extension", version: "0.1.0" });
  await client.connect(
    new StdioTransport({
      command: pythonCommand(),
      args: [resolve(root, "server.py")],
      cwd: root,
      env: { TOTAL_RECALL_DB: databasePath() },
      inheritEnv: true,
      stderr: "pipe",
    }),
  );
  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

export interface FactRow {
  fact?: string;
  tags?: string;
  source?: string;
  created_at?: string;
}

/** Structured payload returned by a total-recall tool. */
export type ToolPayload = FactRow[] | { total: number } | undefined;

/**
 * FastMCP returns a list result as `{ result: [...] }` (structured) or as a
 * JSON array in a text block. Normalize both shapes to a plain payload.
 */
function normalizePayload(value: unknown): ToolPayload {
  if (Array.isArray(value)) return value as FactRow[];
  if (value && typeof value === "object") {
    const record = value as { result?: unknown; total?: unknown };
    if (Array.isArray(record.result)) return record.result as FactRow[];
    if (typeof record.total === "number") return { total: record.total };
  }
  return undefined;
}

function parseText(content?: Array<{ type?: string; text?: string }>): ToolPayload {
  const text = content?.find((block) => block.type === "text")?.text;
  if (!text) return undefined;
  try {
    return normalizePayload(JSON.parse(text));
  } catch {
    return undefined;
  }
}

function toolData(result: CallToolResult): ToolPayload {
  const record = result as {
    data?: unknown;
    structuredContent?: unknown;
    structured_content?: unknown;
    content?: Array<{ type?: string; text?: string }>;
  };
  const value =
    record.data ?? record.structuredContent ?? record.structured_content ?? parseText(record.content);
  return normalizePayload(value);
}

function formatFacts(result: CallToolResult): string {
  const data = toolData(result);
  if (!Array.isArray(data) || data.length === 0) return "No matching facts.";
  return data.map((row) => `- ${String(row.fact ?? row)}`).join("\n");
}

function extractTotal(result: CallToolResult): number {
  const data = toolData(result);
  if (data && !Array.isArray(data) && typeof data.total === "number") return data.total;
  return 0;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function notify(
  ctx: ExtensionContext,
  message: string,
  level: "info" | "warning" | "error",
): void {
  ctx.ui?.notify?.(message, level);
}

export default function totalRecall(pi: ExtensionAPI): void {
  pi.registerMcpServer(SERVER_NAME, {
    command: pythonCommand(),
    args: [resolve(projectRoot(), "server.py")],
    cwd: projectRoot(),
    env: { TOTAL_RECALL_DB: databasePath() },
    exposure: "direct",
    description: "Durable SQLite fact memory: store_fact, retrieve_facts, stats.",
  });

  pi.on("agent_end", async (event, ctx) => {
    const facts = extractFacts(event.messages ?? []);
    if (facts.length === 0) return;
    try {
      await withClient(async (client) => {
        for (const fact of facts) {
          await client.callTool("store_fact", { fact, source: "auto" });
        }
      });
    } catch (error) {
      notify(ctx, `total-recall capture failed: ${errorText(error)}`, "warning");
    }
  });

  pi.registerCommand("recall", {
    description: "Recall stored facts matching a query",
    handler: async (args, ctx) => {
      try {
        const result = await withClient((client) =>
          client.callTool("retrieve_facts", { query: args.trim(), limit: RETRIEVAL_LIMIT }),
        );
        notify(ctx, formatFacts(result), "info");
      } catch (error) {
        notify(ctx, `recall failed: ${errorText(error)}`, "error");
      }
    },
  });

  pi.registerCommand("recall-stats", {
    description: "Show how many facts are stored",
    handler: async (_args, ctx) => {
      try {
        const result = await withClient((client) => client.callTool("stats", {}));
        notify(ctx, `total-recall: ${extractTotal(result)} fact(s) stored`, "info");
      } catch (error) {
        notify(ctx, `recall-stats failed: ${errorText(error)}`, "error");
      }
    },
  });
}
