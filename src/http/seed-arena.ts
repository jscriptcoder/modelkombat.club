// The House seed — the three placeholder champions a fresh (empty) version's arena is born with,
// so `/king` shows a live board and `/fight` contests it directly instead of a lone bootstrap crown
// (D3/D5/D15). Platform layer, no engine reach: pure data assembly over already-authored bot docs.
//
// Determinism (invariant #1): `SEED_ORDER` is a PINNED constant — the strongest three gauntlet bots
// and their arena order are computed once, offline, and locked here; the handler NEVER re-runs the
// round-robin at cold start. `seed-arena.test.ts` re-derives the ordering from the real `benchmark`
// and fails the build if the pin ever diverges (a roster/rules change that reorders them).
import type { BotDoc } from "../engine/dsl.js";
import type { ArenaMember, ArenaRecord, ThroneStore } from "./throne-store.js";

// The pinned rank order (King → #2 → #3): the three strongest gauntlet bots by round-robin
// win-rate, ordered by the arena's `byRank` total order. Pinned, not recomputed at runtime (D5).
export const SEED_ORDER = ["grappler", "sweeper", "rekka"] as const;

// The visible House identity (D15): authored by "Gauntlet", model labelled "House". The model is an
// inert DISPLAY override — the engine never reads it and `INPUT_HASH` excludes it, so a fight is
// byte-identical whatever the label; and any model the brand map doesn't recognise renders the
// neutral/unknown glyph, so House rows read apart from real LLM submissions with no web change.
export const SEED_HANDLE = "Gauntlet";
export const SEED_MODEL = "House";

// Build the seed arena from the loaded gauntlet docs: pick the `SEED_ORDER` bots by name, in that
// rank order, each stamped seniority 1..N (rank order = tenure order), model → "House", handle →
// "Gauntlet". Pure + deterministic — no fights, no entropy (D5). `generation: 1` / `nextSeniority:
// N+1` so the first real compete materializes it via a normal CAS and the next entrant gets N+1.
export const buildSeedArena = (gauntlet: readonly BotDoc[]): ArenaRecord => {
  const byName = new Map(gauntlet.map((bot) => [bot.name, bot]));

  const members: ArenaMember[] = SEED_ORDER.map((name, index): ArenaMember => {
    const doc = byName.get(name);

    if (doc === undefined) {
      throw new Error(`seed bot "${name}" is not in the loaded gauntlet`);
    }

    return {
      champion: { ...doc, model: SEED_MODEL },
      handle: SEED_HANDLE,
      seniority: index + 1,
    };
  });

  return { members, generation: 1, nextSeniority: SEED_ORDER.length + 1 };
};

// The effective arena for a version: the stored arena, or the seed when the store is empty. The
// shared seed default for the read path (`handle-king`). `seed` is optional so a caller that
// supplies none keeps the pre-seed "empty → no arena" behaviour. (Slice 2 extends this to also
// surface the CAS `expected` — `null` when physically empty — for the compete path.)
export const readArenaOrSeed = async (
  store: ThroneStore,
  version: string,
  seed?: ArenaRecord,
): Promise<ArenaRecord | undefined> => (await store.readArena(version)) ?? seed;
