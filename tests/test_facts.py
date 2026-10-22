"""Tests for the SQLite fact store (facts.py).

These are written before the implementation: they fail until facts.py exists.
"""

import facts
import pytest


def make_conn(tmp_path):
    conn = facts.connect(tmp_path / "facts.db")
    facts.init_db(conn)
    return conn


def test_store_returns_id_and_persists(tmp_path):
    conn = make_conn(tmp_path)
    fact_id = facts.store_fact(conn, "The sky is blue", tags="earth", source="test")
    assert isinstance(fact_id, int)
    assert fact_id > 0
    rows = facts.retrieve_facts(conn)
    assert [row["fact"] for row in rows] == ["The sky is blue"]


def test_store_rejects_empty_fact(tmp_path):
    conn = make_conn(tmp_path)
    with pytest.raises(ValueError):
        facts.store_fact(conn, "   ")
    assert facts.stats(conn)["total"] == 0


def test_retrieve_returns_newest_first(tmp_path):
    conn = make_conn(tmp_path)
    facts.store_fact(conn, "first")
    facts.store_fact(conn, "second")
    assert [row["fact"] for row in facts.retrieve_facts(conn)] == ["second", "first"]


def test_retrieve_filters_on_text_or_tags(tmp_path):
    conn = make_conn(tmp_path)
    facts.store_fact(conn, "Pi talks over MCP", tags="pi")
    facts.store_fact(conn, "unrelated", tags="other")
    assert [row["fact"] for row in facts.retrieve_facts(conn, query="mcp")] == [
        "Pi talks over MCP"
    ]
    assert [row["fact"] for row in facts.retrieve_facts(conn, query="other")] == [
        "unrelated"
    ]


def test_retrieve_respects_limit(tmp_path):
    conn = make_conn(tmp_path)
    for index in range(5):
        facts.store_fact(conn, f"fact {index}")
    assert len(facts.retrieve_facts(conn, limit=2)) == 2


def test_stats_counts_facts(tmp_path):
    conn = make_conn(tmp_path)
    assert facts.stats(conn)["total"] == 0
    facts.store_fact(conn, "a")
    facts.store_fact(conn, "b")
    assert facts.stats(conn)["total"] == 2


def test_persistence_across_connections(tmp_path):
    path = tmp_path / "facts.db"
    first = facts.connect(path)
    facts.init_db(first)
    facts.store_fact(first, "durable")
    first.close()

    second = facts.connect(path)
    facts.init_db(second)
    assert [row["fact"] for row in facts.retrieve_facts(second)] == ["durable"]


def test_env_var_selects_database_path(tmp_path, monkeypatch):
    target = tmp_path / "env" / "facts.db"
    monkeypatch.setenv("TOTAL_RECALL_DB", str(target))
    assert facts.default_db_path() == target
