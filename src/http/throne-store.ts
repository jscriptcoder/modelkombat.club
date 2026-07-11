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

// One crowning: the champion document + its monotonic generation (the CAS token)
// + the submitter's opaque author handle (S4), `null` when crowned without one.
// The handle is identity metadata only — persisted so the next challenger can scout
// the King, never read by the engine. Title seeds / winRate persistence is parked for
// a future replay / champions-history story (no v1 read surface).
export type ThroneRecord = {
  champion: BotDoc;
  generation: number;
  handle?: string | null;
};

// The outcome of an atomic crown attempt: it either lands (`ok`) or the throne
// moved under the caller since it read (`moved` — surfaced as 409 in slice 3).
export type CasResult =
  | { ok: true; record: ThroneRecord }
  | { ok: false; reason: "moved" };

// One member of the ranked arena: a champion document + its author handle (identity metadata,
// never read by the engine) + a `seniority` stamp — the next value of a strictly-increasing
// per-version entry counter (lower = longer unbroken tenure, the dead-even ranking backstop).
export type ArenaMember = {
  champion: BotDoc;
  handle: string | null;
  seniority: number;
};

// The top-N ranked arena of champion "defenders" — the S1 re-architecture of the single throne.
// `members` is rank-ordered (`[0]` is the King), length ≤ N (N=1 in S1). `generation` is the CAS
// token for the whole record; `nextSeniority` is the per-version entry counter carried across
// commits. At N=1 the sole member is both King and the just-crowned entrant.
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
  // The reigning champion for a version, or `undefined` when the throne is empty.
  read(version: string): Promise<ThroneRecord | undefined>;
  // The `limit` most-recent crownings for a version, oldest-first (the lineage tail), or
  // `[]` when the throne is empty. A bounded read — the store never returns the whole
  // history — so `GET /king` can surface a capped succession (the Hall of Kings) cheaply.
  recent(version: string, limit: number): Promise<ThroneRecord[]>;
  // Crown `next` iff the stored generation still equals `expected` (`null` = "expected
  // empty"). Appends to the version's lineage as one atomic step.
  compareAndSwap(
    version: string,
    expected: number | null,
    next: ThroneRecord,
  ): Promise<CasResult>;
  // The current ranked arena for a version, or `undefined` when no champion has been crowned.
  readArena(version: string): Promise<ArenaRecord | undefined>;
  // Commit `next` iff the stored arena generation still equals `expected` (`null` = "expected
  // empty arena"). One atomic step: swap the arena record AND append the new King (arena #1)
  // to the version's crowning lineage — so `read()`/`recent()` stay byte-identical (S1 bridge).
  commitArena(
    version: string,
    expected: number | null,
    next: ArenaRecord,
  ): Promise<ArenaCasResult>;
};

// The in-memory fake also exposes the full per-version lineage for test assertions
// (the append-only champion history the production store keeps).
export type InMemoryThroneStore = ThroneStore & {
  lineage(version: string): ThroneRecord[];
};

// The crowning-lineage entry for an arena commit: arena #1 (the reigning King) as a `ThroneRecord`,
// stamped with the arena's generation and the member's handle. At N=1 the sole member IS the newly
// crowned King, so appending it keeps `read()`/`recent()` — and the "Gen N" display — byte-identical.
// Shared by the fake and the Upstash adapter so both derive the same entry. (S1 bridge; the lineage
// is retired when the podium moves to the arena in S3.)
export const lineageEntryOf = (arena: ArenaRecord): ThroneRecord => {
  const king = arena.members[0];

  return {
    champion: king.champion,
    generation: arena.generation,
    handle: king.handle,
  };
};

// Whether a commit keeps the SAME reigning King (arena #1) — the signal for whether the succession
// lineage grows (D-E). Keyed on arena #1's `seniority`: a unique, strictly-increasing per-version
// stamp, so equal seniority ⇔ the very same entry still reigns. This catches BOTH cases a crown
// changes hands — the challenger taking #1, AND an existing defender promoted to #1 by the reshuffle
// (which the challenger's own outcome would miss) — while staying a safe scalar compare the Upstash
// Lua adapter mirrors byte-for-byte (a champion-doc compare would hit cjson key-order instability).
// An empty prior arena is always a new reign. A non-crowning placement (a defender entering below #1)
// must not duplicate the sitting King in `read()`/`recent()`.
export const sameKing = (
  prev: ArenaRecord | undefined,
  next: ArenaRecord,
): boolean =>
  prev !== undefined && prev.members[0].seniority === next.members[0].seniority;

export const inMemoryThroneStore = (): InMemoryThroneStore => {
  const lineages = new Map<string, ThroneRecord[]>();
  const arenas = new Map<string, ArenaRecord>();

  const entries = (version: string): ThroneRecord[] =>
    lineages.get(version) ?? [];

  // The reigning record is the last lineage entry (`.at(-1)` ⇒ undefined when empty).
  const reigning = (version: string): ThroneRecord | undefined =>
    entries(version).at(-1);

  const currentGeneration = (version: string): number | null =>
    reigning(version)?.generation ?? null;

  return {
    read: (version) => Promise.resolve(reigning(version)),

    // The bounded lineage tail: the last `limit` entries, oldest-first (`slice(-limit)`).
    recent: (version, limit) => Promise.resolve(entries(version).slice(-limit)),

    compareAndSwap: (version, expected, next) => {
      if (currentGeneration(version) !== expected) {
        return Promise.resolve({ ok: false, reason: "moved" });
      }

      lineages.set(version, [...entries(version), next]);

      return Promise.resolve({ ok: true, record: next });
    },

    readArena: (version) => Promise.resolve(arenas.get(version)),

    commitArena: (version, expected, next) => {
      const current = arenas.get(version);

      if ((current?.generation ?? null) !== expected) {
        return Promise.resolve({ ok: false, reason: "moved" });
      }

      // One atomic step: swap the arena record AND — only when the crown changes hands (D-E) —
      // append the new King to the succession lineage. A non-crowning placement leaves arena #1,
      // so it must not grow `read()`/`recent()` (else the sitting King duplicates in the podium).
      arenas.set(version, next);

      if (!sameKing(current, next)) {
        lineages.set(version, [...entries(version), lineageEntryOf(next)]);
      }

      return Promise.resolve({ ok: true, record: next });
    },

    lineage: (version) => [...entries(version)],
  };
};
