import { describe, expect, it } from "vitest";

import { extractFacts } from "../extensions/total-recall";

const user = (text: string) => ({ role: "user", content: text });
const assistant = (text: string) => ({ role: "assistant", content: text });

describe("extractFacts", () => {
  it("returns the most recent user message first", () => {
    const facts = extractFacts([user("first"), assistant("a"), user("second")]);
    expect(facts[0]).toBe("second");
  });

  it("ignores non-user messages and empty content", () => {
    expect(extractFacts([assistant("no"), user("   "), user("")])).toEqual([]);
  });

  it("deduplicates identical facts", () => {
    expect(extractFacts([user("same"), user("same")])).toEqual(["same"]);
  });

  it("respects the maximum number of facts", () => {
    const messages = [user("a"), user("b"), user("c"), user("d")];
    expect(extractFacts(messages, 2)).toHaveLength(2);
  });

  it("joins text parts of a structured message", () => {
    const message = {
      role: "user",
      content: [
        { type: "text", text: "hello" },
        { type: "text", text: "world" },
      ],
    };
    expect(extractFacts([message])).toEqual(["hello world"]);
  });
});
