import { describe, expect, it } from "vitest";

import handler from "./validate.js";
import { LIMITS, validate, type BotDoc } from "../src/engine/dsl.js";

// A complete, well-formed bot document (real `BotDoc` type — no redefined schema).
// Callers JSON.stringify it into the request body; invalid cases spread an override
// onto it (the handler validates `unknown`, so no assertion is needed).
const validBot = (): BotDoc => ({
  version: 1,
  name: "candidate",
  rules: [
    {
      when: {
        op: "gte",
        args: [
          { op: "field", path: "self.canAct" },
          { op: "const", value: 1 },
        ],
      },
      do: { type: "move", dir: 1 },
    },
  ],
  default: { type: "idle" },
});

// A request to the /validate route. Body is optional so the non-POST negative
// path (which carries no body) reuses the same factory.
const validateRequest = (
  method: string,
  body?: string,
  headers?: Record<string, string>,
): Request =>
  new Request("https://mk.example/validate", { method, body, headers });

// A valid-bot JSON body padded with trailing whitespace (still valid JSON, so it
// parses back to the same valid bot) to an EXACT character length — lets us probe
// the `LIMITS.maxBytes` boundary precisely from both sides. `safeParse` and the
// handler's size guard both measure `text.length`, so this is the honest boundary.
const validBotBodyOfLength = (length: number): string => {
  const base = JSON.stringify(validBot());

  return base + " ".repeat(length - base.length);
};

describe("POST /validate — the validator gate", () => {
  it("accepts a well-formed bot with 200 {ok:true} as application/json", async () => {
    const res = await handler.fetch(
      validateRequest("POST", JSON.stringify(validBot())),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(await res.json()).toEqual({ ok: true });
  });

  it("rejects a structurally-invalid bot with 422 problem+json carrying the validator issues", async () => {
    const bad = { ...validBot(), version: 2 };

    const res = await handler.fetch(
      validateRequest("POST", JSON.stringify(bad)),
    );

    expect(res.status).toBe(422);
    expect(res.headers.get("content-type")).toBe(
      "application/problem+json; charset=utf-8",
    );

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.type).toBe("/problems/invalid-bot");
    expect(body.status).toBe(422);
    expect(body.title).toBeTruthy(); // RFC 9457 requires a human-readable title
    // the handler surfaces the validator's issues VERBATIM — deep-equal to the
    // real validator output (kills an empty-`errors` / dropped-issue mutant)
    expect(body.errors).toEqual(validate(bad).issues);
  });

  it("rejects a bot with a forbidden key (prototype-pollution defense) with 422 invalid-bot", async () => {
    // `__proto__` is parseable JSON but a REJECTED bot — the safeParse gate throws
    // a ValidationError, which must surface as 422 invalid-bot (not 400 malformed).
    const res = await handler.fetch(
      validateRequest("POST", '{"__proto__":{"x":1}}'),
    );

    expect(res.status).toBe(422);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.type).toBe("/problems/invalid-bot");
    expect(body.errors).toEqual([
      { path: "__proto__", reason: "forbidden key" },
    ]);
  });

  it("rejects an unparseable JSON body with 400 malformed-request", async () => {
    const res = await handler.fetch(validateRequest("POST", "{"));

    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toBe(
      "application/problem+json; charset=utf-8",
    );

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.type).toBe("/problems/malformed-request");
    expect(body.title).toBeTruthy();
  });

  it("rejects a non-POST method with 405 method-not-allowed and Allow: POST", async () => {
    const res = await handler.fetch(validateRequest("GET"));

    expect(res.status).toBe(405);
    expect(res.headers.get("content-type")).toBe(
      "application/problem+json; charset=utf-8",
    );
    // the RFC 7231 method-negotiation header names the one allowed method
    expect(res.headers.get("allow")).toBe("POST");

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.type).toBe("/problems/method-not-allowed");
    expect(body.status).toBe(405);
    expect(body.title).toBeTruthy();
  });

  it("rejects an oversize body with 413 payload-too-large", async () => {
    // one byte over the cap — the transport is malformed, so the caller gets the
    // precise 413 (shrink the doc) rather than a confusing 422 invalid-bot.
    const res = await handler.fetch(
      validateRequest("POST", validBotBodyOfLength(LIMITS.maxBytes + 1)),
    );

    expect(res.status).toBe(413);
    expect(res.headers.get("content-type")).toBe(
      "application/problem+json; charset=utf-8",
    );

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.type).toBe("/problems/payload-too-large");
    expect(body.status).toBe(413);
    expect(body.title).toBeTruthy();
  });

  it("accepts a valid bot whose body is exactly at the size cap", async () => {
    // boundary: `text.length === maxBytes` is NOT over the cap — the guard uses
    // `>`, so an at-cap valid bot validates normally (kills a `>=` mutant).
    const res = await handler.fetch(
      validateRequest("POST", validBotBodyOfLength(LIMITS.maxBytes)),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("accepts a valid bot regardless of a non-JSON Content-Type (parse-first)", async () => {
    // header-less `fetch` auto-labels a string body `text/plain`; `curl -d` sends
    // form-urlencoded. `/validate` does not gate on content-type — a valid-JSON
    // body is accepted on its merits (pins parse-first; catches a future gate).
    const res = await handler.fetch(
      validateRequest("POST", JSON.stringify(validBot()), {
        "content-type": "text/plain",
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
