# Proposal

## Why

Pi sessions are stateless: durable facts learned during a cycle are lost when the session ends, and the model cannot recall earlier decisions in later sessions. pi-total-recall adds a small, inspectable SQLite fact store exposed over MCP and a pi extension that captures facts at the end of every cycle.

## What Changes

- Add a Python FastMCP server (`facts.py` + `server.py`) exposing three MCP tools over stdio:
  - `store_fact(fact, tags="", source="")` — persist one fact.
  - `retrieve_facts(query="", limit=5)` — return facts, newest first, optionally filtered by a substring.
  - `stats()` — return the number of stored facts.
- Back the server with the Python standard-library `sqlite3` module and a configurable database path (`TOTAL_RECALL_DB`).
- Add a pi extension (`extensions/total-recall.ts`) that:
  - registers the FastMCP server as an MCP server for the current session so the model can call `store_fact`, `retrieve_facts`, and `stats` directly;
  - connects to the same server over MCP at the end of each agent cycle (`agent_end`) and stores facts extracted from the run;
  - adds `/recall <query>` and `/recall-stats` commands.
- Add test-first coverage: `pytest` for the store logic and the in-memory MCP server, `vitest` for the pure fact-extraction helper.
- Add project scaffolding and docs: `README.md`, `pyproject.toml`, `package.json`, `tsconfig.json`, `.gitignore`.

## Capabilities

### New Capabilities
- `fact-store`: the SQLite-backed fact store and its MCP tool contract (`store_fact`, `retrieve_facts`, `stats`), including persistence and query behavior.
- `cycle-capture`: the pi extension behavior that registers the MCP server, captures facts at the end of each agent cycle, and exposes recall commands.

### Modified Capabilities
- None. This is a new project with no existing specs.

## Impact

- New Python runtime dependency: `fastmcp` (installed with `uv`).
- New Node development dependency: `@earendil-works/pi-mcp` for the extension's MCP client.
- New files only; no existing code, APIs, or systems are modified.
- Local data file: a SQLite database (default `~/.pi/total-recall/facts.db`), excluded from version control.
