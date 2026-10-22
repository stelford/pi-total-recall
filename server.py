"""FastMCP server exposing the SQLite-backed fact store over stdio.

Run directly (`uv run python server.py`) or via Pi's MCP configuration. The
database path comes from the TOTAL_RECALL_DB environment variable, falling
back to ~/.pi/total-recall/facts.db.
"""

from __future__ import annotations

import sqlite3

from fastmcp import FastMCP

import facts

mcp = FastMCP(
    "total-recall",
    instructions=(
        "Durable fact memory for Pi. Use store_fact to remember a fact, "
        "retrieve_facts to recall matching facts, and stats to count them."
    ),
)


def _connection() -> sqlite3.Connection:
    conn = facts.connect()
    facts.init_db(conn)
    return conn


@mcp.tool
def store_fact(fact: str, tags: str = "", source: str = "") -> dict:
    """Store one durable fact. Returns the new fact's id."""
    conn = _connection()
    try:
        fact_id = facts.store_fact(conn, fact, tags, source)
    finally:
        conn.close()
    return {"id": fact_id}


@mcp.tool
def retrieve_facts(query: str = "", limit: int = 5) -> list[dict]:
    """Return stored facts newest first, optionally filtered by a substring."""
    conn = _connection()
    try:
        return facts.retrieve_facts(conn, query, limit)
    finally:
        conn.close()


@mcp.tool
def stats() -> dict:
    """Return the number of stored facts."""
    conn = _connection()
    try:
        return facts.stats(conn)
    finally:
        conn.close()


def main() -> None:
    """Run the server on stdio (the transport Pi uses for local MCP servers)."""
    mcp.run()


if __name__ == "__main__":
    main()
