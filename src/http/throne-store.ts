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

// A reproduction record: a gauntlet-clearer's fight captured as REPLAY RAW MATERIAL — the challenger
// document, the exact defender documents it fought, the frozen seeds, and the version (from which any
// fight is regenerated via `runFight`, never a tape — invariant #1). `memberSeniority` is the pin key:
// a placer's assigned seniority (so its record is kept while it sits in the arena), or `null` for a
// non-placer (never an arena member). Docs are private raw material — never surfaced (doc-privacy);
// the future `/replay` renders behavior only. K-bounding + pinning arrive with S5.2.
export type ReproRecord = {
  challenger: BotDoc;
  defenders: BotDoc[];
  seeds: readonly number[];
  version: string;
  memberSeniority: number | null;
};

export type ThroneStore = {
  // The current ranked arena for a version, or `undefined` when no champion has been crowned.
  readArena(version: string): Promise<ArenaRecord | undefined>;
  // The version's reproduction archive in append order (empty for an untouched version). No HTTP
  // surface consumes it yet — it exists for the store contract + the future `/replay`.
  readArchive(version: string): Promise<ReproRecord[]>;
  // Commit `next` iff the stored arena generation still equals `expected` (`null` = "expected
  // empty arena"). One atomic step: swap the arena record at the new generation AND — when a
  // reproduction `record` is supplied — append it to the archive, together or not at all; or report
  // a lost CAS race (`moved`), writing nothing.
  commitArena(
    version: string,
    expected: number | null,
    next: ArenaRecord,
    record?: ReproRecord,
  ): Promise<ArenaCasResult>;
};

// The default reproduction-archive bound (K) — the count of newest records kept unconditionally.
// Tunable config: raise it to retain more replay history, lower it to spend less storage. The
// composition root uses this default; tests inject a small K. Both the fake and the Upstash adapter
// read the same knob, so the archive bounds identically everywhere.
//
// Set to 100 (from 50) after measuring the full-archive `LRANGE 0 -1` reply: at cap 100 the reply
// is ~1.4 MiB worst-case (every record embeds the 3 champion docs; ~12 KB/record) and ~0.36 MiB for
// realistic bots — within a ~1.5 MiB ceiling for the `/replay`-only, 30s-cached read. 200 was
// rejected (2.8 MiB worst-case). See `plans/pure-koth-s3.md` Slice 4.
export const DEFAULT_ARCHIVE_LIMIT = 100;

// The archive retained after an append: the newest `limit` records, PLUS any older record still
// PINNED to a current arena member (its `memberSeniority` is among the committed arena's seniorities).
// So live members' entry replays are never lost ("newest K + up to N pinned"); a record un-pins the
// moment its member relegates (its seniority drops out of `pinnedSeniorities`) and ages out normally.
// Pure — the single source of the bound-and-pin rule the fake applies and the adapter's Lua mirrors.
// `pinnedSeniorities` is typed over `number | null` so a non-placer's null key can be looked up
// directly (the real set holds only numbers, so a null never matches — no separate guard needed).
export const retainArchive = (
  records: readonly ReproRecord[],
  pinnedSeniorities: ReadonlySet<number | null>,
  limit: number,
): ReproRecord[] => {
  const cutoff = records.length - limit;

  return records.filter(
    (record, index) =>
      index >= cutoff || pinnedSeniorities.has(record.memberSeniority),
  );
};

export const inMemoryThroneStore = (
  archiveLimit = DEFAULT_ARCHIVE_LIMIT,
): ThroneStore => {
  const arenas = new Map<string, ArenaRecord>();
  const archives = new Map<string, ReproRecord[]>();

  return {
    readArena: (version) => Promise.resolve(arenas.get(version)),

    readArchive: (version) => Promise.resolve(archives.get(version) ?? []),

    commitArena: (version, expected, next, record) => {
      const current = arenas.get(version);

      if ((current?.generation ?? null) !== expected) {
        return Promise.resolve({ ok: false, reason: "moved" });
      }

      arenas.set(version, next);

      if (record !== undefined) {
        const appended = [...(archives.get(version) ?? []), record];
        const pinned = new Set(next.members.map((member) => member.seniority));

        archives.set(version, retainArchive(appended, pinned, archiveLimit));
      }

      return Promise.resolve({ ok: true, record: next });
    },
  };
};
