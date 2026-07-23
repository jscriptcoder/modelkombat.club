import { describe, expect, it } from "vitest";

import {
  boutReplayId,
  handleReplay,
  type Bout,
  type ReplayDeps,
} from "./handle-replay.js";
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

// The King bout of a record — the challenger vs the champion at slot 0. For the single-defender
// records these fixtures build, it is the record's only bout, and its id is the headline id.
const kingBout = (rec: ReproRecord): Bout => ({
  challenger: rec.challenger,
  defender: rec.defenders[0],
  seed: rec.seeds[0],
  version: rec.version,
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

    const res = await handleReplay(
      itemReq(boutReplayId(kingBout(rec))),
      getDeps([rec]),
    );

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
      itemReq(boutReplayId(kingBout(rec))),
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

    const res = await handleReplay(
      itemReq(boutReplayId(kingBout(rec))),
      getDeps([rec]),
    );

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

  it("resolves no item id from a bootstrap crown — a crown that fought nobody has no bout", async () => {
    const bootstrap = record({ defenders: [] });

    // A bootstrap has no bouts, so nothing addresses it; the zero-bout record is skipped and any
    // well-formed sha256 misses (404), never a crash on its absent defenders[0].
    const res = await handleReplay(
      itemReq("a".repeat(64)),
      getDeps([bootstrap, record()]),
    );

    expect(res.status).toBe(404);
  });
});

describe("GET /replay/{id} — per-bout matchups (S3.1)", () => {
  // A submission whose challenger fought all three sitting champions — three distinct bouts, one
  // seed each. The King bout is defenders[0]/seeds[0]. The #2 champion attacks back, so its bout's
  // motion genuinely differs from the King bout (a robust distinctness check, not seed-luck).
  const threeBoutRecord = (): ReproRecord =>
    record({
      challenger: bot("alpha", "gpt", ATTACK_MID),
      defenders: [
        bot("king", "claude", IDLE),
        bot("second", "m2", ATTACK_MID),
        bot("third", "m3", IDLE),
      ],
      seeds: [3, 4, 5],
    });

  it("exposes every bout of the submission as a switchable matchup, headlined by the King bout", async () => {
    const rec = threeBoutRecord();
    const deps = getDeps([rec]);

    const list = (await (await handleReplay(listReq(), deps)).json()) as {
      id: string;
    }[];

    const headlineId = list[0].id;

    const item = (await (
      await handleReplay(itemReq(headlineId), deps)
    ).json()) as {
      matchups: { id: string; fighters: { name: string; model: string }[] }[];
    };

    // One matchup per defender, in board order (King first), challenger always fighters[0].
    expect(item.matchups.map((m) => m.fighters[1])).toEqual([
      { name: "king", model: "claude" },
      { name: "second", model: "m2" },
      { name: "third", model: "m3" },
    ]);
    expect(item.matchups.every((m) => m.fighters[0].name === "alpha")).toBe(
      true,
    );

    // Three distinct bout ids; the headline entry IS the King bout (matchups[0]).
    expect(new Set(item.matchups.map((m) => m.id)).size).toBe(3);
    expect(item.matchups[0].id).toBe(headlineId);

    // Doc-privacy holds across the new field — no champion documents in the matchups.
    const text = JSON.stringify(item);

    expect(text).not.toContain('"rules"');
    expect(text).not.toContain('"default"');
  });

  it("resolves each matchup id to that specific bout's byte-faithful tape", async () => {
    const rec = threeBoutRecord();
    const rules = getMockRules();
    const deps = getDeps([rec], { rules, maxTicks: 10 });

    const list = (await (await handleReplay(listReq(), deps)).json()) as {
      id: string;
    }[];

    const kingItem = (await (
      await handleReplay(itemReq(list[0].id), deps)
    ).json()) as {
      tape: unknown;
      matchups: { id: string }[];
    };

    // The #2 (second champion) matchup resolves to the challenger-vs-second reconstruction — byte
    // identical to a direct renderTape on defenders[1]/seeds[1], and distinct from the King bout.
    const secondId = kingItem.matchups[1].id;

    const secondItem = (await (
      await handleReplay(itemReq(secondId), deps)
    ).json()) as { tape: unknown };

    const expectedSecond = renderTape({
      rules,
      botA: rec.challenger,
      botB: rec.defenders[1],
      maxTicks: 10,
      seed: rec.seeds[1],
    });

    expect(secondItem.tape).toEqual(expectedSecond);
    expect(secondItem.tape).not.toEqual(kingItem.tape);
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
    expect(list[0].id).toBe(boutReplayId(kingBout(newRec)));
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

    expect(boutReplayId(kingBout(record({ challenger: shuffled })))).toBe(
      boutReplayId(kingBout(record({ challenger: straight }))),
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
