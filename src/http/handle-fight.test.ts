import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { handleFight, type FightDeps } from "./handle-fight.js";
import {
  inMemoryThroneStore,
  type ArenaMember,
  type ArenaRecord,
  type ThroneStore,
} from "./throne-store.js";
import { loadBotDoc } from "../cli/load.js";
import { CANONICAL_RULES } from "../engine/rules.js";
import { MATCH } from "../engine/benchmark-config.js";
import type { BotDoc } from "../engine/dsl.js";

// A real example fighter loaded from `bots/<name>.json` (same path pattern as
// `gauntlet.ts`). Used where a bot must genuinely CLEAR the injected gauntlet or
// produce a known head-to-head verdict (berserker/pacer beat aggressor 1.00).
const loadBot = (name: string): BotDoc =>
  loadBotDoc(
    readFileSync(
      fileURLToPath(new URL(`../../bots/${name}.json`, import.meta.url)),
      "utf8",
    ),
  );

// An idle punching bag: scores nothing, so a competent attacker clears it > 50% on
// both sides; a non-attacking mover cannot (all draws → winRate 0). Deterministic.
const dummy = (): BotDoc => ({
  version: 1,
  name: "dummy",
  model: "test",
  rules: [],
  default: { type: "idle" },
});

// A bot that only walks (never attacks) — cannot beat the idle dummy (draws), so it
// FAILS the gate. Distinct document from `dummy` ⇒ no no-mirror skip.
const mover = (): BotDoc => ({
  version: 1,
  name: "mover",
  model: "test",
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

// The injected "arena": a 1-member idle gauntlet + a test version key + the real engine
// config + the frozen arena cap N=3. Arena fights reuse `seeds` (D-A: a deterministic
// tournament graph, no fresh entropy) — 5 seeds × both sides ⇒ 10 bouts per pairing.
const arena = (version: string, store: FightDeps["store"]): FightDeps => ({
  gauntlet: [dummy()],
  gauntletNames: ["dummy"],
  seeds: [1, 2, 3, 4, 5],
  maxTicks: 600,
  rules: CANONICAL_RULES,
  match: MATCH,
  version,
  store,
  n: 3,
});

// Pre-seat a lone champion in the fake store's arena (bypassing the clearing gate — this King
// already reigns as arena #1 at generation 1, seniority 1). A challenger POSTed to `handleFight`
// must still clear the injected idle-dummy gauntlet to earn a title shot against the arena.
const enthrone = (
  store: FightDeps["store"],
  version: string,
  champion: BotDoc,
): Promise<unknown> =>
  store.commitArena(version, null, {
    members: [{ champion, handle: null, seniority: 1 }],
    generation: 1,
    nextSeniority: 2,
  });

// Pre-seat a multi-member ranked arena (rank-ordered members; nextSeniority past the last stamp).
const seatArena = (
  store: FightDeps["store"],
  version: string,
  members: ArenaMember[],
): Promise<unknown> =>
  store.commitArena(version, null, {
    members,
    generation: 1,
    nextSeniority: members.length + 1,
  });

// A store modelling an arena CAS race: `readArena` returns the arena as this request first SAW it
// (`seenAtRead`), while `commitArena` runs against `inner` — which a concurrent placement has
// already moved on. So a commit using the stale-read generation is rejected as `moved`.
const staleArenaStore = (
  inner: ThroneStore,
  seenAtRead: ArenaRecord | undefined,
): FightDeps["store"] => ({
  readArena: () => Promise.resolve(seenAtRead),
  readArchive: inner.readArchive,
  commitArena: inner.commitArena,
});

// A valid stand-in handle every placement/title test carries by default — the handle is REQUIRED
// on `/fight`, so throne-mechanics tests supply this and stay focused on ranking.
const DEFAULT_HANDLE = "test-author";

// Throne-mechanics tests verify COMPETE behavior (crowning, ranking, archive), so `fightRequest`
// makes that intent explicit with `X-Compete: true` — otherwise the Slice 2 default flip (absent →
// practice) would turn every crowning assertion into a footprint-free projection. Callers override the
// header (e.g. `"false"`) to exercise practice; `noCompeteRequest` omits it to probe the DEFAULT.
const fightRequest = (
  body: string,
  headers?: Record<string, string>,
): Request =>
  new Request("https://mk.example/fight", {
    method: "POST",
    body,
    headers: {
      "X-Author-Handle": DEFAULT_HANDLE,
      "X-Compete": "true",
      ...headers,
    },
  });

// A request carrying the handle but NO X-Compete header — exercises the header's DEFAULT intent
// (practice, post-flip). `fightRequest` forces `X-Compete: true`, so a bare default needs its own ctor.
const noCompeteRequest = (body: string): Request =>
  new Request("https://mk.example/fight", {
    method: "POST",
    body,
    headers: { "X-Author-Handle": DEFAULT_HANDLE },
  });

const noHandleRequest = (body: string): Request =>
  new Request("https://mk.example/fight", { method: "POST", body });

// An idle champion carrying a `model` field (provenance the interpreter never reads).
const modelChamp = (model: string): BotDoc => ({
  version: 1,
  name: "modelking",
  model,
  rules: [],
  default: { type: "idle" },
});

// A champion whose stored document OMITS `model` — models a King crowned BEFORE
// model became mandatory (legacy throne data). The BotDoc type now requires
// `model`, so we deliberately drop it to exercise the API's null-defaulting on
// pre-gate persisted records (the justified assertion is the point of the test).
const modellessChamp = (): BotDoc => {
  const { model: _drop, ...doc } = modelChamp("unused");

  return doc as BotDoc;
};

// The reigning King's identity now rides in `board[0].defender` (S4.3 retired the flat
// `title.incumbent`) — board[0] is always the King, since the board is arena rank order.
type KingIdentity = {
  name: string;
  model: string | null;
  handle: string | null;
};
type IncumbentBody = {
  title?: {
    outcome: string;
    rank?: number;
    board?: { defender: KingIdentity }[];
  };
};

describe("handleFight — S2.1: empty-arena bootstrap crowning (N=3)", () => {
  it("crowns the first gauntlet-clearer on an empty version arena", async () => {
    const store = inMemoryThroneStore();
    const clearer = loadBot("aggressor");

    const res = await handleFight(
      fightRequest(JSON.stringify(clearer)),
      arena("vTEST", store),
    );

    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      cleared: boolean;
      title?: { outcome: string; rank: number };
    };

    expect(body.cleared).toBe(true);
    expect(body.title?.outcome).toBe("crowned");
    expect(body.title?.rank).toBe(1);

    // the champion is persisted as the sole arena member at generation 1
    const after = await store.readArena("vTEST");

    expect(after?.generation).toBe(1);
    expect(after?.members[0].champion).toEqual(clearer);
    expect(after?.members).toHaveLength(1);
  });

  it("omits the incumbent from an empty-arena crown (you fought no one)", async () => {
    const store = inMemoryThroneStore();

    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("aggressor"))),
      arena("vTEST", store),
    );

    const body = (await res.json()) as { title?: Record<string, unknown> };

    expect(body.title?.outcome).toBe("crowned");
    expect(body.title).not.toHaveProperty("incumbent");
  });

  it("does not place or emit a title when the bot fails the gate", async () => {
    const store = inMemoryThroneStore();

    const res = await handleFight(
      fightRequest(JSON.stringify(mover())),
      arena("vTEST", store),
    );

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.cleared).toBe(false);
    expect(body).not.toHaveProperty("title");
    expect(await store.readArena("vTEST")).toBeUndefined();
  });

  it("treats the current version arena as empty even when another version is occupied", async () => {
    const store = inMemoryThroneStore();
    const other = loadBot("berserker");

    await enthrone(store, "vOTHER", other);

    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("aggressor"))),
      arena("vTEST", store),
    );

    const body = (await res.json()) as { title?: { outcome: string } };

    expect(body.title?.outcome).toBe("crowned");

    const otherArena = await store.readArena("vOTHER");

    expect(otherArena?.members[0].champion).toEqual(other);
    expect(otherArena?.members).toHaveLength(1);
  });
});

describe("handleFight — S2.1: ranked filling of a non-full arena", () => {
  it("ENTERS a clearer at #2 when it loses to the lone King (there is room — C2)", async () => {
    const store = inMemoryThroneStore();
    const king = loadBot("berserker");

    await enthrone(store, "vTEST", king);

    const challenger = loadBot("aggressor"); // loses to berserker 0.00

    const res = await handleFight(
      fightRequest(JSON.stringify(challenger)),
      arena("vTEST", store),
    );

    const body = (await res.json()) as {
      title?: { outcome: string; rank: number; winRate: number };
    };

    // the loser is NOT bounced (old N=1 "king-retained") — it joins as defender #2
    expect(body.title?.outcome).toBe("entered");
    expect(body.title?.rank).toBe(2);

    // the arena advanced to two members, King first, challenger second; generation bumped
    const arenaAfter = await store.readArena("vTEST");

    expect(arenaAfter?.members.map((m) => m.champion.name)).toEqual([
      "berserker",
      "aggressor",
    ]);
    expect(arenaAfter?.generation).toBe(2);
    expect(arenaAfter?.nextSeniority).toBe(3);
  });

  it("CROWNS a clearer that beats the lone King, keeping the deposed King as defender #2", async () => {
    const store = inMemoryThroneStore();
    const king = loadBot("aggressor");

    await enthrone(store, "vTEST", king);

    const challenger = loadBot("berserker"); // beats aggressor 1.00

    const res = await handleFight(
      fightRequest(JSON.stringify(challenger)),
      arena("vTEST", store),
    );

    const body = (await res.json()) as {
      title?: { outcome: string; rank: number };
    };

    expect(body.title?.outcome).toBe("crowned");
    expect(body.title?.rank).toBe(1);

    // the old King is kept as defender #2 (NOT removed); challenger stamped seniority 2
    const arenaAfter = await store.readArena("vTEST");

    expect(arenaAfter?.members.map((m) => m.champion.name)).toEqual([
      "berserker",
      "aggressor",
    ]);
    expect(arenaAfter?.members[0].seniority).toBe(2);
    expect(arenaAfter?.generation).toBe(2);
    expect(arenaAfter?.nextSeniority).toBe(3);
  });

  it("does NOT crown a clearer that only ties the King (exact 0.5) — it enters at #2 on seniority", async () => {
    const store = inMemoryThroneStore();
    const king = loadBot("zoner");

    await enthrone(store, "vTEST", king);

    // a twin (King's rules, different name) scores EXACTLY 0.5 — 0 Copeland wins by the strict
    // `> 0.5` rule. A `>= 0.5` mutant would still tie, so seniority keeps the King #1 either way;
    // the crux is that a level fight never CROWNS.
    const twin: BotDoc = { ...king, name: "zoner-twin" };

    const res = await handleFight(
      fightRequest(JSON.stringify(twin)),
      arena("vTEST", store),
    );

    const body = (await res.json()) as {
      title?: { outcome: string; rank: number; board?: { winRate: number }[] };
    };

    expect(body.title?.board?.[0].winRate).toBe(0.5);
    expect(body.title?.outcome).toBe("entered"); // NOT crowned
    expect(body.title?.rank).toBe(2);
    expect((await store.readArena("vTEST"))?.members[0].champion.name).toBe(
      "zoner",
    ); // King held #1
  });

  it("runs the full round-robin — a defender-vs-defender fight sets the DEFENDERS' order", async () => {
    const store = inMemoryThroneStore();

    // Seat a 2-member arena [aggressor(#1), dummy(#2)]. The challenger (berserker) beats BOTH, so
    // it crowns regardless — but ranking aggressor ABOVE dummy at #2/#3 requires the aggressor-vs-
    // dummy fight to be run (aggressor beats the idle dummy; without that fight both would tie at
    // zero wins-vs-the-challenger and fall to seniority, which happens to agree — so we assert the
    // WIN-COUNT-driven order stands: attacker over punching bag).
    await seatArena(store, "vTEST", [
      { champion: loadBot("aggressor"), handle: null, seniority: 1 },
      { champion: dummy(), handle: null, seniority: 2 },
    ]);

    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("berserker"))),
      arena("vTEST", store),
    );

    const body = (await res.json()) as { title?: { outcome: string } };

    expect(body.title?.outcome).toBe("crowned");

    // all three kept, rank-ordered: challenger (beat both) → aggressor (beat dummy) → dummy (beat none)
    expect(
      (await store.readArena("vTEST"))?.members.map((m) => m.champion.name),
    ).toEqual(["berserker", "aggressor", "dummy"]);
  });
});

describe("handleFight — S2.2: a FULL arena relegates its weakest", () => {
  it("ENTERS a mid-ranked challenger and relegates the weakest defender (the dummy)", async () => {
    const store = inMemoryThroneStore();

    // Full arena: two attackers that each beat aggressor 1.00, plus an idle dummy. The challenger
    // (aggressor) beats only the dummy, so it ranks above the dummy but below both attackers — it
    // enters at #3 and the dummy (0 wins) relegates. Robust to the berserker-vs-pacer order.
    await seatArena(store, "vTEST", [
      { champion: loadBot("berserker"), handle: null, seniority: 1 },
      { champion: loadBot("pacer"), handle: null, seniority: 2 },
      { champion: dummy(), handle: null, seniority: 3 },
    ]);

    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("aggressor"))),
      arena("vTEST", store),
    );

    const body = (await res.json()) as {
      title?: {
        outcome: string;
        rank: number;
        displaced?: {
          name: string;
          model: string | null;
          handle: string | null;
        };
      };
    };

    expect(body.title?.outcome).toBe("entered");
    expect(body.title?.rank).toBe(3);
    // the relegated defender is surfaced by IDENTITY only — never its bot document
    expect(body.title?.displaced).toEqual({
      name: "dummy",
      model: "test",
      handle: null,
    });
    expect(JSON.stringify(body.title?.displaced)).not.toContain('"rules"');

    const after = await store.readArena("vTEST");

    // the arena is still 3, the challenger seated at #3 with a fresh stamp, the dummy evicted
    expect(after?.members).toHaveLength(3);
    expect(after?.members[2].champion.name).toBe("aggressor");
    expect(after?.members[2].seniority).toBe(4);
    expect(after?.members.map((m) => m.champion.name)).not.toContain("dummy");
    expect(after?.generation).toBe(2);
  });

  it("CROWNS a challenger that beats the whole arena, relegating the weakest and growing the lineage", async () => {
    const store = inMemoryThroneStore();
    const aggressor2: BotDoc = { ...loadBot("aggressor"), name: "aggressor-2" };

    // Full arena: two aggressors (King + twin) and a dummy. The challenger (berserker) beats all
    // three (berserker beats aggressor 1.00, and the idle dummy), so it crowns; the dummy (0 wins)
    // relegates. The King changes (aggressor → berserker), so the succession lineage grows.
    await seatArena(store, "vTEST", [
      { champion: loadBot("aggressor"), handle: null, seniority: 1 },
      { champion: aggressor2, handle: null, seniority: 2 },
      { champion: dummy(), handle: null, seniority: 3 },
    ]);

    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("berserker"))),
      arena("vTEST", store),
    );

    const body = (await res.json()) as {
      title?: { outcome: string; rank: number; displaced?: { name: string } };
    };

    expect(body.title?.outcome).toBe("crowned");
    expect(body.title?.rank).toBe(1);
    expect(body.title?.displaced?.name).toBe("dummy");

    const after = await store.readArena("vTEST");

    expect(after?.members[0].champion.name).toBe("berserker"); // the new King
    expect(after?.members).toHaveLength(3);
    expect(after?.members.map((m) => m.champion.name)).not.toContain("dummy");
  });

  it("leaves a challenger ranked below the FULL arena UNPLACED, committing nothing", async () => {
    const inner = inMemoryThroneStore();
    const berserker2: BotDoc = { ...loadBot("berserker"), name: "berserker-2" };

    // Full arena: three bots that each beat aggressor 1.00. The challenger (aggressor) beats none
    // of them, so it is uniquely last (0 wins) — unplaced, and the arena is untouched.
    await seatArena(inner, "vTEST", [
      { champion: loadBot("berserker"), handle: null, seniority: 1 },
      { champion: loadBot("pacer"), handle: null, seniority: 2 },
      { champion: berserker2, handle: null, seniority: 3 },
    ]);

    const before = await inner.readArena("vTEST");

    // Wrap the store so a stray commit on the unplaced path is caught, not just inferred from state.
    let commits = 0;

    const store: FightDeps["store"] = {
      readArena: inner.readArena,
      readArchive: inner.readArchive,
      commitArena: (v, e, n, r) => {
        commits += 1;

        return inner.commitArena(v, e, n, r);
      },
    };

    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("aggressor"))),
      arena("vTEST", store),
    );

    const body = (await res.json()) as {
      title?: {
        outcome: string;
        rank?: number;
        board?: {
          defender: {
            name: string;
            model: string | null;
            handle: string | null;
          };
          winRate: number;
          bouts: number;
        }[];
      };
    };

    expect(body.title?.outcome).toBe("unplaced");
    expect(body.title).not.toHaveProperty("rank");
    // full parity: the unplaced clearer still fought the #1 King, so board[0] diagnoses that fight
    // at the same fidelity as an `entered` placement (D-C diagnose-don't-guess).
    expect(body.title?.board?.[0].defender).toEqual({
      name: "berserker",
      model: "house",
      handle: null,
    });
    expect(body.title?.board?.[0].bouts).toBe(10);
    expect(body.title?.board?.[0].winRate).toBe(0); // lost all ten to the King
    // S4.3: the flat King scout is retired — the King fight is read from board[0], never a top-level key
    expect(body.title).not.toHaveProperty("incumbent");
    expect(body.title).not.toHaveProperty("winRate");
    expect(body.title).not.toHaveProperty("bouts");

    // S5.1: a non-placer now COMMITS once — to archive its reproduction record, gen-guarded against
    // the arena it fought — but leaves the arena byte-identical (it entered no slot).
    expect(commits).toBe(1);
    expect(await inner.readArena("vTEST")).toEqual(before);

    // its record is archived: the challenger, the three defenders it fought, and memberSeniority null
    // (a non-placer is never an arena member, so its record is unpinnable).
    const archive = await inner.readArchive("vTEST");
    expect(archive).toHaveLength(1);
    expect(archive[0].challenger.name).toBe("aggressor");
    expect(archive[0].defenders.map((d) => d.name)).toEqual([
      "berserker",
      "pacer",
      "berserker-2",
    ]);
    expect(archive[0].memberSeniority).toBeNull();
  });
});

describe("handleFight — S2.1: concurrent placements serialize (409 throne-moved)", () => {
  it("409s a winning placement when the arena advanced since the read", async () => {
    const inner = inMemoryThroneStore();
    const king = loadBot("aggressor");
    const usurper = loadBot("berserker"); // a concurrent crown that lands first

    await inner.commitArena("vTEST", null, {
      members: [{ champion: king, handle: null, seniority: 1 }],
      generation: 1,
      nextSeniority: 2,
    });
    await inner.commitArena("vTEST", 1, {
      members: [{ champion: usurper, handle: null, seniority: 2 }],
      generation: 2,
      nextSeniority: 3,
    });

    // our request read the arena at generation 1, before that concurrent crown landed
    const store = staleArenaStore(inner, {
      members: [{ champion: king, handle: null, seniority: 1 }],
      generation: 1,
      nextSeniority: 2,
    });

    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("pacer"))), // pacer beats aggressor 1.00 → would place
      arena("vTEST", store),
    );

    expect(res.status).toBe(409);
    expect(res.headers.get("content-type")).toContain(
      "application/problem+json",
    );

    const body = (await res.json()) as { type: string; title: string };

    expect(body.type).toBe("/problems/throne-moved");
    expect(body.title).toContain("resubmit");

    // the arena still holds the concurrent winner; the loser (pacer) was NOT written
    expect((await inner.readArena("vTEST"))?.members[0].champion).toEqual(
      usurper,
    );
    // S5.1: nothing tears on a lost race — the loser's reproduction record is NOT archived either
    expect(await inner.readArchive("vTEST")).toEqual([]);
  });

  it("409s a bootstrap crown when the empty arena was claimed since the read", async () => {
    const inner = inMemoryThroneStore();
    const usurper = loadBot("berserker");

    await inner.commitArena("vTEST", null, {
      members: [{ champion: usurper, handle: null, seniority: 1 }],
      generation: 1,
      nextSeniority: 2,
    });

    // our request read the arena as EMPTY, before that claim landed
    const store = staleArenaStore(inner, undefined);

    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("aggressor"))),
      arena("vTEST", store),
    );

    expect(res.status).toBe(409);
    expect(((await res.json()) as { type: string }).type).toBe(
      "/problems/throne-moved",
    );
    expect((await inner.readArena("vTEST"))?.members[0].champion).toEqual(
      usurper,
    );
    // S5.1: the bootstrap loser archived nothing on the lost race
    expect(await inner.readArchive("vTEST")).toEqual([]);
  });
});

describe("handleFight — S2.1: incumbent identity + author handle", () => {
  it("surfaces the incumbent's name/model/handle in the title block, never the doc", async () => {
    const store = inMemoryThroneStore();
    const king = loadBot("berserker"); // enthroned without a handle ⇒ handle null

    await enthrone(store, "vTEST", king);

    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("aggressor"))), // loses ⇒ enters at #2
      arena("vTEST", store),
    );

    const body = (await res.json()) as IncumbentBody;

    expect(body.title?.outcome).toBe("entered");
    expect(body.title?.board?.[0].defender).toEqual({
      name: "berserker",
      model: "house",
      handle: null,
    });
    // the King's bot DOCUMENT never leaks into the response
    expect(JSON.stringify(body.title)).not.toContain('"rules"');
    expect(JSON.stringify(body.title)).not.toContain('"default"');
  });

  it("persists a crowned bot's X-Author-Handle and surfaces it to the next challenger", async () => {
    const store = inMemoryThroneStore();

    await handleFight(
      fightRequest(JSON.stringify(loadBot("aggressor")), {
        "X-Author-Handle": "koga",
      }),
      arena("vTEST", store),
    );

    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("berserker"))), // beats aggressor → crowns
      arena("vTEST", store),
    );

    const body = (await res.json()) as IncumbentBody;

    expect(body.title?.outcome).toBe("crowned");
    expect(body.title?.board?.[0].defender.handle).toBe("koga");
  });

  it("surfaces the incumbent's model when its document declares one", async () => {
    const store = inMemoryThroneStore();

    await enthrone(store, "vTEST", modelChamp("claude-opus-4-8"));

    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("aggressor"))), // beats the idle King → crowns
      arena("vTEST", store),
    );

    const body = (await res.json()) as IncumbentBody;

    expect(body.title?.board?.[0].defender.model).toBe("claude-opus-4-8");
  });

  it("reports the incumbent's model as null when its document omits one", async () => {
    const store = inMemoryThroneStore();

    await enthrone(store, "vTEST", modellessChamp()); // document omits `model` (legacy record)

    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("aggressor"))),
      arena("vTEST", store),
    );

    const body = (await res.json()) as IncumbentBody;

    expect(body.title?.board?.[0].defender.model).toBeNull();
  });

  it("accepts a 64-character handle (the length boundary) and persists it on a crown", async () => {
    const store = inMemoryThroneStore();
    const handle = "a".repeat(64);

    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("aggressor")), {
        "X-Author-Handle": handle,
      }),
      arena("vTEST", store),
    );

    expect(res.status).toBe(200);
    expect(
      ((await res.json()) as { title?: { outcome: string } }).title?.outcome,
    ).toBe("crowned");
    expect((await store.readArena("vTEST"))?.members[0].handle).toBe(handle);
  });

  it("rejects a 65-character handle with 400 and never touches the arena", async () => {
    const store = inMemoryThroneStore();

    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("aggressor")), {
        "X-Author-Handle": "a".repeat(65),
      }),
      arena("vTEST", store),
    );

    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toContain(
      "application/problem+json",
    );

    const body = (await res.json()) as { type: string; title: string };

    expect(body.type).toBe("/problems/malformed-request");
    expect(body.title).toContain("X-Author-Handle");
    expect(await store.readArena("vTEST")).toBeUndefined();
  });

  // NUL/CR/LF are blocked by the Headers transport itself; the C0 controls below (US, 0x1F) and
  // DEL (0x7F) pass through, so the handler's own code-point guard rejects them.
  it.each([
    { label: "a C0 control (US, 0x1F)", code: 0x1f },
    { label: "DEL (0x7F)", code: 0x7f },
  ])("rejects a handle containing $label with 400", async ({ code }) => {
    const store = inMemoryThroneStore();

    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("aggressor")), {
        "X-Author-Handle": "bad" + String.fromCharCode(code) + "handle",
      }),
      arena("vTEST", store),
    );

    expect(res.status).toBe(400);
    expect(((await res.json()) as { type: string }).type).toBe(
      "/problems/malformed-request",
    );
    expect(await store.readArena("vTEST")).toBeUndefined();
  });

  it("accepts a handle containing a space (0x20 is not a control character)", async () => {
    const store = inMemoryThroneStore();

    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("aggressor")), {
        "X-Author-Handle": "ko ga",
      }),
      arena("vTEST", store),
    );

    expect(res.status).toBe(200);
    expect((await store.readArena("vTEST"))?.members[0].handle).toBe("ko ga");
  });

  it("validates the handle independently of the gauntlet gate (a non-clearer still 400s)", async () => {
    const store = inMemoryThroneStore();

    const res = await handleFight(
      fightRequest(JSON.stringify(mover()), {
        "X-Author-Handle": "a".repeat(65),
      }),
      arena("vTEST", store),
    );

    expect(res.status).toBe(400);
  });

  it("rejects a request with NO X-Author-Handle header with 400 and never touches the arena", async () => {
    const store = inMemoryThroneStore();

    const res = await handleFight(
      noHandleRequest(JSON.stringify(loadBot("aggressor"))),
      arena("vTEST", store),
    );

    expect(res.status).toBe(400);

    const body = (await res.json()) as { type: string; title: string };

    expect(body.type).toBe("/problems/malformed-request");
    expect(body.title).toContain("X-Author-Handle");
    expect(body.title.toLowerCase()).toContain("required");
    expect(await store.readArena("vTEST")).toBeUndefined();
  });

  it("rejects an EMPTY X-Author-Handle header with 400 and never touches the arena", async () => {
    const store = inMemoryThroneStore();

    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("aggressor")), {
        "X-Author-Handle": "",
      }),
      arena("vTEST", store),
    );

    expect(res.status).toBe(400);

    const body = (await res.json()) as { type: string; title: string };

    expect(body.type).toBe("/problems/malformed-request");
    expect(body.title).toContain("X-Author-Handle");
    expect(await store.readArena("vTEST")).toBeUndefined();
  });
});

// The title block a challenger reads back must be as debuggable as a gauntlet member's row: the
// same net / win-loss-draw / endReasons / degrade telemetry the gauntlet gate prints — but now for
// the reigning-King fight (D-C). The full per-defender board over all N is S4.
describe("handleFight — S2.1: King-fight telemetry parity (D-C)", () => {
  // The King fight is read from board[0] post-S4.3 — a per-defender telemetry entry (no `outcome`;
  // that lives on the title). Full fidelity: net / W-L-D / endReasons / degrade, as a gauntlet row.
  type TitleStats = {
    winRate: number;
    net: number;
    wins: number;
    losses: number;
    draws: number;
    bouts: number;
    endReasons: Record<string, number>;
    degrade: Record<string, number>;
  };

  const sumTally = (t: Record<string, number>): number =>
    Object.values(t).reduce((a, b) => a + b, 0);

  it("surfaces full-fidelity telemetry on a crowning (net / W-L-D / endReasons / degrade)", async () => {
    const store = inMemoryThroneStore();

    await enthrone(store, "vTEST", loadBot("aggressor"));

    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("berserker"))), // beats aggressor 1.00
      arena("vTEST", store),
    );

    const title = (
      (await res.json()) as {
        title?: { outcome: string; board?: TitleStats[] };
      }
    ).title;

    expect(title?.outcome).toBe("crowned");

    const t = title?.board?.[0]; // the King fight

    // 5 seeds × both sides = 10 bouts (D-A: arena fights reuse the frozen `seeds`)
    expect(t?.bouts).toBe(10);
    expect(t?.wins).toBe(10);
    expect(t?.draws).toBe(0);
    expect(t?.losses).toBe(0);
    expect(t!.wins + t!.losses + t!.draws).toBe(t?.bouts);
    expect(t?.net).toBeGreaterThan(0);
    expect(sumTally(t!.endReasons)).toBe(10);
    expect(t?.degrade).toEqual(
      expect.objectContaining({
        unaffordable: expect.any(Number),
        "out-of-band": expect.any(Number),
        locked: expect.any(Number),
        inert: expect.any(Number),
        "wrong-context": expect.any(Number),
      }),
    );
  });

  it("surfaces full-fidelity telemetry on an ENTERED loss (negative net, zero wins)", async () => {
    const store = inMemoryThroneStore();

    await enthrone(store, "vTEST", loadBot("berserker"));

    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("aggressor"))), // loses to berserker 0.00 → enters #2
      arena("vTEST", store),
    );

    const title = (
      (await res.json()) as {
        title?: { outcome: string; board?: TitleStats[] };
      }
    ).title;

    expect(title?.outcome).toBe("entered");

    const t = title?.board?.[0]; // the King fight

    expect(t?.wins).toBe(0);
    expect(t?.net).toBeLessThan(0);
    expect(t!.wins + t!.losses + t!.draws).toBe(t?.bouts);
    expect(t?.bouts).toBe(10);
    expect(sumTally(t!.endReasons)).toBe(10);
  });
});

// C4: a submission byte-identical to a current arena member is rejected as a no-op BEFORE the
// gauntlet gate — a clone can never displace its original, so there is no point benchmarking it.
// D3: relegation is permanent from the ACTIVE arena, but a departed veteran is not a "clone" — it
// may re-submit and re-compete as a fresh entrant (this is where C4 and D3 meet).
describe("handleFight — S2.3: mirror-reject (C4) + re-entry (D3)", () => {
  // Wrap a store so a stray commit on the reject path is caught by count, not merely inferred from
  // unchanged state (the S2.2 belt-and-braces pattern).
  const countingCommits = (
    inner: ThroneStore,
  ): { store: FightDeps["store"]; commits: () => number } => {
    let commits = 0;

    return {
      commits: () => commits,
      store: {
        readArena: inner.readArena,
        readArchive: inner.readArchive,
        commitArena: (v, e, n, r) => {
          commits += 1;

          return inner.commitArena(v, e, n, r);
        },
      },
    };
  };

  it("rejects a byte-identical clone of a current defender as a no-op, naming its slot", async () => {
    const inner = inMemoryThroneStore();

    // A two-member arena; the challenger is byte-identical to defender #2 (aggressor).
    await seatArena(inner, "vTEST", [
      { champion: loadBot("berserker"), handle: null, seniority: 1 },
      { champion: loadBot("aggressor"), handle: null, seniority: 2 },
    ]);

    const before = await inner.readArena("vTEST");
    const { store, commits } = countingCommits(inner);

    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("aggressor"))),
      arena("vTEST", store),
    );

    expect(res.status).toBe(409);
    expect(res.headers.get("content-type")).toContain(
      "application/problem+json",
    );

    const body = (await res.json()) as { type: string; title: string };

    expect(body.type).toBe("/problems/arena-mirror");
    // the reported slot is the MATCHED member's 1-based rank (#2 here) — not a hardcoded #1
    expect(body.title).toContain("#2");
    expect(body.title.toLowerCase()).toContain("already");

    // no benchmark, no CAS: commitArena was never called and the arena is byte-identical
    expect(commits()).toBe(0);
    expect(await inner.readArena("vTEST")).toEqual(before);
  });

  it("rejects the clone BEFORE the gauntlet gate (a clone of a gate-failing member still 409s)", async () => {
    const store = inMemoryThroneStore();

    // Seat a member that could NOT clear the injected idle-dummy gauntlet (a mover only walks). If
    // the mirror check ran AFTER the gate this clone would fail the gate and return a plain
    // `cleared: false` report; a 409 proves the reject precedes the benchmark.
    await seatArena(store, "vTEST", [
      { champion: mover(), handle: null, seniority: 1 },
    ]);

    const res = await handleFight(
      fightRequest(JSON.stringify(mover())),
      arena("vTEST", store),
    );

    expect(res.status).toBe(409);

    const body = (await res.json()) as { type: string; title: string };

    expect(body.type).toBe("/problems/arena-mirror");
    expect(body.title).toContain("#1");
  });

  it("does NOT reject a submission that differs from every member by even one byte", async () => {
    const store = inMemoryThroneStore();

    await enthrone(store, "vTEST", loadBot("berserker"));

    // Same rules, different name → a distinct document. It proceeds (ties the King on strength,
    // enters at #2 on seniority) rather than being rejected as a mirror.
    const nearClone: BotDoc = { ...loadBot("berserker"), name: "berserker-ii" };

    const res = await handleFight(
      fightRequest(JSON.stringify(nearClone)),
      arena("vTEST", store),
    );

    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      title?: { outcome: string; rank: number };
    };

    expect(body.title?.outcome).toBe("entered");
    expect(body.title?.rank).toBe(2);
    expect(
      (await store.readArena("vTEST"))?.members.map((m) => m.champion.name),
    ).toEqual(["berserker", "berserker-ii"]);
  });

  it("lets one author hold multiple slots with DISTINCT bots (rejection keys on the doc, not the handle)", async () => {
    const store = inMemoryThroneStore();

    // Crown aggressor under handle "koga".
    await handleFight(
      fightRequest(JSON.stringify(loadBot("aggressor")), {
        "X-Author-Handle": "koga",
      }),
      arena("vTEST", store),
    );

    // A DIFFERENT bot, SAME handle → not a mirror; it crowns and both occupy slots.
    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("berserker")), {
        "X-Author-Handle": "koga",
      }),
      arena("vTEST", store),
    );

    expect(res.status).toBe(200);
    expect(
      ((await res.json()) as { title?: { outcome: string } }).title?.outcome,
    ).toBe("crowned");

    const after = await store.readArena("vTEST");

    expect(after?.members.map((m) => m.champion.name)).toEqual([
      "berserker",
      "aggressor",
    ]);
    expect(after?.members.every((m) => m.handle === "koga")).toBe(true);
  });

  it("does NOT mirror-reject a RELEGATED veteran on re-submission — it re-competes (D3)", async () => {
    const store = inMemoryThroneStore();
    const berserker2: BotDoc = { ...loadBot("berserker"), name: "berserker-2" };
    const berserker3: BotDoc = { ...loadBot("berserker"), name: "berserker-3" };

    // Full arena: two berserker twins + aggressor. Every berserker beats aggressor and ties the
    // other berserkers, so submitting a THIRD twin relegates aggressor (uniquely 0 wins).
    await seatArena(store, "vTEST", [
      { champion: loadBot("berserker"), handle: null, seniority: 1 },
      { champion: berserker2, handle: null, seniority: 2 },
      { champion: loadBot("aggressor"), handle: null, seniority: 3 },
    ]);

    const relegate = await handleFight(
      fightRequest(JSON.stringify(berserker3)),
      arena("vTEST", store),
    );

    const relegateBody = (await relegate.json()) as {
      title?: { displaced?: { name: string } };
    };

    expect(relegateBody.title?.displaced?.name).toBe("aggressor"); // the veteran left the arena

    // The relegated aggressor re-submits. It is no longer a current member, so the mirror guard does
    // not fire (a returning veteran is not a clone); it re-runs the round-robin and — against the
    // three berserkers that displaced it — is unplaced. The point: 200, NOT a 409 mirror-reject.
    const reenter = await handleFight(
      fightRequest(JSON.stringify(loadBot("aggressor"))),
      arena("vTEST", store),
    );

    expect(reenter.status).toBe(200);
    expect(
      ((await reenter.json()) as { title?: { outcome: string } }).title
        ?.outcome,
    ).toBe("unplaced");
  });
});

// S4.1 (C7): every gauntlet-clearer — crowned, entered, OR unplaced — reads back a per-defender BOARD,
// generalizing the single-King scout (D-C) to all N defenders it fought. Each entry pairs a defender's
// IDENTITY (never its doc) with the challenger's telemetry vs THAT defender, at gauntlet-row fidelity.
// The board is rank-ordered on the pre-fight arena (board[0] = the reigning King). The redundant flat
// King scout (winRate / incumbent / …) was retired in S4.3 — board[0] is now the SOLE King-fight source.
describe("handleFight — S4.1: the per-defender placement board (C7)", () => {
  type BoardEntry = {
    defender: { name: string; model: string | null; handle: string | null };
    winRate: number;
    net: number;
    wins: number;
    losses: number;
    draws: number;
    bouts: number;
    endReasons: Record<string, number>;
    degrade: Record<string, number>;
  };

  type BoardBody = {
    title?: {
      outcome: string;
      rank?: number;
      board?: BoardEntry[];
    };
  };

  it("gives a crowning a board over every defender, rank-ordered with the King first", async () => {
    const store = inMemoryThroneStore();

    // A non-full arena [aggressor(#1 King), dummy(#2)]; the challenger (berserker) beats both, so it
    // crowns. The board is over the two defenders it fought, in arena rank order (King first).
    await seatArena(store, "vTEST", [
      { champion: loadBot("aggressor"), handle: null, seniority: 1 },
      { champion: dummy(), handle: null, seniority: 2 },
    ]);

    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("berserker"))),
      arena("vTEST", store),
    );

    const t = ((await res.json()) as BoardBody).title;

    expect(t?.outcome).toBe("crowned");

    const board = t?.board ?? [];

    expect(board).toHaveLength(2);
    // board[0] is the King the challenger scouted; berserker beats aggressor 1.00 (10/10 bouts)
    expect(board[0].defender).toEqual({
      name: "aggressor",
      model: "house",
      handle: null,
    });
    expect(board[0].winRate).toBe(1);
    expect(board[0].wins).toBe(10);
    expect(board[0].bouts).toBe(10);
    // board[1] is the second defender fought (the dummy) — a DIFFERENT identity, not a repeat of #0
    expect(board[1].defender.name).toBe("dummy");
  });

  it("gives each board entry ITS OWN matchup telemetry (board[i] ↔ defender i), not the King's", async () => {
    const store = inMemoryThroneStore();

    // Non-full arena [berserker(#1 King), dummy(#2)]. The challenger (aggressor) LOSES every bout to
    // the King (0.00) but BEATS the idle dummy — so the two board rows must diverge sharply. A
    // swapped-index or "board[i] = King fight" mutant would make them agree.
    await seatArena(store, "vTEST", [
      { champion: loadBot("berserker"), handle: null, seniority: 1 },
      { champion: dummy(), handle: null, seniority: 2 },
    ]);

    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("aggressor"))),
      arena("vTEST", store),
    );

    const t = ((await res.json()) as BoardBody).title;

    expect(t?.outcome).toBe("entered");
    expect(t?.rank).toBe(2);

    const board = t?.board ?? [];

    expect(board).toHaveLength(2);
    // vs the King (berserker): a clean sweep loss
    expect(board[0].defender.name).toBe("berserker");
    expect(board[0].winRate).toBe(0);
    expect(board[0].wins).toBe(0);
    expect(board[0].net).toBeLessThan(0);
    // vs the dummy: a win — the row is the aggressor-vs-dummy fight, NOT the aggressor-vs-King fight
    expect(board[1].defender.name).toBe("dummy");
    expect(board[1].winRate).toBeGreaterThan(0.5);
    expect(board[1].wins).toBeGreaterThan(0);
    expect(board[1].net).toBeGreaterThan(0);
  });

  it("gives a NON-PLACER the full board too (parity ethos) — a whole full arena of rows", async () => {
    const store = inMemoryThroneStore();
    const berserker2: BotDoc = { ...loadBot("berserker"), name: "berserker-2" };

    // A FULL arena of three bots that each beat aggressor 1.00. The challenger (aggressor) beats none
    // → unplaced, arena untouched — but it still fought all three, so it reads a full 3-row board.
    await seatArena(store, "vTEST", [
      { champion: loadBot("berserker"), handle: null, seniority: 1 },
      { champion: loadBot("pacer"), handle: null, seniority: 2 },
      { champion: berserker2, handle: null, seniority: 3 },
    ]);

    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("aggressor"))),
      arena("vTEST", store),
    );

    const t = ((await res.json()) as BoardBody).title;

    expect(t?.outcome).toBe("unplaced");

    const board = t?.board ?? [];

    expect(board).toHaveLength(3);
    expect(board[0].defender.name).toBe("berserker"); // the King, first
    expect(board.map((e) => e.winRate)).toEqual([0, 0, 0]); // lost every matchup
    // identity ONLY — no defender document leaks into the board, even though these are real bots
    expect(JSON.stringify(board)).not.toContain('"rules"');
    expect(JSON.stringify(board)).not.toContain('"default"');
  });

  it("gives the empty-arena bootstrap crown an EMPTY board (it fought no defenders)", async () => {
    const store = inMemoryThroneStore();

    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("aggressor"))),
      arena("vTEST", store),
    );

    const t = ((await res.json()) as BoardBody).title;

    expect(t?.outcome).toBe("crowned");
    expect(t?.board).toEqual([]);
  });

  it("retires the flat King scout — the King fight is read only from board[0] (S4.3)", async () => {
    const store = inMemoryThroneStore();

    await seatArena(store, "vTEST", [
      { champion: loadBot("aggressor"), handle: null, seniority: 1 },
      { champion: dummy(), handle: null, seniority: 2 },
    ]);

    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("berserker"))),
      arena("vTEST", store),
    );

    const t = ((await res.json()) as BoardBody).title;

    // board[0] carries the King fight at full fidelity — nothing lost, only de-duplicated
    expect(t?.board?.[0].defender).toEqual({
      name: "aggressor",
      model: "house",
      handle: null,
    });
    expect(t?.board?.[0].winRate).toBe(1);

    // the redundant flat scout is GONE: NONE of its keys survive at the top level of `title`
    for (const key of [
      "incumbent",
      "winRate",
      "net",
      "wins",
      "losses",
      "draws",
      "bouts",
      "endReasons",
      "degrade",
    ]) {
      expect(t).not.toHaveProperty(key);
    }
  });
});

// S5.1: every gauntlet-clearer's fight is archived as replay raw material — its reproduction record
// {challenger doc, defender docs, seeds, version, memberSeniority} is appended ATOMICALLY with the
// arena commit. A placer/King pins by its seniority; a non-placer archives too (memberSeniority null,
// covered by the S2.2 unplaced test above). Nothing is archived when the gauntlet gate fails.
describe("handleFight — S5.1: reproduction archive", () => {
  it("archives the bootstrap champion's record — empty defenders, pinned by seniority 1", async () => {
    const store = inMemoryThroneStore();

    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("aggressor"))),
      arena("vTEST", store),
    );

    expect(
      ((await res.json()) as { title?: { outcome: string } }).title?.outcome,
    ).toBe("crowned");

    const archive = await store.readArchive("vTEST");
    expect(archive).toHaveLength(1);
    expect(archive[0].challenger.name).toBe("aggressor");
    expect(archive[0].defenders).toEqual([]); // an empty arena → no defenders fought
    expect(archive[0].seeds).toEqual([1, 2, 3, 4, 5]);
    expect(archive[0].version).toBe("vTEST");
    expect(archive[0].memberSeniority).toBe(1); // the King's pin key
  });

  it("archives a placing challenger's record — the defenders it fought, pinned by its seniority", async () => {
    const store = inMemoryThroneStore();
    await enthrone(store, "vTEST", loadBot("aggressor")); // King=aggressor, seniority 1, nextSeniority 2

    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("berserker"))), // berserker beats aggressor 1.00 → crowns #1
      arena("vTEST", store),
    );

    expect(
      ((await res.json()) as { title?: { outcome: string } }).title?.outcome,
    ).toBe("crowned");

    const archive = await store.readArchive("vTEST");
    expect(archive).toHaveLength(1);
    expect(archive[0].challenger.name).toBe("berserker");
    expect(archive[0].defenders.map((d) => d.name)).toEqual(["aggressor"]);
    expect(archive[0].memberSeniority).toBe(2); // its assigned seniority (the arena's nextSeniority)
  });

  it("archives nothing when the submission fails the gauntlet gate", async () => {
    const store = inMemoryThroneStore();
    await enthrone(store, "vTEST", loadBot("aggressor")); // a King reigns

    const res = await handleFight(
      fightRequest(JSON.stringify(mover())), // only walks → cannot clear the idle dummy → no title shot
      arena("vTEST", store),
    );

    expect(((await res.json()) as { title?: unknown }).title).toBeUndefined();
    expect(await store.readArchive("vTEST")).toEqual([]); // no clear ⇒ no archive entry
  });
});

// practice/compete: `/fight` DEFAULTS to a footprint-free practice run — an absent/empty (or explicit
// `false`) `X-Compete` evaluates where the bot WOULD land and returns a `projection` (the same
// outcome/rank/board/displaced shape as a real title, under a distinct key), writing NOTHING — no arena
// commit, no archive. Only `X-Compete: true` takes the compete-and-commit path and can claim the throne.
// A non-true/false value is a `400` malformed request (no silent downgrade).
describe("handleFight — practice/compete via the X-Compete header", () => {
  // Spy on the store so a stray commit on the read-only practice path is caught by COUNT, not merely
  // inferred from unchanged state (the S2.2/S2.3 belt-and-braces pattern).
  const countingStore = (
    inner: ThroneStore,
  ): { store: FightDeps["store"]; commits: () => number } => {
    let commits = 0;

    return {
      commits: () => commits,
      store: {
        readArena: inner.readArena,
        readArchive: inner.readArchive,
        commitArena: (v, e, n, r) => {
          commits += 1;

          return inner.commitArena(v, e, n, r);
        },
      },
    };
  };

  type ProjectionBody = {
    cleared: boolean;
    title?: unknown;
    projection?: {
      outcome: string;
      rank?: number;
      board?: {
        defender: { name: string; model: string | null; handle: string | null };
        winRate: number;
      }[];
      displaced?: { name: string; model: string | null; handle: string | null };
    };
  };

  const practiceRequest = (body: string): Request =>
    fightRequest(body, { "X-Compete": "false" });

  it("PROJECTS a would-be crown against a non-empty arena and writes nothing", async () => {
    const inner = inMemoryThroneStore();

    await enthrone(inner, "vTEST", loadBot("aggressor")); // lone King, generation 1

    const before = await inner.readArena("vTEST");
    const { store, commits } = countingStore(inner);

    const res = await handleFight(
      practiceRequest(JSON.stringify(loadBot("berserker"))), // beats aggressor 1.00 → would crown
      arena("vTEST", store),
    );

    expect(res.status).toBe(200);

    const body = (await res.json()) as ProjectionBody;

    expect(body.cleared).toBe(true);
    expect(body.projection?.outcome).toBe("crowned");
    expect(body.projection?.rank).toBe(1);
    expect(body.projection?.board).toHaveLength(1);
    expect(body.projection?.board?.[0].defender.name).toBe("aggressor");
    expect(body.projection?.board?.[0].winRate).toBe(1);
    // a projection is NEVER a title — a consumer keying on `title` must not see this as a real crown
    expect(body).not.toHaveProperty("title");

    // nothing was written: no commit, arena byte-identical, archive empty
    expect(commits()).toBe(0);
    expect(await inner.readArena("vTEST")).toEqual(before);
    expect(await inner.readArchive("vTEST")).toEqual([]);
  });

  it("PROJECTS a would-be entrant (rank 2) whose board reflects the loss, writing nothing", async () => {
    const inner = inMemoryThroneStore();

    await enthrone(inner, "vTEST", loadBot("berserker")); // lone King

    const { store, commits } = countingStore(inner);

    const res = await handleFight(
      practiceRequest(JSON.stringify(loadBot("aggressor"))), // loses 0.00 → would enter #2 (room)
      arena("vTEST", store),
    );

    const body = (await res.json()) as ProjectionBody;

    expect(body.projection?.outcome).toBe("entered");
    expect(body.projection?.rank).toBe(2);
    expect(body.projection?.board?.[0].defender.name).toBe("berserker");
    expect(body.projection?.board?.[0].winRate).toBe(0); // swept by the King
    expect(body).not.toHaveProperty("title");
    expect(commits()).toBe(0);
  });

  it("PROJECTS a full-arena relegation — displaced identity present — without evicting anyone", async () => {
    const inner = inMemoryThroneStore();

    // Full arena: two bots that beat aggressor + an idle dummy. The challenger (aggressor) beats only
    // the dummy → would enter #3 and relegate the dummy. In practice nothing is evicted.
    await seatArena(inner, "vTEST", [
      { champion: loadBot("berserker"), handle: null, seniority: 1 },
      { champion: loadBot("pacer"), handle: null, seniority: 2 },
      { champion: dummy(), handle: null, seniority: 3 },
    ]);

    const before = await inner.readArena("vTEST");
    const { store, commits } = countingStore(inner);

    const res = await handleFight(
      practiceRequest(JSON.stringify(loadBot("aggressor"))),
      arena("vTEST", store),
    );

    const body = (await res.json()) as ProjectionBody;

    expect(body.projection?.outcome).toBe("entered");
    expect(body.projection?.rank).toBe(3);
    expect(body.projection?.displaced).toEqual({
      name: "dummy",
      model: "test",
      handle: null,
    });
    expect(body.projection?.board).toHaveLength(3);
    // read-only: no commit, and the dummy is still seated
    expect(commits()).toBe(0);
    expect(await inner.readArena("vTEST")).toEqual(before);
  });

  it("PROJECTS the empty-arena bootstrap crown as rank 1 with an empty board, writing nothing", async () => {
    const inner = inMemoryThroneStore();
    const { store, commits } = countingStore(inner);

    const res = await handleFight(
      practiceRequest(JSON.stringify(loadBot("aggressor"))),
      arena("vTEST", store),
    );

    const body = (await res.json()) as ProjectionBody;

    expect(body.projection?.outcome).toBe("crowned");
    expect(body.projection?.rank).toBe(1);
    expect(body.projection?.board).toEqual([]);
    expect(body).not.toHaveProperty("title");
    expect(commits()).toBe(0);
    expect(await inner.readArena("vTEST")).toBeUndefined(); // arena still empty
  });

  it("returns the plain gauntlet report — neither projection nor title — when a practice bot fails the gate", async () => {
    const inner = inMemoryThroneStore();
    const { store, commits } = countingStore(inner);

    const res = await handleFight(
      practiceRequest(JSON.stringify(mover())), // only walks → cannot clear the idle dummy
      arena("vTEST", store),
    );

    expect(res.status).toBe(200);

    const body = (await res.json()) as ProjectionBody;

    expect(body.cleared).toBe(false);
    expect(body).not.toHaveProperty("projection");
    expect(body).not.toHaveProperty("title");
    expect(commits()).toBe(0);
    expect(await inner.readArena("vTEST")).toBeUndefined();
  });

  it("still competes-and-commits when X-Compete is true (returns a title, not a projection)", async () => {
    const store = inMemoryThroneStore();

    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("aggressor")), {
        "X-Compete": "true",
      }),
      arena("vTEST", store),
    );

    const body = (await res.json()) as ProjectionBody & {
      title?: { outcome: string };
    };

    expect(body.title?.outcome).toBe("crowned");
    expect(body).not.toHaveProperty("projection");
    // the crown actually landed
    expect((await store.readArena("vTEST"))?.members[0].champion.name).toBe(
      "aggressor",
    );
  });

  it("flips the default: a bare /fight (no X-Compete) PRACTICES, writing nothing", async () => {
    const inner = inMemoryThroneStore();

    await enthrone(inner, "vTEST", loadBot("aggressor"));

    const before = await inner.readArena("vTEST");
    const { store, commits } = countingStore(inner);

    const res = await handleFight(
      noCompeteRequest(JSON.stringify(loadBot("berserker"))), // beats the King → would crown
      arena("vTEST", store),
    );

    const body = (await res.json()) as ProjectionBody;

    expect(body.projection?.outcome).toBe("crowned");
    expect(body).not.toHaveProperty("title");
    expect(commits()).toBe(0);
    expect(await inner.readArena("vTEST")).toEqual(before);
  });

  it("treats an EMPTY X-Compete header like an absent one — it PRACTICES (the flipped default)", async () => {
    const inner = inMemoryThroneStore();

    await enthrone(inner, "vTEST", loadBot("aggressor"));

    const { store, commits } = countingStore(inner);

    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("berserker")), { "X-Compete": "" }),
      arena("vTEST", store),
    );

    const body = (await res.json()) as ProjectionBody;

    expect(body.projection?.outcome).toBe("crowned");
    expect(body).not.toHaveProperty("title");
    expect(commits()).toBe(0);
  });

  it("parses X-Compete case-insensitively — TRUE competes", async () => {
    const store = inMemoryThroneStore();

    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("aggressor")), {
        "X-Compete": "TRUE",
      }),
      arena("vTEST", store),
    );

    expect(
      ((await res.json()) as { title?: { outcome: string } }).title?.outcome,
    ).toBe("crowned");
    expect(await store.readArena("vTEST")).toBeDefined(); // committed
  });

  it("parses X-Compete case-insensitively — False projects, writing nothing", async () => {
    const inner = inMemoryThroneStore();

    await enthrone(inner, "vTEST", loadBot("aggressor"));

    const { store, commits } = countingStore(inner);

    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("berserker")), {
        "X-Compete": "False",
      }),
      arena("vTEST", store),
    );

    const body = (await res.json()) as ProjectionBody;

    expect(body.projection?.outcome).toBe("crowned");
    expect(body).not.toHaveProperty("title");
    expect(commits()).toBe(0);
  });

  // A lenient truthy/substring parse would wrongly accept these as compete (or silently downgrade to
  // practice). The strict rule rejects every non-true/false value with 400 and touches nothing.
  it.each(["yes", "1", "tru", "on", "0"])(
    "rejects the ambiguous X-Compete value %j with 400 malformed-request, touching nothing",
    async (value) => {
      const inner = inMemoryThroneStore();
      const { store, commits } = countingStore(inner);

      const res = await handleFight(
        fightRequest(JSON.stringify(loadBot("aggressor")), {
          "X-Compete": value,
        }),
        arena("vTEST", store),
      );

      expect(res.status).toBe(400);
      expect(res.headers.get("content-type")).toContain(
        "application/problem+json",
      );

      const body = (await res.json()) as { type: string; title: string };

      expect(body.type).toBe("/problems/malformed-request");
      expect(body.title).toContain("X-Compete");
      expect(commits()).toBe(0);
      expect(await inner.readArena("vTEST")).toBeUndefined();
    },
  );

  it("mirror-rejects a byte-identical current member even in practice (409, before the benchmark)", async () => {
    const inner = inMemoryThroneStore();

    await seatArena(inner, "vTEST", [
      { champion: loadBot("berserker"), handle: null, seniority: 1 },
      { champion: loadBot("aggressor"), handle: null, seniority: 2 },
    ]);

    const before = await inner.readArena("vTEST");
    const { store, commits } = countingStore(inner);

    const res = await handleFight(
      practiceRequest(JSON.stringify(loadBot("aggressor"))), // clone of defender #2
      arena("vTEST", store),
    );

    expect(res.status).toBe(409);

    const body = (await res.json()) as { type: string; title: string };

    expect(body.type).toBe("/problems/arena-mirror");
    expect(body.title).toContain("#2");
    // mode-neutral wording (decision #7): a projection never "displaces", so the detail states the
    // plain no-op instead of a compete-framed "can't displace itself".
    expect(body.title).toContain("no effect");
    expect(body.title.toLowerCase()).not.toContain("displace");
    expect(commits()).toBe(0);
    expect(await inner.readArena("vTEST")).toEqual(before);
  });

  it("checks the handle BEFORE the compete parse — a missing handle wins over a bad X-Compete", async () => {
    const store = inMemoryThroneStore();

    const res = await handleFight(
      new Request("https://mk.example/fight", {
        method: "POST",
        body: JSON.stringify(loadBot("aggressor")),
        headers: { "X-Compete": "nonsense" }, // no X-Author-Handle
      }),
      arena("vTEST", store),
    );

    expect(res.status).toBe(400);

    const body = (await res.json()) as { type: string; title: string };

    expect(body.type).toBe("/problems/malformed-request");
    expect(body.title).toContain("X-Author-Handle"); // the handle guard fired first
    expect(await store.readArena("vTEST")).toBeUndefined();
  });
});
