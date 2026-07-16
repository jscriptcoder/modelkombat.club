import { describe, expect, it } from "vitest";

import { handleReplay, replayId, type ReplayDeps } from "./handle-replay.js";
import type { ReproRecord, ThroneStore } from "./throne-store.js";
import { renderTape } from "../engine/sim.js";
import type { BotDoc } from "../engine/dsl.js";
import type { Action, Rules } from "../engine/types.js";

// ─── factories ───────────────────────────────────────────────────────────────
const IDLE: Action = { type: "idle" };
const ATTACK_MID: Action = { type: "attack", move: "gyaku-zuki", band: "mid" };

// A minimal valid champion document. `model` is required on BotDoc (an archived doc is always
// validated at /fight intake), so identities on the wire always carry a model string.
const bot = (name: string, model: string, dflt: Action = IDLE): BotDoc => ({
  version: 1,
  name,
  model,
  rules: [],
  default: dflt,
});

// Rules where a mid gyaku-zuki cleanly lands on an idle, unguarded defender — so a
// reconstructed tape carries real motion + a score, not an empty stalemate.
const getMockRules = (o: Partial<Rules> = {}): Rules => ({
  tickRate: 60,
  walkSpeed: 4000,
  ring: { width: 600000 },
  startGap: 200000,
  moves: {
    "gyaku-zuki": {
      startup: 4,
      active: 2,
      recovery: 6,
      score: 1,
      reach: 250000,
    },
  },
  ...o,
});

// A reproduction record: challenger vs the exact defenders it fought + frozen seeds + version.
// `defenders: []` is the bootstrap-crown shape (a first champion fought nobody).
const record = (o: Partial<ReproRecord> = {}): ReproRecord => ({
  challenger: bot("alpha", "gpt", ATTACK_MID),
  defenders: [bot("king", "claude", IDLE)],
  seeds: [3],
  version: "vtest",
  memberSeniority: 1,
  ...o,
});

// A read-only throne store serving a fixed archive (append order). No arena, no commits — the
// replay endpoint reads the archive only.
const fakeStore = (archive: ReproRecord[]): ThroneStore => ({
  readArena: () => Promise.resolve(undefined),
  readArchive: () => Promise.resolve(archive),
  commitArena: () => Promise.resolve({ ok: false, reason: "moved" }),
});

// A store whose archive read fails — the Upstash-unreachable case.
const throwingStore = (): ThroneStore => ({
  readArena: () => Promise.resolve(undefined),
  readArchive: () => Promise.reject(new Error("store unreachable")),
  commitArena: () => Promise.resolve({ ok: false, reason: "moved" }),
});

const getDeps = (
  archive: ReproRecord[],
  o: Partial<ReplayDeps> = {},
): ReplayDeps => ({
  store: fakeStore(archive),
  version: "vtest",
  rules: getMockRules(),
  maxTicks: 10,
  match: undefined,
  ...o,
});

const listReq = (): Request => new Request("https://mk.example/replay");

const itemReq = (id: string): Request =>
  new Request(`https://mk.example/replay?id=${id}`);

describe("GET /replay/{id} — the reconstructed headline bout", () => {
  it("reconstructs a real record's tape + both fighters' identities, never the documents", async () => {
    const rec = record();
    const res = await handleReplay(itemReq(replayId(rec)), getDeps([rec]));

    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      tape: unknown[];
      fighters: { name: string; model: string }[];
    };

    expect(body.tape.length).toBeGreaterThan(0);
    expect(body.fighters).toEqual([
      { name: "alpha", model: "gpt" },
      { name: "king", model: "claude" },
    ]);

    // Doc-privacy: no bot-document fields (`rules` / `default`) anywhere in the payload —
    // a render tape has none of those keys, so their presence would mean a leaked champion doc.
    const text = JSON.stringify(body);

    expect(text).not.toContain('"rules"');
    expect(text).not.toContain('"default"');
  });

  it("serves a tape byte-identical to a direct renderTape on the arena params + the record's seed", async () => {
    const rec = record({ seeds: [3] });
    const rules = getMockRules();
    const match = { winGap: 1 } as const;

    const res = await handleReplay(
      itemReq(replayId(rec)),
      getDeps([rec], { rules, maxTicks: 10, match }),
    );

    const body = (await res.json()) as { tape: unknown };

    const expected = renderTape({
      rules,
      botA: rec.challenger,
      botB: rec.defenders[0],
      maxTicks: 10,
      seed: rec.seeds[0],
      match,
    });

    expect(body.tape).toEqual(expected);
  });

  it("marks a reconstructed replay immutable (content-addressed → safe to cache forever)", async () => {
    const rec = record();
    const res = await handleReplay(itemReq(replayId(rec)), getDeps([rec]));

    expect(res.headers.get("cache-control")).toContain("immutable");
  });

  it("returns 404 replay-not-found for an id that resolves to no record — without running a fight", async () => {
    const res = await handleReplay(itemReq("deadbeef"), getDeps([record()]));

    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toBe(
      "application/problem+json; charset=utf-8",
    );

    const body = (await res.json()) as { type: string };

    expect(body.type).toBe("/problems/replay-not-found");
  });

  it("returns 404 for a bootstrap record's id — a bootstrap crown is not a watchable fight", async () => {
    const bootstrap = record({ defenders: [] });

    const res = await handleReplay(
      itemReq(replayId(bootstrap)),
      getDeps([bootstrap, record()]),
    );

    expect(res.status).toBe(404);
  });
});

describe("GET /replay — the browsable list", () => {
  it("lists watchable fights newest-first, excluding bootstrap crowns, identities only", async () => {
    const oldRec = record({ challenger: bot("old", "m1", ATTACK_MID) });

    const bootstrap = record({
      challenger: bot("boot", "m0", ATTACK_MID),
      defenders: [],
    });

    const newRec = record({ challenger: bot("new", "m2", ATTACK_MID) });

    // Append order (oldest → newest); the list must reverse it and drop the bootstrap entry.
    const res = await handleReplay(
      listReq(),
      getDeps([oldRec, bootstrap, newRec]),
    );

    expect(res.status).toBe(200);

    const list = (await res.json()) as {
      id: string;
      fighters: { name: string; model: string }[];
    }[];

    expect(list.map((e) => e.fighters[0].name)).toEqual(["new", "old"]);
    expect(list[0].id).toBe(replayId(newRec));
    expect(list[0].fighters).toEqual([
      { name: "new", model: "m2" },
      { name: "king", model: "claude" },
    ]);
    // An entry carries ONLY id + fighters — no document, handle, or seniority.
    expect(Object.keys(list[0]).sort()).toEqual(["fighters", "id"]);
  });

  it("gives distinct fights distinct ids and the same fight a stable sha256 id", async () => {
    const recA = record({ challenger: bot("a", "m", ATTACK_MID) });
    const recB = record({ challenger: bot("b", "m", ATTACK_MID) });
    const deps = getDeps([recA, recB]);

    const first = (await (await handleReplay(listReq(), deps)).json()) as {
      id: string;
    }[];

    const second = (await (await handleReplay(listReq(), deps)).json()) as {
      id: string;
    }[];

    const ids = first.map((e) => e.id);

    expect(new Set(ids).size).toBe(2); // distinct fights → distinct ids
    expect(second.map((e) => e.id)).toEqual(ids); // stable across calls
    expect(ids[0]).toMatch(/^[0-9a-f]{64}$/); // sha256 hex
  });

  it("hashes a fight identically regardless of the key order its documents were written in", () => {
    // Two byte-equal challenger docs whose fields were built in a DIFFERENT order — an in-proc
    // record and one deserialized from Upstash can differ exactly this way. The content-addressed
    // id must be identical, or a permalink would break across the round-trip.
    const straight: BotDoc = {
      version: 1,
      name: "x",
      model: "m",
      rules: [],
      default: { type: "idle" },
    };

    const shuffled: BotDoc = {
      default: { type: "idle" },
      rules: [],
      model: "m",
      name: "x",
      version: 1,
    };

    expect(replayId(record({ challenger: shuffled }))).toBe(
      replayId(record({ challenger: straight })),
    );
  });

  it("gives the list a short public cache (mirrors /king)", async () => {
    const res = await handleReplay(listReq(), getDeps([record()]));

    expect(res.headers.get("cache-control")).toBe("public, max-age=30");
  });

  it("returns 200 [] for an empty archive", async () => {
    const res = await handleReplay(listReq(), getDeps([]));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("returns 200 [] when the archive holds only bootstrap crowns", async () => {
    const res = await handleReplay(
      listReq(),
      getDeps([record({ defenders: [] })]),
    );

    expect(await res.json()).toEqual([]);
  });
});

describe("/replay — method + store failure", () => {
  it("rejects a non-GET request with 405 and Allow: GET", async () => {
    const res = await handleReplay(
      new Request("https://mk.example/replay", { method: "POST" }),
      getDeps([record()]),
    );

    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("GET");

    const body = (await res.json()) as { type: string };

    expect(body.type).toBe("/problems/method-not-allowed");
  });

  it("returns 503 when the throne store is unreachable, never a silent empty list", async () => {
    const res = await handleReplay(
      listReq(),
      getDeps([], { store: throwingStore() }),
    );

    expect(res.status).toBe(503);

    const body = (await res.json()) as { type: string };

    expect(body.type).toBe("/problems/throne-unavailable");
  });
});
