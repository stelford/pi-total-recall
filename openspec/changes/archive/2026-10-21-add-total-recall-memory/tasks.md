# Tasks

## 1. Scaffolding and dependencies

- [x] 1.1 Create `pyproject.toml` with `fastmcp` and `pytest` dependencies; verify `uv sync` completes and `.venv/bin/python` exists.
- [x] 1.2 Create `package.json`, `tsconfig.json`, and `.gitignore`; add `@earendil-works/pi-mcp`, `vitest`, and `typescript`; verify `npm install` completes and `node_modules/@earendil-works/pi-mcp` exists.

## 2. SQLite fact store (red → green)

- [x] 2.1 Write failing pytest tests in `tests/test_facts.py` covering store, retrieve (newest-first, query filter, limit), stats, empty-fact rejection, and persistence across connections; verify `uv run pytest` fails for the missing `facts.py` functions.
- [x] 2.2 Implement `facts.py` using the standard-library `sqlite3` module; verify `uv run pytest` passes (green).
- [x] 2.3 Verify the `TOTAL_RECALL_DB` path is honored by pointing a test at a temporary path and re-reading the fact from a fresh connection.

## 3. FastMCP server

- [x] 3.1 Write a failing in-memory FastMCP test in `tests/test_server.py` asserting `store_fact`, `retrieve_facts`, and `stats` are listed and that a store-then-stats round trip increments the count; verify it fails before `server.py` exists.
- [x] 3.2 Implement `server.py` wrapping `facts.py` in FastMCP tools with the database path from `TOTAL_RECALL_DB`; verify `uv run pytest` passes and `uv run python server.py` starts and waits on stdio.

## 4. Pi extension (red → green)

- [x] 4.1 Write failing vitest tests in `tests/extract.test.ts` for `extractFacts` (newest-first, non-empty only, dedupe, limit); verify `npm test` fails.
- [x] 4.2 Implement `extractFacts` in `extensions/total-recall.ts`; verify `npm test` passes (green).
- [x] 4.3 Implement the extension factory: `pi.registerMcpServer("total-recall", ...)` for the model, `agent_end` capture through an `McpClient`/`StdioTransport`, and `/recall` / `/recall-stats` commands; verify `npm run typecheck` passes.
- [x] 4.4 Add an integration test that launches the server through `StdioTransport` and calls `store_fact` then `stats`; verify it passes and the count increases.

## 5. Documentation

- [x] 5.1 Write `README.md` covering install (`uv sync`, `npm install`), how facts are stored (MCP `store_fact`, automatic `agent_end` capture), how retrieval works in Pi (model calls `retrieve_facts`, `/recall`, `/recall-stats`), configuration, and TDD commands; verify each documented command runs as written.
- [x] 5.2 Document the `TOTAL_RECALL_DB` and `TOTAL_RECALL_PYTHON` environment variables and the default database path; verify the README matches the code defaults.

## Workflow follow-up

- Run `openspec validate add-total-recall-memory --strict` and resolve any issues.
- Archive the completed change so the capability specs move into `openspec/specs/`.
