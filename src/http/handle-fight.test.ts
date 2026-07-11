import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { handleFight, type FightDeps } from "./handle-fight.js";
import {
  inMemoryThroneStore,
  type ArenaRecord,
  type InMemoryThroneStore,
} from "./throne-store.js";
import { loadBotDoc } from "../cli/load.js";
import { CANONICAL_RULES } from "../engine/rules.js";
import { MATCH } from "../engine/benchmark-config.js";
import type { BotDoc } from "../engine/dsl.js";

// A real example fighter loaded from `bots/<name>.json` (same path pattern as
// `gauntlet.ts`). Used only where a bot must genuinely CLEAR the injected gauntlet:
// verified that the active example fighters beat an idle dummy 1.000 on both sides,
// so `aggressor` is a robust "clearer" fixture; an inline attacker rings itself out
// on one side (jogai), so a real fighter is the reliable choice.
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
// FAILS the gate. Distinct document from `dummy` ⇒ no no-mirror skip (it appears in
// the breakdown with winRate 0, i.e. "found but not passed", not "skipped").
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

// The 10 fresh CSPRNG seeds a real title fight draws, pinned for deterministic tests
// (prod draws them from Web Crypto). 10 seeds × both sides ⇒ 20 title-fight bouts.
const TITLE_SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// The injected "arena": a 1-member idle gauntlet + a test version key + the real
// engine config, so `handleFight` runs the real (fast, deterministic) benchmark.
const arena = (version: string, store: FightDeps["store"]): FightDeps => ({
  gauntlet: [dummy()],
  gauntletNames: ["dummy"],
  seeds: [1, 2, 3, 4, 5],
  maxTicks: 600,
  rules: CANONICAL_RULES,
  match: MATCH,
  version,
  store,
  freshSeeds: () => TITLE_SEEDS,
});

// Pre-seat a champion in the fake store's arena (bypassing the clearing gate — this King
// already reigns as arena #1 at generation 1). `commitArena` also appends it to the crowning
// lineage, so `read()`/`recent()` reflect it. A challenger POSTed to `handleFight` must still
// clear the injected idle-dummy gauntlet to earn the title shot against it.
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

// A store modelling an arena CAS race: `readArena` returns the arena as this request first SAW
// it (`seenAtRead`), while `commitArena` runs against `inner` — which a concurrent crown has
// already moved on. So a commit using the stale-read generation is rejected as `moved`, exactly
// as a real race between two callers would resolve.
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

// A valid stand-in handle every crowning/title test carries by default — the handle
// is REQUIRED on `/fight`, so the throne-mechanics tests (which don't care about the
// handle) supply this and stay focused on crowning. Handle-policy tests override it;
// `noHandleRequest` omits it entirely to exercise the missing-header rejection.
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

// A request that OMITS the author handle header entirely (bypassing the default),
// to drive the "handle is required" rejection.
const noHandleRequest = (body: string): Request =>
  new Request("https://mk.example/fight", { method: "POST", body });

// An idle champion carrying a `model` field (provenance the interpreter never reads).
// Pre-seated via `enthrone`, so it bypasses the clearing gate; a real challenger beats
// this idle King, letting a test read the incumbent identity it was crowned against.
const modelChamp = (model: string): BotDoc => ({
  version: 1,
  name: "modelking",
  model,
  rules: [],
  default: { type: "idle" },
});

// The `title.incumbent` projection under test: identity fields only, never the doc.
type IncumbentBody = {
  title?: {
    outcome: string;
    incumbent?: { name: string; model: string | null; handle: string | null };
  };
};

describe("handleFight — S4 slice 1: empty-throne bootstrap crowning", () => {
  it("crowns the first gauntlet-clearer on an empty version throne", async () => {
    const store = inMemoryThroneStore();
    const clearer = loadBot("aggressor");

    const res = await handleFight(
      fightRequest(JSON.stringify(clearer)),
      arena("vTEST", store),
    );

    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      cleared: boolean;
      title?: { outcome: string };
    };

    expect(body.cleared).toBe(true);
    expect(body.title?.outcome).toBe("throne-empty-crowned");

    // the champion is persisted under this version at generation 1, one lineage entry
    const rec = await store.read("vTEST");

    expect(rec?.generation).toBe(1);
    expect(rec?.champion).toEqual(clearer);
    expect(store.lineage("vTEST")).toHaveLength(1);
  });

  it("does not crown or emit a title when the bot fails the gate", async () => {
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

  it("treats the current version throne as empty even when another version is occupied", async () => {
    const store = inMemoryThroneStore();
    const other = loadBot("berserker");

    await enthrone(store, "vOTHER", other);

    const clearer = loadBot("aggressor");

    const res = await handleFight(
      fightRequest(JSON.stringify(clearer)),
      arena("vTEST", store),
    );

    const body = (await res.json()) as { title?: { outcome: string } };

    expect(body.title?.outcome).toBe("throne-empty-crowned");
    expect((await store.read("vTEST"))?.champion).toEqual(clearer);
    // the other version's throne is untouched
    expect((await store.read("vOTHER"))?.champion).toEqual(other);
    expect(store.lineage("vOTHER")).toHaveLength(1);
  });
});

describe("handleFight — S4 slice 2: occupied-throne title fight", () => {
  it("crowns a clearer who beats the reigning King > 0.5", async () => {
    const store = inMemoryThroneStore();
    const king = loadBot("aggressor");

    await enthrone(store, "vTEST", king);

    const challenger = loadBot("berserker"); // beats aggressor 1.00 head-to-head

    const res = await handleFight(
      fightRequest(JSON.stringify(challenger)),
      arena("vTEST", store),
    );

    const body = (await res.json()) as {
      cleared: boolean;
      title?: { outcome: string; winRate: number };
    };

    expect(body.cleared).toBe(true);
    expect(body.title?.outcome).toBe("crowned");
    expect(body.title?.winRate).toBeGreaterThan(0.5);

    // throne now holds the challenger at generation 2; lineage appended, King kept first
    const rec = await store.read("vTEST");

    expect(rec?.champion).toEqual(challenger);
    expect(rec?.generation).toBe(2);
    expect(store.lineage("vTEST").map((e) => e.champion.name)).toEqual([
      "aggressor",
      "berserker",
    ]);

    // the arena advanced too: the challenger takes slot #1 stamped with the King's
    // nextSeniority (2), the record moved to generation 2, and the per-version seniority
    // counter incremented to 3 (so the next entrant is junior to this one).
    const arenaAfter = await store.readArena("vTEST");

    expect(arenaAfter?.members[0].champion).toEqual(challenger);
    expect(arenaAfter?.members[0].seniority).toBe(2);
    expect(arenaAfter?.generation).toBe(2);
    expect(arenaAfter?.nextSeniority).toBe(3);
  });

  it("retains the King when the clearer scores <= 0.5 (a strict loss)", async () => {
    const store = inMemoryThroneStore();
    const king = loadBot("berserker");

    await enthrone(store, "vTEST", king);

    const challenger = loadBot("aggressor"); // loses to berserker 0.00

    const res = await handleFight(
      fightRequest(JSON.stringify(challenger)),
      arena("vTEST", store),
    );

    const body = (await res.json()) as { title?: { outcome: string } };

    expect(body.title?.outcome).toBe("king-retained");
    // throne unchanged: still berserker at generation 1, one lineage entry
    expect((await store.read("vTEST"))?.champion).toEqual(king);
    expect((await store.read("vTEST"))?.generation).toBe(1);
    expect(store.lineage("vTEST")).toHaveLength(1);
  });

  it("retains the King on an EXACT 0.5 title fight (the strict > 0.5 boundary)", async () => {
    const store = inMemoryThroneStore();
    const king = loadBot("zoner");

    await enthrone(store, "vTEST", king);

    // a twin (King's rules, different name) is NOT a mirror (distinct doc) yet scores
    // EXACTLY 0.5 by construction — it holds the winning side in exactly one of each
    // seed's two bouts. A `>=` boundary mutant would (wrongly) crown it.
    const twin: BotDoc = { ...king, name: "zoner-twin" };

    const res = await handleFight(
      fightRequest(JSON.stringify(twin)),
      arena("vTEST", store),
    );

    const body = (await res.json()) as {
      title?: { outcome: string; winRate: number };
    };

    expect(body.title?.winRate).toBe(0.5);
    expect(body.title?.outcome).toBe("king-retained");
    expect(store.lineage("vTEST")).toHaveLength(1); // no crown at exactly 0.5
  });

  it("retains the King against a byte-identical clone (mirror can't dethrone)", async () => {
    const store = inMemoryThroneStore();
    const king = loadBot("berserker");

    await enthrone(store, "vTEST", king);

    const clone = loadBot("berserker"); // byte-identical ⇒ sameDoc skip ⇒ winRate 0

    const res = await handleFight(
      fightRequest(JSON.stringify(clone)),
      arena("vTEST", store),
    );

    const body = (await res.json()) as {
      title?: { outcome: string; winRate: number };
    };

    expect(body.title?.outcome).toBe("king-retained");
    expect(body.title?.winRate).toBe(0);
    expect(store.lineage("vTEST")).toHaveLength(1); // cloning spawns no lineage entry
  });

  it("echoes the fresh title-fight seeds and reports the bout count", async () => {
    const store = inMemoryThroneStore();

    await enthrone(store, "vTEST", loadBot("aggressor"));

    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("berserker"))),
      arena("vTEST", store),
    );

    const body = (await res.json()) as {
      title?: { seeds: number[]; bouts: number };
    };

    expect(body.title?.seeds).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(body.title?.bouts).toBe(20); // 10 seeds × both sides
  });
});

describe("handleFight — S4 slice 3: concurrent crowns serialize (409 throne-moved)", () => {
  it("409s a winning title-fight crown when the throne advanced since the read", async () => {
    const inner = inMemoryThroneStore();
    const king = loadBot("aggressor");
    const usurper = loadBot("berserker"); // the concurrent challenger who crowns first

    await inner.commitArena("vTEST", null, {
      members: [{ champion: king, handle: null, seniority: 1 }],
      generation: 1,
      nextSeniority: 2,
    });
    await inner.commitArena("vTEST", 1, {
      members: [{ champion: usurper, handle: null, seniority: 2 }],
      generation: 2,
      nextSeniority: 3,
    }); // a concurrent crown lands, moving the arena to generation 2

    // our request read the arena at generation 1, before that concurrent crown landed
    const store = staleArenaStore(inner, {
      members: [{ champion: king, handle: null, seniority: 1 }],
      generation: 1,
      nextSeniority: 2,
    });

    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("pacer"))), // pacer beats aggressor 1.00 → wins
      arena("vTEST", store),
    );

    expect(res.status).toBe(409);
    expect(res.headers.get("content-type")).toContain(
      "application/problem+json",
    );

    const body = (await res.json()) as { type: string; title: string };

    expect(body.type).toBe("/problems/throne-moved");
    // the detail is actionable: it tells the losing challenger to resubmit
    expect(body.title).toContain("resubmit");

    // the throne still holds the concurrent winner; the loser (pacer) was NOT appended
    expect((await inner.read("vTEST"))?.champion).toEqual(usurper);
    expect(inner.lineage("vTEST").map((e) => e.champion.name)).toEqual([
      "aggressor",
      "berserker",
    ]);
  });

  it("409s a bootstrap crown when the empty throne was claimed since the read", async () => {
    const inner = inMemoryThroneStore();
    const usurper = loadBot("berserker");

    // someone claimed the empty arena first, moving it to generation 1
    await inner.commitArena("vTEST", null, {
      members: [{ champion: usurper, handle: null, seniority: 1 }],
      generation: 1,
      nextSeniority: 2,
    });

    // our request read the arena as EMPTY, before that claim landed
    const store = staleArenaStore(inner, undefined);

    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("aggressor"))), // clears → attempts a bootstrap crown
      arena("vTEST", store),
    );

    expect(res.status).toBe(409);

    const body = (await res.json()) as { type: string };

    expect(body.type).toBe("/problems/throne-moved");

    // the throne holds the first claimant; we were not appended
    expect((await inner.read("vTEST"))?.champion).toEqual(usurper);
    expect(inner.lineage("vTEST").map((e) => e.champion.name)).toEqual([
      "berserker",
    ]);
  });
});

describe("handleFight — S4 slice 4: incumbent identity + author handle", () => {
  it("surfaces the incumbent's name/model/handle in the title block, never the doc", async () => {
    const store = inMemoryThroneStore();
    const king = loadBot("berserker"); // enthroned without a handle ⇒ handle null

    await enthrone(store, "vTEST", king);

    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("aggressor"))), // loses ⇒ king-retained
      arena("vTEST", store),
    );

    const body = (await res.json()) as IncumbentBody;

    expect(body.title?.outcome).toBe("king-retained");
    expect(body.title?.incumbent).toEqual({
      name: "berserker",
      model: null,
      handle: null,
    });
    // the visibility invariant: the incumbent's bot DOCUMENT never leaks into the response
    expect(JSON.stringify(body.title)).not.toContain('"rules"');
    expect(JSON.stringify(body.title)).not.toContain('"default"');
  });

  it("persists a crowned bot's X-Author-Handle and surfaces it to the next challenger", async () => {
    const store = inMemoryThroneStore();

    // first challenger bootstrap-crowns the empty throne WITH a handle
    await handleFight(
      fightRequest(JSON.stringify(loadBot("aggressor")), {
        "X-Author-Handle": "koga",
      }),
      arena("vTEST", store),
    );

    // the next challenger (who beats aggressor) reads the reigning King's handle
    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("berserker"))),
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
      fightRequest(JSON.stringify(loadBot("aggressor"))), // beats the idle King
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

  it("accepts a 64-character handle (the length boundary) and persists it", async () => {
    const store = inMemoryThroneStore();
    const handle = "a".repeat(64);

    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("aggressor")), {
        "X-Author-Handle": handle,
      }),
      arena("vTEST", store),
    );

    expect(res.status).toBe(200);

    const body = (await res.json()) as { title?: { outcome: string } };

    expect(body.title?.outcome).toBe("throne-empty-crowned");
    expect((await store.read("vTEST"))?.handle).toBe(handle);
  });

  it("rejects a 65-character handle with 400 and never touches the throne", async () => {
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
    // the message names the offending header so the caller knows what to fix
    expect(body.title).toContain("X-Author-Handle");
    // the clearer WOULD have crowned — the bad handle short-circuits before that
    expect(await store.read("vTEST")).toBeUndefined();
  });

  // NUL/CR/LF are blocked by the Headers transport itself; the C0 controls below (US,
  // 0x1F) and DEL (0x7F) pass through, so the handler's own code-point guard rejects them.
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
    expect(await store.read("vTEST")).toBeUndefined();
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

  it("rejects a request with NO X-Author-Handle header with 400 and never touches the throne", async () => {
    const store = inMemoryThroneStore();

    const res = await handleFight(
      noHandleRequest(JSON.stringify(loadBot("aggressor"))),
      arena("vTEST", store),
    );

    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toContain(
      "application/problem+json",
    );

    const body = (await res.json()) as { type: string; title: string };

    expect(body.type).toBe("/problems/malformed-request");
    // the message names the header AND that it is required, so the caller knows to add it
    expect(body.title).toContain("X-Author-Handle");
    expect(body.title.toLowerCase()).toContain("required");
    // the clearer WOULD have crowned — the missing handle short-circuits before that
    expect(await store.read("vTEST")).toBeUndefined();
  });

  it("rejects an EMPTY X-Author-Handle header with 400 and never touches the throne", async () => {
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
    expect(body.title.toLowerCase()).toContain("required");
    expect(await store.read("vTEST")).toBeUndefined();
  });

  it("omits the incumbent from an empty-throne crown (you fought no one)", async () => {
    const store = inMemoryThroneStore();

    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("aggressor"))),
      arena("vTEST", store),
    );

    const body = (await res.json()) as { title?: Record<string, unknown> };

    expect(body.title?.outcome).toBe("throne-empty-crowned");
    expect(body.title).not.toHaveProperty("incumbent");
  });
});

// The title block a challenger reads back must be as debuggable as a gauntlet member's
// row: the same net / win-loss-draw / endReasons / degrade telemetry the gauntlet gate
// prints, so a would-be King can diagnose WHY it lost the championship bout (not just a
// lone win-rate scalar) and adjust without blindly regressing its 6/6 gauntlet clearance.
describe("handleFight — S4 slice 5: title-fight telemetry parity", () => {
  // The enriched title-fight stats under test (identity/seeds asserted elsewhere).
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
    // winRate 1.00 ⇒ every bout a win, none drawn or lost (10 seeds × both sides)
    expect(t?.wins).toBe(20);
    expect(t?.draws).toBe(0);
    expect(t?.losses).toBe(0);
    // the win-loss-draw split accounts for exactly the bouts fought
    expect(t!.wins + t!.losses + t!.draws).toBe(t?.bouts);
    // winning decisively ⇒ a positive net-points margin (not a bare count)
    expect(t?.net).toBeGreaterThan(0);
    // endReasons is a full four-key tally that sums to the bout count
    expect(sumTally(t!.endReasons)).toBe(20);
    // degrade carries the five-reason self-diagnostic shape
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

  it("surfaces full-fidelity telemetry on a king-retained loss (negative net, zero wins)", async () => {
    const store = inMemoryThroneStore();

    await enthrone(store, "vTEST", loadBot("berserker"));

    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("aggressor"))), // loses to berserker 0.00
      arena("vTEST", store),
    );

    const t = ((await res.json()) as { title?: TitleStats }).title;

    expect(t?.outcome).toBe("king-retained");
    expect(t?.wins).toBe(0);
    // losing every scored bout ⇒ a negative net margin the challenger can read
    expect(t?.net).toBeLessThan(0);
    expect(t!.wins + t!.losses + t!.draws).toBe(t?.bouts);
    expect(t?.bouts).toBe(20);
    expect(sumTally(t!.endReasons)).toBe(20);
  });

  it("emits all-zero title telemetry for a mirror clone (empty breakdown, no crash)", async () => {
    const store = inMemoryThroneStore();

    await enthrone(store, "vTEST", loadBot("berserker"));

    const res = await handleFight(
      fightRequest(JSON.stringify(loadBot("berserker"))), // byte-identical ⇒ no-mirror skip
      arena("vTEST", store),
    );

    const t = ((await res.json()) as { title?: TitleStats }).title;

    // the mirror skip leaves an empty breakdown; every figure must degrade to a clean zero
    expect(t?.outcome).toBe("king-retained");
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
