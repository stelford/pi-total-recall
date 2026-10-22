"""MCP-level tests for server.py, written before the server existed.

They use FastMCP's in-memory client, so no subprocess is needed.
"""

import asyncio
import json

from fastmcp import Client


def _payload(result):
    """Return a tool result's structured data across FastMCP/mcp versions."""
    data = getattr(result, "data", None)
    if data is not None:
        return data
    structured = getattr(result, "structured_content", None) or getattr(
        result, "structuredContent", None
    )
    if structured is not None:
        return structured
    return json.loads(result.content[0].text)


def test_expected_tools_are_listed(tmp_path, monkeypatch):
    monkeypatch.setenv("TOTAL_RECALL_DB", str(tmp_path / "facts.db"))
    import server

    async def scenario():
        async with Client(server.mcp) as client:
            return {tool.name for tool in await client.list_tools()}

    assert {"store_fact", "retrieve_facts", "stats"} <= asyncio.run(scenario())


def test_store_then_stats_round_trip(tmp_path, monkeypatch):
    monkeypatch.setenv("TOTAL_RECALL_DB", str(tmp_path / "facts.db"))
    import server

    async def scenario():
        async with Client(server.mcp) as client:
            await client.call_tool("store_fact", {"fact": "Pi uses MCP", "tags": "pi"})
            return _payload(await client.call_tool("stats", {}))

    assert asyncio.run(scenario())["total"] == 1
