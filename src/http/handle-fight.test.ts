import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { handleFight, type FightDeps } from "./handle-fight.js";
import {
  inMemoryThroneStore,
  type ArenaMember,
  type ArenaRecord,
  type InMemoryThroneStore,
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
  rules: [],
  default: { type: "idle" },
});

// A bot that only walks (never attacks) — cannot beat the idle dummy (draws), so it
// FAILS the gate. Distinct document from `dummy` ⇒ no no-mirror skip.
const mover = (): BotDoc => ({
  version: 1,
  name: "mover",
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
  inner: InMemoryThroneStore,
  seenAtRead: ArenaRecord | undefined,
): FightDeps["store"] => ({
  read: inner.read,
  recent: inner.recent,
  compareAndSwap: inner.compareAndSwap,
  readArena: () => Promise.resolve(seenAtRead),
  commitArena: inner.commitArena,
});

// A valid stand-in handle every placement/title test carries by default — the handle is REQUIRED
// on `/fight`, so throne-mechanics tests supply this and stay focused on ranking.
const DEFAULT_HANDLE = "test-author";

const fightRequest = (
  body: string,
  headers?: Record<string, string>,
): Request =>
  new Request("https://mk.example/fight", {
    method: "POST",
    body,
    headers: { "X-Author-Handle": DEFAULT_HANDLE, ...headers },
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

type IncumbentBody = {
  title?: {
    outcome: string;
    rank?: number;
    incumbent?: { name: string; model: string | null; handle: string | null };
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

    // the champion is persisted under this version at generation 1, one lineage entry
    const rec = await store.read("vTEST");

    expect(rec?.generation).toBe(1);
    expect(rec?.champion).toEqual(clearer);
    expect(store.lineage("vTEST")).toHaveLength(1);
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
    expect(await store.read("vTEST")).toBeUndefined();
    expect(store.lineage("vTEST")).toHaveLength(0);
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
    expect((await store.read("vOTHER"))?.champion).toEqual(other);
    expect(store.lineage("vOTHER")).toHaveLength(1);
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

    // the King never changed hands, so the succession lineage did NOT grow (D-E)
    expect(store.lineage("vTEST")).toHaveLength(1);
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

    // the crown changed hands, so the lineage grew, newest last
    expect(store.lineage("vTEST").map((e) => e.champion.name)).toEqual([
      "aggressor",
      "berserker",
    ]);
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
      title?: { outcome: string; rank: number; winRate: number };
    };

    expect(body.title?.winRate).toBe(0.5);
    expect(body.title?.outcome).toBe("entered"); // NOT crowned
    expect(body.title?.rank).toBe(2);
    expect((await store.readArena("vTEST"))?.members[0].champion.name).toBe(
      "zoner",
    ); // King held #1
    expect(store.lineage("vTEST")).toHaveLength(1);
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
      model: null,
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

    // the crown changed hands (aggressor → berserker), so the lineage grew, newest last (D-E)
    expect(store.lineage("vTEST").map((e) => e.champion.name)).toEqual([
      "aggressor",
      "berserker",
    ]);
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
      read: inner.read,
      recent: inner.recent,
      compareAndSwap: inner.compareAndSwap,
      readArena: inner.readArena,
      commitArena: (v, e, n) => {
        commits += 1;

        return inner.commitArena(v, e, n);
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
        winRate: number;
        bouts: number;
        incumbent?: {
          name: string;
          model: string | null;
          handle: string | null;
        };
      };
    };

    expect(body.title?.outcome).toBe("unplaced");
    expect(body.title).not.toHaveProperty("rank");
    // full parity: the unplaced clearer still fought the #1 King, so it reads the same scout —
    // telemetry + incumbent — as an `entered` placement (D-C diagnose-don't-guess).
    expect(body.title?.incumbent).toEqual({
      name: "berserker",
      model: null,
      handle: null,
    });
    expect(body.title?.bouts).toBe(10);
    expect(body.title?.winRate).toBe(0); // lost all ten to the King

    // nothing was committed — commitArena was never called and the arena is byte-identical
    expect(commits).toBe(0);
    expect(await inner.readArena("vTEST")).toEqual(before);
    expect(inner.lineage("vTEST")).toHaveLength(1);
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
    expect(inner.lineage("vTEST").map((e) => e.champion.name)).toEqual([
      "aggressor",
      "berserker",
    ]);
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
    expect(body.title?.incumbent).toEqual({
      name: "berserker",
      model: null,
      handle: null,
    });
    // the incumbent's bot DOCUMENT never leaks into the response
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
    expect(body.title?.incumbent?.handle).toBe("koga");
  });

  it("surfaces the incumbent's model when its document declares one", async () => {
    const store = inMemoryThroneStore();

    await enthrone(store, "vTEST", modelChamp("claude-opus-4-8"));

    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("aggressor"))), // beats the idle King → crowns
      arena("vTEST", store),
    );

    const body = (await res.json()) as IncumbentBody;

    expect(body.title?.incumbent?.model).toBe("claude-opus-4-8");
  });

  it("reports the incumbent's model as null when its document omits one", async () => {
    const store = inMemoryThroneStore();

    await enthrone(store, "vTEST", loadBot("berserker")); // no model field

    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("aggressor"))),
      arena("vTEST", store),
    );

    const body = (await res.json()) as IncumbentBody;

    expect(body.title?.incumbent?.model).toBeNull();
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
    expect((await store.read("vTEST"))?.handle).toBe(handle);
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
    expect((await store.read("vTEST"))?.handle).toBe("ko ga");
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
  type TitleStats = {
    outcome: string;
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

    const t = ((await res.json()) as { title?: TitleStats }).title;

    expect(t?.outcome).toBe("crowned");
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

    const t = ((await res.json()) as { title?: TitleStats }).title;

    expect(t?.outcome).toBe("entered");
    expect(t?.wins).toBe(0);
    expect(t?.net).toBeLessThan(0);
    expect(t!.wins + t!.losses + t!.draws).toBe(t?.bouts);
    expect(t?.bouts).toBe(10);
    expect(sumTally(t!.endReasons)).toBe(10);
  });

  it("emits all-zero King telemetry for a challenger that mirrors the King (empty breakdown, no crash)", async () => {
    const store = inMemoryThroneStore();

    await enthrone(store, "vTEST", loadBot("berserker"));

    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("berserker"))), // byte-identical ⇒ no-mirror skip
      arena("vTEST", store),
    );

    const t = ((await res.json()) as { title?: TitleStats }).title;

    // the mirror skip leaves an empty breakdown; every figure degrades to a clean zero. (C4
    // mirror-REJECT is S2.3 — here the clone still runs and, with room, enters at the bottom.)
    expect(t?.bouts).toBe(0);
    expect(t?.wins).toBe(0);
    expect(t?.losses).toBe(0);
    expect(t?.draws).toBe(0);
    expect(t?.net).toBe(0);
    expect(sumTally(t!.endReasons)).toBe(0);
    expect(t?.degrade).toEqual({
      unaffordable: 0,
      "out-of-band": 0,
      locked: 0,
      inert: 0,
      "wrong-context": 0,
    });
  });
});
