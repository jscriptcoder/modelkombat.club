import { describe, expect, it } from "vitest";

import { boutReplayIds } from "./handle-replay.js";
import { handleKing } from "./handle-king.js";
import {
  inMemoryThroneStore,
  type ArenaMember,
  type ArenaRecord,
  type ReproRecord,
  type ThroneStore,
} from "./throne-store.js";
import type { BotDoc } from "../engine/dsl.js";

// The version the /king read is scoped to (a test key — the real endpoint reads
// BENCHMARK_VERSION). An arena seated under a DIFFERENT version must read as empty.
const VERSION = "v-test";

// A champion whose document carries real `rules` (a DSL body). /king must surface the
// champion's IDENTITY only — the rules must never leak into the response, preserving the
// King's competitive edge (decision 5 / no-leak).
const champion = (overrides?: Partial<BotDoc>): BotDoc => ({
  version: 1,
  name: "reigning-king",
  model: "claude-opus-4-8",
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
  ...overrides,
});

const kingRequest = (method = "GET"): Request =>
  new Request("https://mk.example/king", { method });

// Interleave a control character into a string via its code point — keeps this source
// pure ASCII (git-diffable, formatter-safe) instead of embedding raw control bytes.
const ctrl = (code: number): string => String.fromCharCode(code);

// Build one arena member from a name (+ optional handle / doc overrides). Every member's
// champion doc carries a real `rules` body, so each test also proves identity-only projection.
const arenaMember = (
  name: string,
  opts?: { handle?: string | null; seniority?: number; doc?: Partial<BotDoc> },
): ArenaMember => ({
  champion: champion({ name, ...opts?.doc }),
  handle: opts?.handle ?? null,
  seniority: opts?.seniority ?? 1,
});

// Seat a ranked arena under a version (members already in rank order, `[0]` = King). Uses the
// arena commit path — the single source of truth /king reads.
const seatArena = (
  store: ThroneStore,
  members: ArenaMember[],
  version = VERSION,
): Promise<unknown> =>
  store.commitArena(version, null, {
    members,
    generation: 1,
    nextSeniority: members.length + 1,
  });

// The House seed the production /king injects (D15): three placeholder champions credited
// handle "Gauntlet" + model "House", in rank order (King first). handleKing surfaces these when
// the store is empty, projected identity-only like any champion row.
const houseSeed = (): ArenaRecord => ({
  members: [
    arenaMember("grappler", {
      handle: "Gauntlet",
      seniority: 1,
      doc: { model: "House" },
    }),
    arenaMember("sweeper", {
      handle: "Gauntlet",
      seniority: 2,
      doc: { model: "House" },
    }),
    arenaMember("rekka", {
      handle: "Gauntlet",
      seniority: 3,
      doc: { model: "House" },
    }),
  ],
  generation: 1,
  nextSeniority: 4,
});

// A store whose arena read fails — models Upstash being unreachable (the real adapter THROWS
// on an error reply, never silently reads empty). Drives the 503 path.
const failingStore = (): ThroneStore => ({
  readArena: () => Promise.reject(new Error("upstash unreachable")),
  readArchive: () => Promise.reject(new Error("unused in /king")),
  commitArena: () => Promise.reject(new Error("unused in /king")),
});

// A ranked arena record from members already in rank order (`[0]` = the King).
const arenaOf = (members: ArenaMember[]): ArenaRecord => ({
  members,
  generation: 1,
  nextSeniority: members.length + 1,
});

// A reproduction record: one champion's entry run captured as replay raw material — the
// challenger doc, the exact defenders it fought in board order (`[0]` = the then-King), the frozen
// seeds, and `memberSeniority`, the pin key tying the record to the arena member it seated (null
// for a non-placer). Distinct challenger names produce distinct content hashes, so two records
// built from this factory never collide.
const reproRecord = (overrides?: Partial<ReproRecord>): ReproRecord => ({
  challenger: champion({ name: "challenger" }),
  defenders: [champion({ name: "then-king" })],
  seeds: [7],
  version: VERSION,
  memberSeniority: 1,
  ...overrides,
});

// A store serving a fixed arena + a fixed archive. Hand-rolled rather than driven through
// `inMemoryThroneStore`'s commit path because these tests pin the JOIN, not the pin-and-retain
// rule — an arbitrary (record, member) pairing is exactly what the join must be proven against.
const storeWith = (
  arena: ArenaRecord | undefined,
  archive: ReproRecord[],
): ThroneStore => ({
  readArena: () => Promise.resolve(arena),
  readArchive: () => Promise.resolve(archive),
  commitArena: () => Promise.resolve({ ok: false, reason: "moved" }),
});

// A store whose ARENA reads fine but whose ARCHIVE is unreachable — the best-effort case: the
// champions must still be served, only their road to the throne is lost.
const archiveFailingStore = (arena: ArenaRecord): ThroneStore => ({
  readArena: () => Promise.resolve(arena),
  readArchive: () => Promise.reject(new Error("archive unreachable")),
  commitArena: () => Promise.resolve({ ok: false, reason: "moved" }),
});

const readKing = (store: ThroneStore, seed?: ArenaRecord): Promise<Response> =>
  handleKing(kingRequest(), { store, version: VERSION, seed });

type Champion = {
  name: string;
  model: string | null;
  handle: string | null;
  replayId: string | null;
};

type KingBody = {
  current: null | Champion;
  recent: Champion[];
};

// The public member fields: the champion's identity plus the id of the fight that seated them
// (`replayId`, null when unresolvable) — no `generation` (the throne CAS token left the contract
// in S3) and never the bot document.
const MEMBER_KEYS = ["handle", "model", "name", "replayId"] as const;

describe("GET /king — the version-scoped ranked-arena read", () => {
  it("returns the King's identity (name, model, handle) — and no generation", async () => {
    const store = inMemoryThroneStore();

    await seatArena(store, [
      arenaMember("reigning-king", { handle: "grandmaster" }),
    ]);

    const res = await handleKing(kingRequest(), { store, version: VERSION });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );

    const body = (await res.json()) as KingBody;

    expect(body.current).toEqual({
      name: "reigning-king",
      model: "claude-opus-4-8",
      handle: "grandmaster",
      // No archived record pins this seniority, so the road to the throne is unresolvable.
      replayId: null,
    });
    // The throne CAS token must NOT leak into the public read (dropped in S3).
    expect(body.current).not.toHaveProperty("generation");
  });

  it("projects current = King (arena #1) and recent = defenders (arena #2..N) in RANK order", async () => {
    const store = inMemoryThroneStore();

    await seatArena(store, [
      arenaMember("king", { handle: "a", seniority: 1 }),
      arenaMember("silver", { handle: "b", seniority: 2 }),
      arenaMember("bronze", { handle: "c", seniority: 3 }),
    ]);

    const res = await handleKing(kingRequest(), { store, version: VERSION });
    const body = (await res.json()) as KingBody;

    // current is arena #1 — not a defender (kills a members[1]-as-current mutant).
    expect(body.current?.name).toBe("king");
    // recent is the defenders below the King, in arena RANK order (not reversed, not time order).
    expect(body.recent.map((c) => c.name)).toEqual(["silver", "bronze"]);
    // the King never appears among the defenders (recent = slice(1), not slice(0)).
    expect(body.recent.map((c) => c.name)).not.toContain("king");
  });

  it("returns an empty recent when the arena holds only the King", async () => {
    const store = inMemoryThroneStore();

    await seatArena(store, [arenaMember("lonely-king")]);

    const res = await handleKing(kingRequest(), { store, version: VERSION });
    const body = (await res.json()) as KingBody;

    expect(body.current?.name).toBe("lonely-king");
    expect(body.recent).toEqual([]);
  });

  it("never leaks the champion's DSL/rules into the response", async () => {
    const store = inMemoryThroneStore();

    await seatArena(store, [arenaMember("reigning-king")]);

    const res = await handleKing(kingRequest(), { store, version: VERSION });
    const body = (await res.json()) as KingBody;

    // Exactly the three identity fields — no `rules`, no `version`, no `default`, no `generation`.
    expect(Object.keys(body.current ?? {}).sort()).toEqual([...MEMBER_KEYS]);

    // Defense in depth: no DSL token survives anywhere in the serialized payload.
    const raw = JSON.stringify(body);

    expect(raw).not.toContain("rules");
    expect(raw).not.toContain("canAct");
    expect(raw).not.toContain("default");
  });

  it("every recent entry is identity-only and carries no generation", async () => {
    const store = inMemoryThroneStore();

    await seatArena(store, [arenaMember("king"), arenaMember("challenger")]);

    const res = await handleKing(kingRequest(), { store, version: VERSION });
    const body = (await res.json()) as KingBody;

    expect(body.recent).toHaveLength(1);
    body.recent.forEach((entry) => {
      expect(Object.keys(entry).sort()).toEqual([...MEMBER_KEYS]);
      expect(entry).not.toHaveProperty("generation");
    });

    const rawRecent = JSON.stringify(body.recent);

    expect(rawRecent).not.toContain("rules");
    expect(rawRecent).not.toContain("canAct");
    expect(rawRecent).not.toContain("default");
  });

  it("defaults an absent model and handle to null (not omitted, not 'undefined')", async () => {
    const store = inMemoryThroneStore();

    // A champion doc with no `model`, seated with no `handle`.
    await seatArena(store, [
      arenaMember("k", { handle: null, doc: { model: undefined } }),
    ]);

    const res = await handleKing(kingRequest(), { store, version: VERSION });
    const body = (await res.json()) as KingBody;

    expect(body.current?.model).toBeNull();
    expect(body.current?.handle).toBeNull();
  });

  it("reads empty for a version with no arena (a success, not an error)", async () => {
    const store = inMemoryThroneStore();

    // Seat an arena under a DIFFERENT version — the scoped read must still be empty.
    await seatArena(store, [arenaMember("elsewhere")], "other-version");

    const res = await handleKing(kingRequest(), { store, version: VERSION });

    expect(res.status).toBe(200);

    const body = (await res.json()) as KingBody;

    expect(body.current).toBeNull();
    expect(body.recent).toEqual([]);
  });

  it("reads empty current + empty recent when no champion has been crowned", async () => {
    const store = inMemoryThroneStore();

    const res = await handleKing(kingRequest(), { store, version: VERSION });
    const body = (await res.json()) as KingBody;

    expect(body.current).toBeNull();
    expect(body.recent).toEqual([]);
  });

  it("returns the injected House seed when the arena is empty (current = King, recent = defenders)", async () => {
    const store = inMemoryThroneStore(); // empty

    const res = await handleKing(kingRequest(), {
      store,
      version: VERSION,
      seed: houseSeed(),
    });

    const body = (await res.json()) as KingBody;

    // current is the seed's King (arena #1), credited handle Gauntlet + model House.
    expect(body.current).toEqual({
      name: "grappler",
      model: "House",
      handle: "Gauntlet",
      // A seeded House champion fought nobody to get here — no entry bout to watch (AC2).
      replayId: null,
    });
    // recent is the two House defenders below the King, in rank order.
    expect(body.recent.map((c) => c.name)).toEqual(["sweeper", "rekka"]);
    body.recent.forEach((c) => {
      expect(c.handle).toBe("Gauntlet");
      expect(c.model).toBe("House");
    });
  });

  it("projects the House seed identity-only — no rules/doc leak", async () => {
    const store = inMemoryThroneStore();

    const res = await handleKing(kingRequest(), {
      store,
      version: VERSION,
      seed: houseSeed(),
    });

    const body = (await res.json()) as KingBody;

    expect(Object.keys(body.current ?? {}).sort()).toEqual([...MEMBER_KEYS]);

    const raw = JSON.stringify(body);

    expect(raw).not.toContain("rules");
    expect(raw).not.toContain("canAct");
  });

  it("ignores the seed when a real arena exists (the stored King wins)", async () => {
    const store = inMemoryThroneStore();

    await seatArena(store, [arenaMember("real-king", { handle: "human" })]);

    const res = await handleKing(kingRequest(), {
      store,
      version: VERSION,
      seed: houseSeed(),
    });

    const body = (await res.json()) as KingBody;

    expect(body.current?.name).toBe("real-king");
    expect(body.current?.handle).toBe("human");
  });

  it("strips control characters from identity strings for current and every recent entry", async () => {
    const store = inMemoryThroneStore();

    // Two members whose name/model/handle carry C0 + DEL control characters. Boundary
    // coverage: 0x1F is stripped while the adjacent 0x20 space survives; 0x7F (DEL) is
    // stripped while the adjacent 0x7E "~" survives — pinning both edges of the strip range.
    await seatArena(store, [
      arenaMember(`new~${ctrl(0x7f)}king`, {
        handle: `he${ctrl(0x02)}ir`, // -> "heir"
        doc: { model: `opus${ctrl(0x1f)}x` }, // -> "opusx"
      }),
      arenaMember(`ka${ctrl(0x00)}ta ${ctrl(0x1f)}master`, {
        handle: `gr${ctrl(0x01)}and`, // -> "grand"
        doc: { model: `claude${ctrl(0x07)}opus` }, // -> "claudeopus"
      }),
    ]);

    const res = await handleKing(kingRequest(), { store, version: VERSION });
    const body = (await res.json()) as KingBody;

    // The King (arena #1) is sanitized...
    expect(body.current).toEqual({
      name: "new~king",
      model: "opusx",
      handle: "heir",
      replayId: null,
    });
    // ...and so is the defender (every entry, not just current).
    expect(body.recent[0]).toEqual({
      name: "kata master",
      model: "claudeopus",
      handle: "grand",
      replayId: null,
    });
  });

  it("leaves ordinary and markup-bearing identity strings unchanged", async () => {
    const store = inMemoryThroneStore();

    // Spaces (0x20), `<`, `>`, `(` are all printable (≥ 0x20) — sanitization must not touch
    // them, so the auto-escaping behavior (inert markup) is preserved. The embedded spaces
    // also pin the top edge of the strip range (0x20 must survive).
    await seatArena(store, [
      arenaMember("Grand Master <script>alert(1)</script>", {
        handle: "kata-master",
        doc: { model: "claude-opus-4-8" },
      }),
    ]);

    const res = await handleKing(kingRequest(), { store, version: VERSION });
    const body = (await res.json()) as KingBody;

    expect(body.current).toEqual({
      name: "Grand Master <script>alert(1)</script>",
      model: "claude-opus-4-8",
      handle: "kata-master",
      replayId: null,
    });
  });

  it("returns 503 problem+json when the arena store is unreachable", async () => {
    const res = await handleKing(kingRequest(), {
      store: failingStore(),
      version: VERSION,
    });

    expect(res.status).toBe(503);
    expect(res.headers.get("content-type")).toBe(
      "application/problem+json; charset=utf-8",
    );

    const body = (await res.json()) as {
      type: string;
      status: number;
      title: string;
    };

    expect(body.type).toBe("/problems/throne-unavailable");
    expect(body.status).toBe(503);
    expect(body.title).toBeTruthy(); // a human-readable RFC 9457 summary, never empty
  });

  it("rejects a non-GET request with 405 and an Allow: GET header", async () => {
    const store = inMemoryThroneStore();

    await seatArena(store, [arenaMember("king")]);

    const res = await handleKing(kingRequest("POST"), {
      store,
      version: VERSION,
    });

    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("GET");
    expect(res.headers.get("content-type")).toBe(
      "application/problem+json; charset=utf-8",
    );

    const body = (await res.json()) as { type: string; title: string };

    expect(body.type).toBe("/problems/method-not-allowed");
    expect(body.title).toBeTruthy(); // a human-readable RFC 9457 summary, never empty
  });

  it("caches a 200 read briefly but never caches a 503", async () => {
    const store = inMemoryThroneStore();

    await seatArena(store, [arenaMember("king")]);

    const ok = await handleKing(kingRequest(), { store, version: VERSION });

    expect(ok.headers.get("cache-control")).toBe("public, max-age=30");

    const down = await handleKing(kingRequest(), {
      store: failingStore(),
      version: VERSION,
    });

    expect(down.headers.get("cache-control")).toBeNull();
  });
});

// Each champion carries the id of the fight that seated them, so a visitor can jump from a name
// on the podium to the bout that put it there. The id is resolved server-side by joining the
// reproduction archive onto the arena on SENIORITY — the pin key — and the join is best-effort:
// an unreachable archive costs the links, never the champions.
describe("GET /king — each champion's road to the throne", () => {
  it("resolves every member's replayId to the entry bout of the record pinned to their seniority", async () => {
    const kingRecord = reproRecord({
      challenger: champion({ name: "warden" }),
      memberSeniority: 4,
    });

    const defenderRecord = reproRecord({
      challenger: champion({ name: "vulture" }),
      memberSeniority: 9,
    });

    // Archive order is deliberately NOT arena order: the join is by seniority, so a positional
    // pairing (archive[i] ↔ members[i]) would swap these two and fail.
    const store = storeWith(
      arenaOf([
        arenaMember("warden", { seniority: 4 }),
        arenaMember("vulture", { seniority: 9 }),
      ]),
      [defenderRecord, kingRecord],
    );

    const body = (await (await readKing(store)).json()) as KingBody;

    expect(body.current?.replayId).toBe(boutReplayIds(kingRecord)[0]);
    // Resolved for the defenders too, not only the King.
    expect(body.recent[0]?.replayId).toBe(boutReplayIds(defenderRecord)[0]);
    expect(body.current?.replayId).not.toBe(body.recent[0]?.replayId);
  });

  it("targets the bout against the then-King — the record's FIRST bout, not a later one", async () => {
    const record = reproRecord({
      memberSeniority: 4,
      defenders: [
        champion({ name: "then-king" }),
        champion({ name: "silver" }),
        champion({ name: "bronze" }),
      ],
      seeds: [7, 8, 9],
    });

    const ids = boutReplayIds(record);

    // The record really does carry later bouts that could be picked by mistake.
    expect(ids).toHaveLength(3);

    const store = storeWith(
      arenaOf([arenaMember("warden", { seniority: 4 })]),
      [record],
    );

    const body = (await (await readKing(store)).json()) as KingBody;

    expect(body.current?.replayId).toBe(ids[0]);
    expect(body.current?.replayId).not.toBe(ids[1]);
    expect(body.current?.replayId).not.toBe(ids[2]);
  });

  it("resolves null for a member no archived record is pinned to", async () => {
    const store = storeWith(
      arenaOf([arenaMember("orphan", { seniority: 7 })]),
      [reproRecord({ memberSeniority: 1 })],
    );

    const body = (await (await readKing(store)).json()) as KingBody;

    // The whole projection, so an OMITTED key fails too: a dropped `?? null` would serialize to
    // no `replayId` at all, which reads to the client as "field missing", not "no fight".
    expect(body.current).toEqual({
      name: "orphan",
      model: "claude-opus-4-8",
      handle: null,
      replayId: null,
    });
  });

  it("resolves null for a member whose record captured no bouts (a bootstrap crown)", async () => {
    const bootstrap = reproRecord({
      memberSeniority: 4,
      defenders: [],
      seeds: [],
    });

    // A first champion fought nobody — there is no addressable bout to link to.
    expect(boutReplayIds(bootstrap)).toEqual([]);

    const store = storeWith(arenaOf([arenaMember("first", { seniority: 4 })]), [
      bootstrap,
    ]);

    const body = (await (await readKing(store)).json()) as KingBody;

    expect(body.current?.replayId).toBeNull();
  });

  it("never matches a non-placer's record, even when its challenger shares the member's name", async () => {
    // An unplaced submission still archives a record — with `memberSeniority: null`, since it
    // seated nobody. It must never be mistaken for a member's entry run.
    const store = storeWith(
      arenaOf([arenaMember("warden", { seniority: 4 })]),
      [
        reproRecord({
          challenger: champion({ name: "warden" }),
          memberSeniority: null,
        }),
      ],
    );

    const body = (await (await readKing(store)).json()) as KingBody;

    expect(body.current?.replayId).toBeNull();
  });

  it("joins on seniority, never on name — two champions can share a name", async () => {
    const elder = reproRecord({
      challenger: champion({ name: "warden" }),
      memberSeniority: 4,
    });

    const younger = reproRecord({
      challenger: champion({ name: "warden" }),
      defenders: [champion({ name: "the-elder-warden" })],
      memberSeniority: 9,
    });

    const store = storeWith(
      arenaOf([
        arenaMember("warden", { seniority: 4 }),
        arenaMember("warden", { seniority: 9 }),
      ]),
      [elder, younger],
    );

    const body = (await (await readKing(store)).json()) as KingBody;

    // Same name, different fights: a name-based join would give both the same id.
    expect(body.current?.replayId).toBe(boutReplayIds(elder)[0]);
    expect(body.recent[0]?.replayId).toBe(boutReplayIds(younger)[0]);
    expect(body.current?.replayId).not.toBe(body.recent[0]?.replayId);
  });

  it("still returns 200 with every replayId null when the ARCHIVE is unreachable", async () => {
    const store = archiveFailingStore(
      arenaOf([
        arenaMember("warden", { handle: "human", seniority: 4 }),
        arenaMember("vulture", { seniority: 9 }),
      ]),
    );

    const res = await readKing(store);

    // Best-effort: /king feeds the home page's King and Arena sections, so an archive outage
    // must cost the links only — never the champions (which a 503 would blank).
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );

    const body = (await res.json()) as KingBody;

    expect(body.current).toEqual({
      name: "warden",
      model: "claude-opus-4-8",
      handle: "human",
      replayId: null,
    });
    expect(body.recent.map((c) => c.name)).toEqual(["vulture"]);
    expect(body.recent.map((c) => c.replayId)).toEqual([null]);
  });

  it("still returns 503 when the ARENA is unreachable but the archive reads fine", async () => {
    const store: ThroneStore = {
      readArena: () => Promise.reject(new Error("upstash unreachable")),
      readArchive: () => Promise.resolve([reproRecord()]),
      commitArena: () => Promise.resolve({ ok: false, reason: "moved" }),
    };

    const res = await readKing(store);

    // The champions themselves are unreadable — that is still an outage, not an empty throne.
    expect(res.status).toBe(503);

    const body = (await res.json()) as { type: string };

    expect(body.type).toBe("/problems/throne-unavailable");
  });

  it("gives the House seed no replayId even when unplaced submissions have been archived", async () => {
    // The seed surfaces when nobody has PLACED this season — but the archive can still hold
    // non-placers' records by then. None of them seated a House champion.
    const store = storeWith(undefined, [
      reproRecord({ memberSeniority: null }),
      reproRecord({
        challenger: champion({ name: "another" }),
        memberSeniority: null,
      }),
    ]);

    const body = (await (
      await readKing(store, houseSeed())
    ).json()) as KingBody;

    expect(body.current?.replayId).toBeNull();
    expect(body.recent.map((c) => c.replayId)).toEqual([null, null]);
  });
});
