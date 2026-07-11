import { describe, expect, it } from "vitest";

import {
  buildCommitArenaRequest,
  buildCrownRequest,
  buildReadArenaRequest,
  buildReadRequest,
  buildRecentRequest,
  COMMIT_ARENA_SCRIPT,
  CROWN_SCRIPT,
  interpretCommitArenaReply,
  interpretCrownReply,
  interpretReadArenaReply,
  interpretReadReply,
  interpretRecentReply,
  upstashThroneStore,
} from "./throne-store-upstash.js";
import type { ArenaRecord, ThroneRecord } from "./throne-store.js";
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

const arena = (overrides?: Partial<ArenaRecord>): ArenaRecord => ({
  members: [{ champion: champ("king"), handle: null, seniority: 1 }],
  generation: 2,
  nextSeniority: 2,
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

describe("buildRecentRequest — fetch the recent lineage tail", () => {
  it("POSTs an LRANGE of the version's lineage key for the last `limit` entries", () => {
    const { url, init } = buildRecentRequest(config, "v19", 3);

    expect(url).toBe(config.url);
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    });
    // `LRANGE key -limit -1` = the last `limit` entries, oldest-first within the tail.
    expect(command(init)).toEqual(["LRANGE", "champions:v19", "-3", "-1"]);
  });

  it("scopes the read to the requested version and limit", () => {
    expect(command(buildRecentRequest(config, "v20", 5).init)).toEqual([
      "LRANGE",
      "champions:v20",
      "-5",
      "-1",
    ]);
  });
});

describe("interpretRecentReply — the recent lineage, oldest-first", () => {
  it("parses each stored record JSON into a ThroneRecord, preserving order", () => {
    const a = record({ generation: 1 });
    const b = record({ generation: 2, handle: "sensei" });

    expect(
      interpretRecentReply({ result: [JSON.stringify(a), JSON.stringify(b)] }),
    ).toEqual([a, b]);
  });

  it("returns an empty array for an empty lineage (result [])", () => {
    expect(interpretRecentReply({ result: [] })).toEqual([]);
  });

  it("throws on an Upstash error rather than reporting an empty lineage", () => {
    // Critical: a transient store error must NOT read as "no champions yet" — that would
    // misreport an outage as an empty Hall of Kings. Surface it; never return [].
    expect(() => interpretRecentReply({ error: "WRONGTYPE" })).toThrow(
      /recent read failed/i,
    );
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

describe("buildCommitArenaRequest — the atomic arena compare-and-swap EVAL payload", () => {
  it("issues an EVAL over the version's arena + lineage keys", () => {
    const cmd = command(
      buildCommitArenaRequest(config, "v19", 1, arena()).init,
    );

    expect(cmd[0]).toBe("EVAL");
    expect(cmd[1]).toBe(COMMIT_ARENA_SCRIPT);
    expect(cmd[2]).toBe("2"); // two KEYS: arena pointer + append-only lineage
    expect(cmd[3]).toBe("arena:v19");
    expect(cmd[4]).toBe("champions:v19");
  });

  it("passes the expected generation as ARGV[1] and the next arena JSON as ARGV[2]", () => {
    const next = arena({ generation: 3 });
    const cmd = command(buildCommitArenaRequest(config, "v19", 2, next).init);

    expect(cmd[5]).toBe("2"); // expected generation, stringified
    expect(cmd[6]).toBe(JSON.stringify(next));
    expect(JSON.parse(String(cmd[6]))).toEqual(next); // the arena round-trips
  });

  it("appends the new King (arena #1) to the lineage as ARGV[3], stamped with the arena generation", () => {
    const next = arena({
      members: [{ champion: champ("blitz"), handle: "sensei", seniority: 4 }],
      generation: 5,
    });

    const cmd = command(buildCommitArenaRequest(config, "v19", 4, next).init);

    // The lineage entry is the reigning champion as a ThroneRecord, carrying the arena's
    // generation and the member's handle — so `read()`/`recent()` stay byte-identical.
    expect(JSON.parse(String(cmd[7]))).toEqual({
      champion: champ("blitz"),
      generation: 5,
      handle: "sensei",
    });
  });

  it("encodes an empty-arena commit (expected null) as the empty-string sentinel", () => {
    const cmd = command(
      buildCommitArenaRequest(config, "v19", null, arena({ generation: 1 }))
        .init,
    );

    expect(cmd[5]).toBe(""); // null ⇒ "expect the arena empty"
  });

  it("scopes both keys to the requested version", () => {
    const cmd = command(
      buildCommitArenaRequest(config, "v20", 1, arena()).init,
    );

    expect(cmd[3]).toBe("arena:v20");
    expect(cmd[4]).toBe("champions:v20");
  });

  it("carries the compare-then-set-arena-then-append-lineage operations", () => {
    // The exact Lua is proven end-to-end by the env-gated live smoke test; here we pin each
    // required operation so a refactor can't silently drop one — read the arena pointer (GET),
    // compare its generation (cjson.decode), bail on a mismatch ('moved'), set the new arena
    // (SET) AND append the King to the lineage (RPUSH), then succeed ('ok').
    expect(COMMIT_ARENA_SCRIPT).toContain("GET");
    expect(COMMIT_ARENA_SCRIPT).toContain("local current");
    expect(COMMIT_ARENA_SCRIPT).toContain("cjson.decode");
    expect(COMMIT_ARENA_SCRIPT).toContain("moved");
    expect(COMMIT_ARENA_SCRIPT).toContain("SET");
    expect(COMMIT_ARENA_SCRIPT).toContain("RPUSH");
    expect(COMMIT_ARENA_SCRIPT).toContain("'ok'");
    expect(COMMIT_ARENA_SCRIPT).toContain("\n");
  });
});

describe("buildReadArenaRequest — fetch the current arena record", () => {
  it("POSTs a GET of the version's arena key with bearer auth", () => {
    const { url, init } = buildReadArenaRequest(config, "v19");

    expect(url).toBe(config.url);
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    });
    expect(command(init)).toEqual(["GET", "arena:v19"]);
  });

  it("scopes the read to the requested version", () => {
    expect(command(buildReadArenaRequest(config, "v20").init)).toEqual([
      "GET",
      "arena:v20",
    ]);
  });
});

describe("interpretReadArenaReply — the current arena, or an empty arena", () => {
  it("returns undefined when the arena key is missing (result null)", () => {
    expect(interpretReadArenaReply({ result: null })).toBeUndefined();
  });

  it("parses the stored arena JSON into an ArenaRecord", () => {
    const a = arena({ generation: 4 });

    expect(interpretReadArenaReply({ result: JSON.stringify(a) })).toEqual(a);
  });

  it("throws on an Upstash error rather than reporting an empty arena", () => {
    // Critical: a transient store error must NOT read as "no arena yet" — that would let a
    // challenger wrongly bootstrap-crown over a live arena. Surface it; never return undefined.
    expect(() => interpretReadArenaReply({ error: "WRONGTYPE" })).toThrow(
      /arena read failed/i,
    );
  });
});

describe("interpretCommitArenaReply — did the arena commit land, or lose the race?", () => {
  it("maps 'ok' to a landed commit carrying the committed arena", () => {
    const next = arena({ generation: 2 });

    expect(interpretCommitArenaReply({ result: "ok" }, next)).toEqual({
      ok: true,
      record: next,
    });
  });

  it("maps 'moved' to a lost CAS race", () => {
    expect(interpretCommitArenaReply({ result: "moved" }, arena())).toEqual({
      ok: false,
      reason: "moved",
    });
  });

  it("throws a commit-failure on an Upstash error", () => {
    expect(() => interpretCommitArenaReply({ error: "boom" }, arena())).toThrow(
      /arena commit failed/i,
    );
  });

  it("throws on an unexpected result rather than assuming success", () => {
    expect(() =>
      interpretCommitArenaReply({ result: "surprise" }, arena()),
    ).toThrow(/unexpected/i);
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

  it("reads the recent lineage by LRANGE-ing the last `limit` of the version's list", async () => {
    const a = record({ generation: 1 });
    const b = record({ generation: 2 });
    const c = record({ generation: 3 });

    const { fetchImpl, calls } = stubFetch({
      result: [JSON.stringify(a), JSON.stringify(b), JSON.stringify(c)],
    });

    const got = await upstashThroneStore(config, fetchImpl).recent("v19", 3);

    expect(got).toEqual([a, b, c]); // oldest-first, as stored
    expect(calls[0].command).toEqual(["LRANGE", "champions:v19", "-3", "-1"]);
  });

  it("rejects a recent read when the store errors (not an empty lineage)", async () => {
    const { fetchImpl } = stubFetch({ error: "ECONN" });

    await expect(
      upstashThroneStore(config, fetchImpl).recent("v19", 3),
    ).rejects.toThrow();
  });

  it("reads the current arena by GETting the version's arena key", async () => {
    const a = arena({ generation: 5 });
    const { fetchImpl, calls } = stubFetch({ result: JSON.stringify(a) });

    const got = await upstashThroneStore(config, fetchImpl).readArena("v19");

    expect(got).toEqual(a);
    expect(calls[0].command).toEqual(["GET", "arena:v19"]);
  });

  it("reads an empty arena as undefined", async () => {
    const { fetchImpl } = stubFetch({ result: null });

    expect(
      await upstashThroneStore(config, fetchImpl).readArena("v19"),
    ).toBeUndefined();
  });

  it("commits the arena via an EVAL and returns the committed record on 'ok'", async () => {
    const next = arena({ generation: 1 });
    const { fetchImpl, calls } = stubFetch({ result: "ok" });

    const res = await upstashThroneStore(config, fetchImpl).commitArena(
      "v19",
      null,
      next,
    );

    expect(res).toEqual({ ok: true, record: next });
    expect(calls[0].command[0]).toBe("EVAL");
    expect(calls[0].command[5]).toBe(""); // expected null → empty sentinel
    expect(calls[0].command[6]).toBe(JSON.stringify(next));
  });

  it("reports a lost CAS race on 'moved' (no commit)", async () => {
    const { fetchImpl } = stubFetch({ result: "moved" });

    const res = await upstashThroneStore(config, fetchImpl).commitArena(
      "v19",
      1,
      arena({ generation: 2 }),
    );

    expect(res).toEqual({ ok: false, reason: "moved" });
  });

  it("rejects an arena read when the store errors (not an empty arena)", async () => {
    const { fetchImpl } = stubFetch({ error: "ECONN" });

    await expect(
      upstashThroneStore(config, fetchImpl).readArena("v19"),
    ).rejects.toThrow();
  });
});
