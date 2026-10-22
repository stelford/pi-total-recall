# cycle-capture Specification

## Purpose
Defines how the Pi extension connects Pi to the fact store: it registers the MCP server, captures facts automatically at the end of each agent cycle, and offers recall commands.

## Requirements

### Requirement: Register the fact-store MCP server

The extension SHALL register the fact-store server as an MCP server for the current session so the agent can call the fact tools directly.

#### Scenario: Registering on session start

- **WHEN** a session starts with the extension loaded
- **THEN** the extension registers the fact-store MCP server for the session

### Requirement: Capture facts at the end of each cycle

The extension SHALL, at the end of each agent cycle, extract facts from the run and store them through the MCP server.

#### Scenario: Storing captured facts

- **WHEN** an agent cycle ends with messages available
- **THEN** the extension sends the extracted facts to `store_fact` over MCP

#### Scenario: Tolerating an unreachable server

- **WHEN** the fact-store server cannot be reached at the end of a cycle
- **THEN** the extension reports the failure and continues without interrupting the session

### Requirement: Extract facts from a cycle

The extension SHALL derive one or more non-empty fact strings from the most recent user message in a cycle, deduplicated and bounded in number and length.

#### Scenario: Extracting a fact from a user message

- **WHEN** the most recent user message contains non-empty text
- **THEN** extraction returns that text as a candidate fact

#### Scenario: Ignoring empty content

- **WHEN** the most recent user message has no non-empty text
- **THEN** extraction returns no facts

#### Scenario: Bounding the number of facts

- **WHEN** a cycle contains more candidate messages than the configured maximum
- **THEN** extraction returns no more than the configured maximum, newest first

### Requirement: Provide recall commands

The extension SHALL provide a `/recall <query>` command that retrieves matching facts and a `/recall-stats` command that reports how many facts are stored.

#### Scenario: Running the recall command

- **WHEN** the user runs `/recall <query>`
- **THEN** the extension queries the server and shows the matching facts

#### Scenario: Running the stats command

- **WHEN** the user runs `/recall-stats`
- **THEN** the extension shows the total number of stored facts
