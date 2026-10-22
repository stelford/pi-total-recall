import { describe, expect, it } from "vitest";

import {
  distillFacts,
  distillPrompt,
  parseDistilledFacts,
} from "../extensions/total-recall";
import type { ExtensionContext } from "../extensions/pi-types";

describe("parseDistilledFacts", () => {
  it("parses a clean JSON array of strings", () => {
    expect(parseDistilledFacts('["the project uses Java", "code follows TDD"]')).toEqual([
      "the project uses Java",
      "code follows TDD",
    ]);
  });

  it("extracts an array embedded in prose or code fences", () => {
    expect(parseDistilledFacts('Here you go:\n```json\n["a durable fact"]\n```')).toEqual([
      "a durable fact",
    ]);
  });

  it("drops non-strings and blank entries", () => {
    expect(parseDistilledFacts('["ok", 3, "   ", null]')).toEqual(["ok"]);
  });

  it("returns an empty array for invalid JSON", () => {
    expect(parseDistilledFacts("sorry, I cannot do that")).toEqual([]);
  });

  it("returns an empty array for an empty JSON array", () => {
    expect(parseDistilledFacts("[]")).toEqual([]);
  });
});

describe("distillPrompt", () => {
  it("states the fact budget and includes recent message text", () => {
    const prompt = distillPrompt([{ role: "user", content: "build a thing" }], 3);
    expect(prompt).toContain("up to 3");
    expect(prompt).toContain("build a thing");
  });

  it("only includes the most recent messages", () => {
    const messages = Array.from({ length: 40 }, (_, index) => ({
      role: "user",
      content: `message-${index}`,
    }));
    const prompt = distillPrompt(messages, 3);
    expect(prompt).toContain("message-39");
    expect(prompt).not.toContain("message-0 ");
  });
});

function ctxWith(text: string): ExtensionContext {
  return {
    cwd: ".",
    model: { id: "fake" },
    modelRegistry: {
      complete: async () => ({ content: [{ type: "text", text }] }),
    },
  };
}

describe("distillFacts", () => {
  it("parses the model's JSON array", async () => {
    const facts = await distillFacts(ctxWith('["the project uses Java"]'), [], 3);
    expect(facts).toEqual(["the project uses Java"]);
  });

  it("caps the count and deduplicates", async () => {
    const facts = await distillFacts(ctxWith('["a", "a", "b", "c"]'), [], 2);
    expect(facts).toEqual(["a", "b"]);
  });

  it("returns nothing when no model is available", async () => {
    expect(await distillFacts({ cwd: "." }, [], 3)).toEqual([]);
  });
});
