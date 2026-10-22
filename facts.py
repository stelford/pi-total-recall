"""SQLite-backed fact store for pi-total-recall.

This module deliberately has no FastMCP import so the store can be tested on
its own. `server.py` wraps these functions as MCP tools.
"""

from __future__ import annotations

import os
import sqlite3
from pathlib import Path

DEFAULT_DB_PATH = Path.home() / ".pi" / "total-recall" / "facts.db"

_SCHEMA = """
CREATE TABLE IF NOT EXISTS facts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fact TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"""


def default_db_path() -> Path:
    """Database path, overridable with the TOTAL_RECALL_DB environment variable."""
    return Path(os.environ.get("TOTAL_RECALL_DB", DEFAULT_DB_PATH)).expanduser()


def connect(db_path: str | Path | None = None) -> sqlite3.Connection:
    """Open (and create the parent directory for) the fact database."""
    path = Path(db_path).expanduser() if db_path is not None else default_db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    """Create the facts table if it does not exist yet."""
    conn.executescript(_SCHEMA)
    conn.commit()


def store_fact(
    conn: sqlite3.Connection, fact: str, tags: str = "", source: str = ""
) -> int:
    """Store one fact and return its row id. Empty facts are rejected."""
    text = (fact or "").strip()
    if not text:
        raise ValueError("fact must not be empty")
    cursor = conn.execute(
        "INSERT INTO facts (fact, tags, source) VALUES (?, ?, ?)",
        (text, tags.strip(), source.strip()),
    )
    conn.commit()
    fact_id = cursor.lastrowid
    if fact_id is None:
        raise RuntimeError("failed to store fact")
    return fact_id


def retrieve_facts(
    conn: sqlite3.Connection, query: str = "", limit: int = 5
) -> list[dict]:
    """Return facts newest first, optionally filtered by a substring match."""
    if query and query.strip():
        pattern = f"%{query.strip()}%"
        rows = conn.execute(
            "SELECT id, fact, tags, source, created_at FROM facts"
            " WHERE fact LIKE ? OR tags LIKE ?"
            " ORDER BY id DESC LIMIT ?",
            (pattern, pattern, limit),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT id, fact, tags, source, created_at FROM facts"
            " ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return [dict(row) for row in rows]


def stats(conn: sqlite3.Connection) -> dict:
    """Return simple statistics about the store."""
    total = conn.execute("SELECT COUNT(*) FROM facts").fetchone()[0]
    return {"total": total}
