/**
 * Minimal, type-only surface of the Pi extension API used by this project.
 *
 * Keeping this local avoids pulling the full `@earendil-works/pi-coding-agent`
 * package in just to typecheck the extension. Pi provides the real runtime.
 */

export interface ExtensionUIContext {
  notify(message: string, level?: "info" | "warning" | "error"): void;
}

export interface ExtensionContext {
  cwd: string;
  ui?: ExtensionUIContext;
}

export interface TextPart {
  type?: string;
  text?: string;
}

export interface AgentMessage {
  role?: string;
  content?: string | TextPart[];
}

export interface AgentEndEvent {
  type: "agent_end";
  messages: AgentMessage[];
}

export interface McpServerConfig {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  exposure?: "codemode" | "deferred" | "direct" | "hidden";
  description?: string;
}

export type EventHandler<TEvent> = (
  event: TEvent,
  ctx: ExtensionContext,
) => void | Promise<void>;

export interface CommandOptions {
  description?: string;
  handler: (args: string, ctx: ExtensionContext) => void | Promise<void>;
}

export interface ExtensionAPI {
  registerMcpServer(name: string, config: McpServerConfig): void;
  registerCommand(name: string, options: CommandOptions): void;
  on(event: "agent_end", handler: EventHandler<AgentEndEvent>): void;
}
