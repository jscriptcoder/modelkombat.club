import { describe, expect, it } from "vitest";

import {
  buildCommitArenaRequest,
  buildReadArchiveRequest,
  buildReadArenaRequest,
  COMMIT_ARENA_SCRIPT,
  interpretCommitArenaReply,
  interpretReadArchiveReply,
  interpretReadArenaReply,
  upstashThroneStore,
} from "./throne-store-upstash.js";
import type { ArenaRecord, ReproRecord } from "./throne-store.js";
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

const arena = (overrides?: Partial<ArenaRecord>): ArenaRecord => ({
  members: [{ champion: champ("king"), handle: null, seniority: 1 }],
  generation: 2,
  nextSeniority: 2,
  ...overrides,
});

const repro = (
  name: string,
  overrides?: Partial<ReproRecord>,
): ReproRecord => ({
  challenger: champ(name),
  defenders: [champ("king")],
  seeds: [1, 2, 3],
  version: "v19",
  memberSeniority: null,
  ...overrides,
});

// Parse the Upstash REST command array out of a built request's JSON body.
const command = (init: RequestInit): unknown[] =>
  JSON.parse(String(init.body)) as unknown[];

describe("buildCommitArenaRequest — the atomic arena-swap + archive-append EVAL payload", () => {
  it("issues an EVAL over the version's arena key AND archive key (two KEYS)", () => {
    const cmd = command(
      buildCommitArenaRequest(config, "v19", 1, arena()).init,
    );

    expect(cmd[0]).toBe("EVAL");
    expect(cmd[1]).toBe(COMMIT_ARENA_SCRIPT);
    expect(cmd[2]).toBe("2"); // two KEYS: the arena pointer + the archive list
    expect(cmd[3]).toBe("arena:v19"); // KEYS[1]
    expect(cmd[4]).toBe("archive:v19"); // KEYS[2]
  });

  it("passes the expected generation as ARGV[1] and the next arena JSON as ARGV[2]", () => {
    const next = arena({ generation: 3 });
    const cmd = command(buildCommitArenaRequest(config, "v19", 2, next).init);

    expect(cmd[5]).toBe("2"); // expected generation, stringified
    expect(cmd[6]).toBe(JSON.stringify(next));
    expect(JSON.parse(String(cmd[6]))).toEqual(next); // the arena round-trips
  });

  it("encodes an empty-arena commit (expected null) as the empty-string sentinel", () => {
    const cmd = command(
      buildCommitArenaRequest(config, "v19", null, arena({ generation: 1 }))
        .init,
    );

    expect(cmd[5]).toBe(""); // null ⇒ "expect the arena empty"
  });

  it("passes a supplied reproduction record as ARGV[3] JSON", () => {
    const record = repro("clearer");

    const cmd = command(
      buildCommitArenaRequest(config, "v19", 1, arena(), record).init,
    );

    expect(cmd[7]).toBe(JSON.stringify(record));
    expect(JSON.parse(String(cmd[7]))).toEqual(record); // the record round-trips
  });

  it("encodes a record-less commit as the empty-string sentinel (append nothing)", () => {
    const cmd = command(
      buildCommitArenaRequest(config, "v19", 1, arena()).init,
    );

    expect(cmd[7]).toBe(""); // no record ⇒ the script skips the RPUSH
  });

  it("scopes both keys to the requested version", () => {
    const cmd = command(
      buildCommitArenaRequest(config, "v20", 1, arena()).init,
    );

    expect(cmd[3]).toBe("arena:v20");
    expect(cmd[4]).toBe("archive:v20");
  });

  it("carries the compare-then-set-arena-then-append operations", () => {
    // The exact Lua is proven end-to-end by the env-gated live smoke test; here we pin each
    // required operation so a refactor can't silently drop one — read the arena pointer (GET),
    // compare its generation (cjson.decode), bail on a mismatch ('moved'), set the new arena
    // (SET), append the record to the archive when supplied (RPUSH), then succeed ('ok'). The
    // `\n` join keeps it a readable multi-line script.
    expect(COMMIT_ARENA_SCRIPT).toContain("GET");
    expect(COMMIT_ARENA_SCRIPT).toContain("local current");
    expect(COMMIT_ARENA_SCRIPT).toContain("cjson.decode");
    expect(COMMIT_ARENA_SCRIPT).toContain("moved");
    expect(COMMIT_ARENA_SCRIPT).toContain("SET");
    expect(COMMIT_ARENA_SCRIPT).toContain("RPUSH");
    expect(COMMIT_ARENA_SCRIPT).toContain("'ok'");
    expect(COMMIT_ARENA_SCRIPT).toContain("\n");
    // The RPUSH is guarded by a non-empty ARGV[3] so a record-less commit appends nothing.
    expect(COMMIT_ARENA_SCRIPT).toContain("ARGV[3]");
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

describe("buildReadArchiveRequest — fetch the version's reproduction archive", () => {
  it("POSTs an LRANGE over the whole archive list with bearer auth", () => {
    const { url, init } = buildReadArchiveRequest(config, "v19");

    expect(url).toBe(config.url);
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    });
    expect(command(init)).toEqual(["LRANGE", "archive:v19", "0", "-1"]);
  });

  it("scopes the read to the requested version's archive key", () => {
    expect(command(buildReadArchiveRequest(config, "v20").init)).toEqual([
      "LRANGE",
      "archive:v20",
      "0",
      "-1",
    ]);
  });
});

describe("interpretReadArchiveReply — the archive records, oldest first", () => {
  it("returns an empty archive when the list is missing (result [])", () => {
    expect(interpretReadArchiveReply({ result: [] })).toEqual([]);
  });

  it("parses each stored JSON string into a ReproRecord, in order", () => {
    const a = repro("first");
    const b = repro("second", { memberSeniority: 2 });

    expect(
      interpretReadArchiveReply({
        result: [JSON.stringify(a), JSON.stringify(b)],
      }),
    ).toEqual([a, b]);
  });

  it("throws on an Upstash error rather than reporting an empty archive", () => {
    expect(() => interpretReadArchiveReply({ error: "WRONGTYPE" })).toThrow(
      /archive read failed/i,
    );
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
    const record = repro("clearer");
    const { fetchImpl, calls } = stubFetch({ result: "ok" });

    const res = await upstashThroneStore(config, fetchImpl).commitArena(
      "v19",
      null,
      next,
      record,
    );

    expect(res).toEqual({ ok: true, record: next });
    expect(calls[0].command[0]).toBe("EVAL");
    expect(calls[0].command[5]).toBe(""); // expected null → empty sentinel
    expect(calls[0].command[6]).toBe(JSON.stringify(next));
    expect(calls[0].command[7]).toBe(JSON.stringify(record)); // the record rides the same EVAL
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

  it("reads the reproduction archive by LRANGEing the version's archive key", async () => {
    const a = repro("first");
    const b = repro("second", { memberSeniority: 2 });

    const { fetchImpl, calls } = stubFetch({
      result: [JSON.stringify(a), JSON.stringify(b)],
    });

    const got = await upstashThroneStore(config, fetchImpl).readArchive("v19");

    expect(got).toEqual([a, b]);
    expect(calls[0].command).toEqual(["LRANGE", "archive:v19", "0", "-1"]);
  });

  it("rejects an arena read when the store errors (not an empty arena)", async () => {
    const { fetchImpl } = stubFetch({ error: "ECONN" });

    await expect(
      upstashThroneStore(config, fetchImpl).readArena("v19"),
    ).rejects.toThrow();
  });
});
