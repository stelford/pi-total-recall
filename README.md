# pi-total-recall

Durable, SQLite-backed "fact" memory for [Pi](https://github.com/earendil-works/pi).
Facts are captured at the end of every agent cycle and stored through a Python
[MCP](https://modelcontextprotocol.io) server built with
[FastMCP](https://github.com/jlowin/fastmcp). Later sessions can recall them.

The code is intentionally small so it can be read as a learning example of two
things at once:

- writing a Pi extension in TypeScript, and
- exposing a small Python tool surface over MCP with FastMCP.

## Architecture

```
Pi extension (TypeScript)              MCP server (Python)
extensions/total-recall.ts             server.py
  |  registers the server  ------------->  FastMCP "total-recall"
  |  agent_end -> store_fact  ---------->  store_fact(fact, tags, source)
  |  /recall -> retrieve_facts  -------->  retrieve_facts(query, limit)
  |  /recall-stats -> stats  ----------->  stats()
                                         |
                                         v
                                   facts.py  (plain sqlite3)
                                         |
                                         v
                                   ~/.pi/total-recall/facts.db
```

`facts.py` has no FastMCP import, so the storage layer is tested on its own.
`server.py` is a thin wrapper that exposes it as three MCP tools. The extension
talks to the server over stdio using `McpClient` + `StdioTransport` from
`@earendil-works/pi-mcp`.

## Requirements

- Python 3.10+ and [`uv`](https://docs.astral.sh/uv/)
- Node.js 20+ and `npm`
- Pi 1.3.0 or newer

## Setup

```bash
uv sync          # create .venv and install fastmcp + pytest
npm install      # install @earendil-works/pi-mcp, vitest, typescript
```

## The three MCP tools

The server exposes exactly three tools. Pi registers each as
`mcp__total-recall__<tool>` and this extension also declares them directly to
the model (`exposure: "direct"`).

| Tool | Arguments | Returns |
| --- | --- | --- |
| `store_fact` | `fact` (required), `tags`, `source` | `{ "id": <row id> }` |
| `retrieve_facts` | `query` (substring of fact or tags), `limit` (default 5) | newest-first list of `{ id, fact, tags, source, created_at }` |
| `stats` | none | `{ "total": <count> }` |

FastMCP wraps a list return value as `{ "result": [...] }`; the extension
normalizes that back to a list in `toolData()`.

## How storing works in Pi

Storage happens automatically at the end of each cycle, and on demand.

1. When a run finishes, Pi fires the `agent_end` event with the run's messages.
2. The extension calls `extractFacts(messages)` (a pure, unit-tested helper) to
   pull up to 3 non-empty user facts, newest first, deduplicated, each capped at
   500 characters.
3. For each fact it opens a short-lived MCP client, calls `store_fact` with
   `source: "auto"`, and closes the client. Failures only emit a warning; they
   never break the session.

The model can also store facts deliberately by calling the `store_fact` tool.

The `agent_end` handler never throws: a storage failure calls
`ctx.ui.notify(...)` and returns.

## How retrieval works in Pi

There are three retrieval paths:

- **`/recall <query>`** — runs `retrieve_facts` and prints the matching facts in
  the transcript. With no query it returns the most recent facts.
- **`/recall-stats`** — runs `stats` and reports the total number of facts.
- **Model tool calls** — because the server is registered with `direct`
  exposure, the model sees `mcp__total-recall__retrieve_facts` and
  `mcp__total-recall__stats` and can call them while reasoning.

`retrieve_facts` matches a substring against both the fact text and its tags,
and returns newest first.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `TOTAL_RECALL_DB` | `~/.pi/total-recall/facts.db` | SQLite database path. |
| `TOTAL_RECALL_PYTHON` | `<project>/.venv/bin/python` | Interpreter used to launch `server.py`. |

The extension also supports `extractFacts(messages, max)` in tests, and the
server accepts `limit` on `retrieve_facts`.

## Installing the extension in Pi

Add the extension to your Pi settings, for example in
`~/.pi/agent/settings.json`:

```json
{
  "extensions": ["/home/stef/work_folder_local/pi/pi-total-recall"]
}
```

Pi reads the `pi.extensions` field from `package.json`, so pointing at the
project directory is enough. After adding or changing it, run `/reload`.

## Tests (red/green TDD)

Every behavior was written as a failing test first, then implemented.

```bash
uv run pytest -q     # facts.py + server.py: store, retrieve, stats, errors
npm test             # extractFacts + live MCP round-trip over stdio
npm run typecheck    # tsc --noEmit
```

- `tests/test_facts.py` — store, empty-fact rejection, ordering, filtering,
  limit, stats, persistence, env-var path.
- `tests/test_server.py` — the three tools are listed and a store→stats
  round-trip works through FastMCP's in-memory client.
- `tests/extract.test.ts` — `extractFacts` ordering, filtering, dedupe, limit.
- `tests/mcp.integration.test.ts` — launches `server.py` over stdio with the same
  client and transport the extension uses.

## Limitations and notes

- `extractFacts` captures user messages verbatim. It is a learning-grade
  heuristic, not an LLM extraction step; facts can include anything the user
  typed. Avoid storing secrets, or add a redaction step.
- Retrieval is substring matching, not semantic search.
- Each command opens its own short-lived MCP client; simple, but not the most
  efficient for very large stores.
