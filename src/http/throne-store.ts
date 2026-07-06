// The version-scoped King-of-the-Hill throne store (S4) — the first *stateful*
// platform piece. A thin PORT (`read` + `compareAndSwap`) with an in-memory FAKE
// as the test/local default; the production Upstash-Redis-over-`fetch` adapter
// (slice 5) implements the same port. Methods are async so the fake and the real
// adapter share one contract with no signature churn.
//
// This lives in the platform layer (`src/http`), NOT the engine: it is transport +
// storage, touches no DSL op, and leaves the TCB untouched (invariant #2). Fights
// are never stored as tapes — only champion documents + crowning metadata, from
// which any title fight is reconstructed via `runFight` (invariant #1).
import type { BotDoc } from "../engine/dsl.js";

// One crowning: the champion document + its monotonic generation (the CAS token).
// Crowning metadata (title seeds, winRate, submitter identity) is added in later
// slices; slice 1 needs only the pointer fields.
export type ThroneRecord = { champion: BotDoc; generation: number };

// The outcome of an atomic crown attempt: it either lands (`ok`) or the throne
// moved under the caller since it read (`moved` — surfaced as 409 in slice 3).
export type CasResult =
  | { ok: true; record: ThroneRecord }
  | { ok: false; reason: "moved" };

export type ThroneStore = {
  // The reigning champion for a version, or `undefined` when the throne is empty.
  read(version: string): Promise<ThroneRecord | undefined>;
  // Crown `next` iff the stored generation still equals `expected` (`null` = "expected
  // empty"). Appends to the version's lineage as one atomic step.
  compareAndSwap(
    version: string,
    expected: number | null,
    next: ThroneRecord,
  ): Promise<CasResult>;
};

// The in-memory fake also exposes the full per-version lineage for test assertions
// (the append-only champion history the production store keeps).
export type InMemoryThroneStore = ThroneStore & {
  lineage(version: string): ThroneRecord[];
};

export const inMemoryThroneStore = (): InMemoryThroneStore => {
  const lineages = new Map<string, ThroneRecord[]>();

  const entries = (version: string): ThroneRecord[] =>
    lineages.get(version) ?? [];

  // The reigning record is the last lineage entry (`.at(-1)` ⇒ undefined when empty).
  const reigning = (version: string): ThroneRecord | undefined =>
    entries(version).at(-1);

  const currentGeneration = (version: string): number | null =>
    reigning(version)?.generation ?? null;

  return {
    read: (version) => Promise.resolve(reigning(version)),

    compareAndSwap: (version, expected, next) => {
      if (currentGeneration(version) !== expected) {
        return Promise.resolve({ ok: false, reason: "moved" });
      }

      lineages.set(version, [...entries(version), next]);

      return Promise.resolve({ ok: true, record: next });
    },

    lineage: (version) => [...entries(version)],
  };
};
