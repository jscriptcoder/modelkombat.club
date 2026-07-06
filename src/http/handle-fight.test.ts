import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { handleFight, type FightDeps } from "./handle-fight.js";
import { inMemoryThroneStore } from "./throne-store.js";
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
});

const fightRequest = (body: string): Request =>
  new Request("https://mk.example/fight", { method: "POST", body });

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

    await store.compareAndSwap("vOTHER", null, {
      champion: other,
      generation: 1,
    });

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

  it("does not contest an already-occupied throne yet (title fight is slice 2)", async () => {
    const store = inMemoryThroneStore();
    const king = loadBot("berserker");

    await store.compareAndSwap("vTEST", null, {
      champion: king,
      generation: 1,
    });

    const clearer = loadBot("aggressor");

    const res = await handleFight(
      fightRequest(JSON.stringify(clearer)),
      arena("vTEST", store),
    );

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.cleared).toBe(true);
    expect(body).not.toHaveProperty("title");
    // throne unchanged: still the original king, still exactly one lineage entry
    expect((await store.read("vTEST"))?.champion).toEqual(king);
    expect(store.lineage("vTEST")).toHaveLength(1);
  });
});
