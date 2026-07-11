// The version-scoped King-of-the-Hill store — the platform's stateful piece. A thin PORT
// (`readArena` + `commitArena`) over the top-N ranked arena, with an in-memory FAKE as the
// test/local default; the production Upstash-Redis-over-`fetch` adapter implements the same port.
// Methods are async so the fake and the real adapter share one contract with no signature churn.
//
// This lives in the platform layer (`src/http`), NOT the engine: it is transport + storage,
// touches no DSL op, and leaves the TCB untouched (invariant #2). Fights are never stored as tapes
// — only champion documents + ranking metadata, from which any title fight is reconstructed via
// `runFight` (invariant #1).
import type { BotDoc } from "../engine/dsl.js";

// One member of the ranked arena: a champion document + its author handle (identity metadata,
// never read by the engine) + a `seniority` stamp — the next value of a strictly-increasing
// per-version entry counter (lower = longer unbroken tenure, the dead-even ranking backstop).
export type ArenaMember = {
  champion: BotDoc;
  handle: string | null;
  seniority: number;
};

// The top-N ranked arena of champion "defenders" — the single source of truth for the reigning
// champion (arena `[0]`) and its challengers-in-waiting. `members` is rank-ordered (`[0]` is the
// King), length ≤ N. `generation` is the CAS token for the whole record; `nextSeniority` is the
// per-version entry counter carried across commits.
export type ArenaRecord = {
  members: ArenaMember[];
  generation: number;
  nextSeniority: number;
};

// The outcome of an atomic arena commit: it either lands (`ok`, carrying the committed arena)
// or the arena moved under the caller since it read (`moved` — surfaced as 409).
export type ArenaCasResult =
  | { ok: true; record: ArenaRecord }
  | { ok: false; reason: "moved" };

export type ThroneStore = {
  // The current ranked arena for a version, or `undefined` when no champion has been crowned.
  readArena(version: string): Promise<ArenaRecord | undefined>;
  // Commit `next` iff the stored arena generation still equals `expected` (`null` = "expected
  // empty arena"). One atomic step: swap the arena record at the new generation, or report a lost
  // CAS race (`moved`).
  commitArena(
    version: string,
    expected: number | null,
    next: ArenaRecord,
  ): Promise<ArenaCasResult>;
};

export const inMemoryThroneStore = (): ThroneStore => {
  const arenas = new Map<string, ArenaRecord>();

  return {
    readArena: (version) => Promise.resolve(arenas.get(version)),

    commitArena: (version, expected, next) => {
      const current = arenas.get(version);

      if ((current?.generation ?? null) !== expected) {
        return Promise.resolve({ ok: false, reason: "moved" });
      }

      arenas.set(version, next);

      return Promise.resolve({ ok: true, record: next });
    },
  };
};
