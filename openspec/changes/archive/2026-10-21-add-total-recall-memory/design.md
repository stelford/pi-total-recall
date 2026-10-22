# Design

## Context

See `proposal.md - Why` for motivation and `specs/` for the behavioral contract.

Pi extensions run TypeScript inside the Pi process and can register MCP servers with `pi.registerMcpServer(name, config)`. Pi's built-in MCP support then connects the server and exposes its tools to the model as `mcp__<server>__<tool>`. Event handlers receive a plain `ExtensionContext`, which does **not** include `executeTool()` — that helper exists only on the tool-execution context. The standalone `@earendil-works/pi-mcp` package ships an `McpClient` plus a `StdioTransport`, so the extension can speak MCP to the same server directly.

The host has Python 3.14 and `uv`, but no system `pip`. Tests must not require a running Pi process.

## Goals / Non-Goals

**Goals:**

- Keep the store logic, the MCP boundary, and the Pi integration independently testable.
- Keep the code small enough to read in one sitting as a learning example.
- Make the auto-capture path genuinely use MCP, not a direct database write.

**Non-Goals:**

- No LLM-based fact extraction or memory curation.
- No vector/semantic search; retrieval is substring matching.
- No migration, multi-user, or cross-machine sync story.
- No custom TUI components.

## Decisions

### Decision: Split `facts.py` (store) from `server.py` (MCP)

The store functions take a `sqlite3.Connection` and contain no FastMCP import, so `pytest` tests them directly. `server.py` is a thin FastMCP wrapper that reads the database path from `TOTAL_RECALL_DB` and delegates to `facts.py`.

- Why: TDD is fastest and clearest against plain functions; the MCP layer then only needs a small in-memory test.
- Alternative: define the `@mcp.tool()` functions directly over `sqlite3` in one file. Rejected — forces every test through FastMCP and mixes two concerns.

### Decision: Standard-library `sqlite3`, one table

A single `facts` table: `id INTEGER PRIMARY KEY AUTOINCREMENT`, `fact TEXT NOT NULL`, `tags TEXT NOT NULL DEFAULT ''`, `source TEXT NOT NULL DEFAULT ''`, `created_at TEXT NOT NULL DEFAULT (datetime('now'))`. Search uses `LIKE` over `fact` and `tags`.

- Why: zero extra dependencies and a schema small enough to explain in the README.
- Alternative: an ORM or FTS5. Rejected as unnecessary complexity for a learning project.

### Decision: Python MCP server via FastMCP over stdio

`server.py` runs `mcp.run()` (stdio). `facts.py` opens the database lazily per call so the server works whether or not the file exists yet.

- Why: FastMCP provides the MCP tool schema and JSON-RPC framing with minimal code.

### Decision: The extension both registers the server and uses its own MCP client

At load/session start the extension calls `pi.registerMcpServer("total-recall", ...)` so the model can call the tools. For automatic capture — a `turn_end`/`agent_end` handler has no `executeTool()` — the extension creates a short-lived `McpClient(new StdioTransport(...))`, calls `store_fact` for each extracted fact, and closes it.

- Why: the model-facing path and the automatic path both go through MCP, and the automatic path stays inside an event handler.
- Alternative: only register the server and ask the model to store facts. Rejected — that is not automatic and costs an extra model round-trip.
- Alternative: write to SQLite directly from TypeScript. Rejected — the task asks to use MCP.

### Decision: `agent_end` is "the end of a cycle"

A Pi *run* starts at input and ends at `agent_end`; `turn_end` fires per model turn. Memory is captured once per run.

- Why: matches the README vocabulary and avoids storing one fact per tool turn.
- Alternative: `turn_end`. Rejected as noisy.

### Decision: Deterministic extraction, not an LLM

`extractFacts(messages, max)` walks messages newest-first, takes non-empty user text, trims it, de-duplicates, and caps the count and length. This is a pure function with vitest tests.

- Why: no model access from inside the extension, and deterministic behavior is testable.
- Trade-off: captured memories are raw user statements rather than curated facts. The README documents that the model can call `store_fact` itself for richer facts.

### Decision: Python command is the project virtualenv

`uv sync` creates `.venv/`; the extension invokes `<project>/.venv/bin/python server.py`. `TOTAL_RECALL_PYTHON` and `TOTAL_RECALL_DB` override the interpreter and database path.

- Why: avoids `uv run --with` overhead on every cycle and keeps the server command explicit.

## Risks / Trade-offs

- [`@earendil-works/pi-mcp` is not a loader alias, unlike `pi-tui`] → Install it as a local project dependency; the extension resolves it from the project's `node_modules`.
- [Two connections open the same SQLite file] → SQLite serializes writes; the capture client is short-lived.
- [`.venv` missing when Pi loads the extension] → The extension catches connection failures, emits a notification, and leaves the session running.
- [Raw user messages are stored verbatim and may contain secrets] → The database lives outside version control; the README warns that capture is verbatim and the extension is easy to disable.
- [Python 3.14 is newer than some FastMCP pins] → Pin to a FastMCP line that supports 3.13+; `uv sync` fails loudly rather than silently.

## Migration Plan

New project: no migration. To roll back, unload the extension and delete the database file (`~/.pi/total-recall/facts.db` by default).

## Open Questions

- None blocking. Semantic search and an LLM extraction hook can be added later without changing the current specs.
