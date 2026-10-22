# Spec Delta

## Purpose

Defines a small SQLite-backed memory store for durable "facts" that Pi can write to and read from across sessions through the Model Context Protocol.

## ADDED Requirements

### Requirement: Store a fact

The store SHALL accept a fact's text plus optional tags and source, persist it to SQLite, and return a stable identifier for the stored fact.

#### Scenario: Storing a new fact

- **WHEN** a fact is stored with text and optional tags and source
- **THEN** the store persists the fact and returns a non-empty identifier

#### Scenario: Rejecting an empty fact

- **WHEN** a fact is stored with empty or whitespace-only text
- **THEN** the store rejects the request with an error and stores nothing

### Requirement: Retrieve facts

The store SHALL return stored facts newest first, optionally filtered by a case-insensitive substring match on the fact text or tags, bounded by a requested limit.

#### Scenario: Retrieving the newest facts

- **WHEN** retrieval is requested without a query
- **THEN** the store returns up to `limit` facts ordered by insertion time, newest first

#### Scenario: Filtering by query

- **WHEN** retrieval is requested with a query
- **THEN** only facts whose text or tags contain the query are returned

#### Scenario: Respecting the limit

- **WHEN** retrieval is requested with a limit smaller than the number of matching facts
- **THEN** the store returns no more than that limit

### Requirement: Report fact statistics

The store SHALL return a statistics result that includes the total number of stored facts.

#### Scenario: Counting stored facts

- **WHEN** statistics are requested after several facts have been stored
- **THEN** the reported total equals the number of facts persisted

### Requirement: Persist facts across restarts

The store SHALL persist facts in a SQLite database at a configurable path and reload them when the process restarts.

#### Scenario: Persistence across process restarts

- **WHEN** a fact is stored, the process exits, and a new process opens the same database path
- **THEN** the previously stored fact is returned by retrieval

#### Scenario: Configurable database path

- **WHEN** a database path is provided through configuration
- **THEN** the store reads and writes that database file

### Requirement: Expose the store over MCP

The store SHALL expose `store_fact`, `retrieve_facts`, and `stats` as Model Context Protocol tools over the stdio transport.

#### Scenario: Listing the MCP tools

- **WHEN** an MCP client connects to the server and lists its tools
- **THEN** the list contains `store_fact`, `retrieve_facts`, and `stats`

#### Scenario: Calling a tool over MCP

- **WHEN** an MCP client calls `store_fact` and then `stats`
- **THEN** the statistics total reflects the fact that was just stored
