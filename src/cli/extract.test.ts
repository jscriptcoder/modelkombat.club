import { describe, it, expect } from "vitest";

import { extractBotJson } from "./extract.js";

// `extractBotJson` is the lenient intake stage for a raw model reply: it selects
// the JSON *substring* most likely to be the bot document, deterministically and
// identically for every model. It does NOT parse or validate — the unchanged
// `safeParse` + `validate` gate (the TCB) remains the sole authority on what is a
// legal bot. Selection rule:
//   1. among fenced ``` blocks tagged `json` or untagged, with non-empty content,
//      return the LAST one's content;
//   2. else the LAST balanced top-level `{…}` object (string-aware);
//   3. else null.
const FENCE = "```";

const block = (lang: string, body: string): string =>
  `${FENCE}${lang}\n${body}\n${FENCE}`;

describe("extractBotJson — fenced blocks (step 1)", () => {
  it("returns the content of a single ```json block, trimmed of surrounding whitespace", () => {
    const reply = `Here is my bot:\n${block("json", '{"version":1,"name":"x"}')}\nGood luck!`;

    expect(extractBotJson(reply)).toBe('{"version":1,"name":"x"}');
  });

  it("returns the LAST fenced block when a model shows a draft then a final version", () => {
    const reply = `Draft:\n${block("json", '{"v":1}')}\nFinal:\n${block("json", '{"v":2}')}`;

    expect(extractBotJson(reply)).toBe('{"v":2}');
  });

  it("accepts an untagged (bare ```) fence as a json candidate", () => {
    const reply = block("", '{"bare":true}');

    expect(extractBotJson(reply)).toBe('{"bare":true}');
  });

  it("chooses a bare-fenced object over a different bare object that follows it", () => {
    // The fenced content differs from the brace-scan winner, proving the bare
    // fence (lang "") is itself a candidate, not just found by the fallback scan.
    const reply = `${block("", '{"first":1}')}\nlater {"second":2}`;

    expect(extractBotJson(reply)).toBe('{"first":1}');
  });

  it("preserves the inner formatting of a pretty-printed block (only the outer whitespace is trimmed)", () => {
    const pretty = '{\n  "version": 1,\n  "name": "pretty"\n}';
    const reply = `${block("json", pretty)}`;

    expect(extractBotJson(reply)).toBe(pretty);
  });

  it("prefers a fenced block over a later bare top-level object (fallback order: fences win)", () => {
    const reply = `${block("json", '{"fenced":1}')}\nand then loose text {"loose":2}`;

    expect(extractBotJson(reply)).toBe('{"fenced":1}');
  });

  it("ignores a fence tagged with another language, falling through to the brace scan", () => {
    const reply = `${block("python", "x = 1")}\nthe real one: {"actual":1}`;

    expect(extractBotJson(reply)).toBe('{"actual":1}');
  });

  it("ignores an empty trailing fence and keeps the earlier non-empty block", () => {
    const reply = `${block("json", '{"real":1}')}\noops:\n${block("", "   ")}`;

    expect(extractBotJson(reply)).toBe('{"real":1}');
  });

  it("matches the fence tag case-insensitively and ignoring surrounding whitespace", () => {
    // A ` JSON ` tag (mixed case + padding) is still a json candidate; the
    // differing bare object proves the fenced block was chosen over the scan.
    const reply = `${block(" JSON ", '{"upper":1}')}\nstray {"other":2}`;

    expect(extractBotJson(reply)).toBe('{"upper":1}');
  });
});

describe("extractBotJson — balanced top-level object (step 2)", () => {
  it("returns the LAST balanced top-level object when there is no fence", () => {
    const reply = 'First {"a":1} then {"b":2}';

    expect(extractBotJson(reply)).toBe('{"b":2}');
  });

  it("matches nested braces as one balanced object", () => {
    const reply = 'prefix {"outer":{"inner":1}} suffix';

    expect(extractBotJson(reply)).toBe('{"outer":{"inner":1}}');
  });

  it("does not let a brace inside a JSON string literal break the balance", () => {
    const reply = 'noise {"s":"a}b{c","n":1} more';

    expect(extractBotJson(reply)).toBe('{"s":"a}b{c","n":1}');
  });

  it('keeps a string open across a backslash-escaped quote (the escaped " does not close it)', () => {
    // The "s" value is `a"}` — an escaped quote followed by a brace. Mishandling
    // the escape would close the string early and truncate the object.
    const reply = '{"s":"a\\"}","n":1}';

    expect(extractBotJson(reply)).toBe('{"s":"a\\"}","n":1}');
  });

  it("handles an object whose first key is an empty string", () => {
    expect(extractBotJson('{"":0}')).toBe('{"":0}');
  });

  it("ignores a stray closing brace that precedes the real object", () => {
    expect(extractBotJson('oops } noise {"real":1}')).toBe('{"real":1}');
  });
});

describe("extractBotJson — no extractable JSON (step 3)", () => {
  it("returns null when the reply has no code block and no braces", () => {
    expect(extractBotJson("Just prose, sorry — no bot this time.")).toBeNull();
  });

  it("returns null when an opening brace never closes (no complete top-level object)", () => {
    expect(extractBotJson('here goes { "incomplete": 1')).toBeNull();
  });

  it("returns null when the outer object never closes even though an inner one does", () => {
    expect(extractBotJson('{"outer":{"inner":1}')).toBeNull();
  });
});
