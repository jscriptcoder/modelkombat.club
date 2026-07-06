import { describe, expect, it } from "vitest";

import {
  buildCrownRequest,
  buildReadRequest,
  CROWN_SCRIPT,
  interpretCrownReply,
  interpretReadReply,
  upstashThroneStore,
} from "./throne-store-upstash.js";
import type { ThroneRecord } from "./throne-store.js";
import type { BotDoc } from "../engine/dsl.js";

const config = {
  url: "https://example.upstash.io",
  token: "tok_secret",
} as const;

// A minimal, distinct champion document — the store treats it as opaque JSON.
const champ = (name: string): BotDoc => ({
  version: 1,
  name,
  rules: [],
  default: { type: "idle" },
});

const record = (overrides?: Partial<ThroneRecord>): ThroneRecord => ({
  champion: champ("king"),
  generation: 2,
  handle: null,
  ...overrides,
});

// Parse the Upstash REST command array out of a built request's JSON body.
const command = (init: RequestInit): unknown[] =>
  JSON.parse(String(init.body)) as unknown[];

describe("buildCrownRequest — the atomic compare-and-swap EVAL payload", () => {
  it("POSTs to the Upstash base URL with bearer auth and a JSON body", () => {
    const { url, init } = buildCrownRequest(config, "v19", 1, record());

    expect(url).toBe(config.url);
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    });
  });

  it("issues an EVAL over the version's throne + lineage keys", () => {
    const cmd = command(buildCrownRequest(config, "v19", 1, record()).init);

    expect(cmd[0]).toBe("EVAL");
    expect(cmd[1]).toBe(CROWN_SCRIPT);
    expect(cmd[2]).toBe("2"); // two KEYS: pointer + append-only lineage list
    expect(cmd[3]).toBe("throne:v19");
    expect(cmd[4]).toBe("champions:v19");
  });

  it("passes the expected generation as ARGV[1] and the next record JSON as ARGV[2]", () => {
    const next = record({ generation: 3 });
    const cmd = command(buildCrownRequest(config, "v19", 2, next).init);

    expect(cmd[5]).toBe("2"); // expected generation, stringified
    expect(cmd[6]).toBe(JSON.stringify(next));
    expect(JSON.parse(String(cmd[6]))).toEqual(next); // the record round-trips
  });

  it("encodes an empty-throne crown (expected null) as the empty-string sentinel", () => {
    const cmd = command(
      buildCrownRequest(config, "v19", null, record({ generation: 1 })).init,
    );

    // null ⇒ "expect the throne empty", a value no real generation can take.
    expect(cmd[5]).toBe("");
  });

  it("scopes both keys to the requested version", () => {
    const cmd = command(buildCrownRequest(config, "v20", 1, record()).init);

    expect(cmd[3]).toBe("throne:v20");
    expect(cmd[4]).toBe("champions:v20");
  });

  it("carries the compare-then-set-pointer-then-append-lineage operations", () => {
    // The script's exact Lua is proven end-to-end by the env-gated live smoke test; here we
    // pin each required operation so a refactor can't silently drop one — read the pointer
    // (GET), default the current generation, compare it (cjson.decode), bail on a mismatch
    // ('moved'), set the new pointer (SET) AND append to the lineage (RPUSH), then succeed
    // ('ok'). The `\n` join keeps it a readable multi-line script.
    expect(CROWN_SCRIPT).toContain("GET");
    expect(CROWN_SCRIPT).toContain("local current");
    expect(CROWN_SCRIPT).toContain("cjson.decode");
    expect(CROWN_SCRIPT).toContain("moved");
    expect(CROWN_SCRIPT).toContain("SET");
    expect(CROWN_SCRIPT).toContain("RPUSH");
    expect(CROWN_SCRIPT).toContain("'ok'");
    expect(CROWN_SCRIPT).toContain("\n");
  });
});

describe("buildReadRequest — fetch the reigning record", () => {
  it("POSTs a GET of the version's throne pointer key with bearer auth", () => {
    const { url, init } = buildReadRequest(config, "v19");

    expect(url).toBe(config.url);
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    });
    expect(command(init)).toEqual(["GET", "throne:v19"]);
  });

  it("scopes the read to the requested version", () => {
    expect(command(buildReadRequest(config, "v20").init)).toEqual([
      "GET",
      "throne:v20",
    ]);
  });
});

describe("interpretReadReply — the reigning record, or an empty throne", () => {
  it("returns undefined when the pointer is missing (result null)", () => {
    expect(interpretReadReply({ result: null })).toBeUndefined();
  });

  it("parses the stored record JSON into a ThroneRecord", () => {
    const rec = record({ generation: 4, handle: "kata-master" });

    expect(interpretReadReply({ result: JSON.stringify(rec) })).toEqual(rec);
  });

  it("throws on an Upstash error rather than reporting an empty throne", () => {
    // Critical: a transient store error must NOT read as "empty" — that would let a
    // challenger wrongly bootstrap-crown over a live king. The message must name the read
    // failure (not a fall-through JSON.parse error from mis-handling the error branch).
    expect(() => interpretReadReply({ error: "WRONGTYPE" })).toThrow(
      /read failed/i,
    );
  });
});

describe("interpretCrownReply — did the crown land, or lose the race?", () => {
  it("maps 'ok' to a landed crown carrying the crowned record", () => {
    const next = record({ generation: 2 });

    expect(interpretCrownReply({ result: "ok" }, next)).toEqual({
      ok: true,
      record: next,
    });
  });

  it("maps 'moved' to a lost CAS race", () => {
    expect(interpretCrownReply({ result: "moved" }, record())).toEqual({
      ok: false,
      reason: "moved",
    });
  });

  it("throws a crown-failure on an Upstash error", () => {
    expect(() => interpretCrownReply({ error: "boom" }, record())).toThrow(
      /crown failed/i,
    );
  });

  it("throws on an unexpected result rather than assuming success", () => {
    // A reply that is neither 'ok' nor 'moved' is a contract violation, not a crown.
    expect(() => interpretCrownReply({ result: "surprise" }, record())).toThrow(
      /unexpected/i,
    );
  });
});

// A `fetch` double: returns a canned Upstash reply and records each command sent.
const stubFetch = (reply: unknown) => {
  const calls: { url: string; command: unknown[] }[] = [];

  const fetchImpl = (
    input: string | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    calls.push({
      url: String(input),
      command: JSON.parse(String(init?.body)) as unknown[],
    });

    return Promise.resolve(
      new Response(JSON.stringify(reply), { status: 200 }),
    );
  };

  return { fetchImpl, calls };
};

describe("upstashThroneStore — the adapter over Upstash REST", () => {
  it("reads the reigning record by GETting the version's pointer", async () => {
    const rec = record({ generation: 5, handle: "sensei" });
    const { fetchImpl, calls } = stubFetch({ result: JSON.stringify(rec) });

    const got = await upstashThroneStore(config, fetchImpl).read("v19");

    expect(got).toEqual(rec);
    expect(calls[0].url).toBe(config.url);
    expect(calls[0].command).toEqual(["GET", "throne:v19"]);
  });

  it("reads an empty throne as undefined", async () => {
    const { fetchImpl } = stubFetch({ result: null });

    expect(
      await upstashThroneStore(config, fetchImpl).read("v19"),
    ).toBeUndefined();
  });

  it("crowns via an EVAL and returns the crowned record on 'ok'", async () => {
    const next = record({ generation: 1 });
    const { fetchImpl, calls } = stubFetch({ result: "ok" });

    const res = await upstashThroneStore(config, fetchImpl).compareAndSwap(
      "v19",
      null,
      next,
    );

    expect(res).toEqual({ ok: true, record: next });
    expect(calls[0].command[0]).toBe("EVAL");
    expect(calls[0].command[5]).toBe(""); // expected null → empty sentinel
    expect(calls[0].command[6]).toBe(JSON.stringify(next));
  });

  it("reports a lost CAS race on 'moved' (no crown)", async () => {
    const { fetchImpl } = stubFetch({ result: "moved" });

    const res = await upstashThroneStore(config, fetchImpl).compareAndSwap(
      "v19",
      1,
      record({ generation: 2 }),
    );

    expect(res).toEqual({ ok: false, reason: "moved" });
  });

  it("rejects when the store errors (a read failure is not an empty throne)", async () => {
    const { fetchImpl } = stubFetch({ error: "ECONN" });

    await expect(
      upstashThroneStore(config, fetchImpl).read("v19"),
    ).rejects.toThrow();
  });
});
