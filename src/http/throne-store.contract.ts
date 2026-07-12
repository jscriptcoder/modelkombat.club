// The shared `ThroneStore` contract — the behavioral spec that BOTH the in-memory fake and
// the production Upstash adapter must satisfy. `throne-store.test.ts` runs it against the fake
// in the ordinary suite; the env-gated smoke test runs the SAME spec against live Upstash, so
// the port's semantics are pinned in exactly one place. Not a `*.test.ts` file — it exports a
// function that emits `it()`s into whichever suite invokes it.
import { expect, it } from "vitest";

import type {
  ArenaMember,
  ArenaRecord,
  ReproRecord,
  ThroneStore,
} from "./throne-store.js";
import type { BotDoc } from "../engine/dsl.js";

// A minimal, distinct champion document per name — the store treats it as opaque.
const champ = (name: string): BotDoc => ({
  version: 1,
  name,
  rules: [],
  default: { type: "idle" },
});

// A minimal arena member: a champion, no handle, and its seniority stamp (lower = more senior).
const member = (name: string, seniority: number): ArenaMember => ({
  champion: champ(name),
  handle: null,
  seniority,
});

// A minimal reproduction record: the challenger, the defenders it fought, the seeds, the version,
// and its pin key (`memberSeniority` = the placer's seniority, or null for a non-placer). The store
// treats it as opaque JSON — it round-trips it verbatim.
const repro = (
  name: string,
  overrides?: Partial<ReproRecord>,
): ReproRecord => ({
  challenger: champ(name),
  defenders: [champ("king")],
  seeds: [1, 2, 3],
  version: "v",
  memberSeniority: null,
  ...overrides,
});

// A harness makes a FRESH, isolated store and the two version keys the spec exercises (`versionB`
// proves isolation). The fake uses fixed keys on a fresh in-memory store; the live smoke harness
// uses unique throwaway keys per call, so a persistent Redis stays isolated between cases.
export type ThroneStoreHarness = () => {
  store: ThroneStore;
  versionA: string;
  versionB: string;
};

export const runThroneStoreContract = (make: ThroneStoreHarness): void => {
  // The arena record (top-N ranked champion set) is the source of truth for the reigning champion.
  // Every commit is atomic: it swaps the arena record at a new generation, or reports `moved` on a
  // lost CAS race — the arena never tears.

  it("reads an undefined arena for an untouched version", async () => {
    const { store, versionA } = make();

    expect(await store.readArena(versionA)).toBeUndefined();
  });

  it("commits on an empty arena (expected null) and reflects it in readArena", async () => {
    const { store, versionA } = make();

    const arena: ArenaRecord = {
      members: [member("a", 1)],
      generation: 1,
      nextSeniority: 2,
    };

    const res = await store.commitArena(versionA, null, arena);

    expect(res).toEqual({ ok: true, record: arena });
    expect(await store.readArena(versionA)).toEqual(arena);
  });

  it("commits on a matching generation and swaps the arena", async () => {
    const { store, versionA } = make();

    await store.commitArena(versionA, null, {
      members: [member("a", 1)],
      generation: 1,
      nextSeniority: 2,
    });

    const res = await store.commitArena(versionA, 1, {
      members: [member("b", 2)],
      generation: 2,
      nextSeniority: 3,
    });

    expect(res.ok).toBe(true);
    expect((await store.readArena(versionA))?.members[0].champion.name).toBe(
      "b",
    );
  });

  it("rejects a stale arena generation as moved and does not write the arena", async () => {
    const { store, versionA } = make();

    await store.commitArena(versionA, null, {
      members: [member("a", 1)],
      generation: 1,
      nextSeniority: 2,
    });

    // the arena is now at generation 1; a commit expecting generation 0 has gone stale
    const res = await store.commitArena(versionA, 0, {
      members: [member("b", 2)],
      generation: 2,
      nextSeniority: 3,
    });

    expect(res).toEqual({ ok: false, reason: "moved" });
    expect((await store.readArena(versionA))?.members[0].champion.name).toBe(
      "a",
    ); // arena unchanged
  });

  it("persists member seniority and the nextSeniority counter faithfully", async () => {
    const { store, versionA } = make();

    // Non-1 values so a "replace with a default" mutant on either field is caught.
    const arena: ArenaRecord = {
      members: [member("a", 7)],
      generation: 1,
      nextSeniority: 8,
    };

    await store.commitArena(versionA, null, arena);

    const got = await store.readArena(versionA);
    expect(got?.members[0].seniority).toBe(7);
    expect(got?.nextSeniority).toBe(8);
  });

  it("keeps arenas version-isolated — a commit under one version leaves others empty", async () => {
    const { store, versionA, versionB } = make();

    await store.commitArena(versionA, null, {
      members: [member("a", 1)],
      generation: 1,
      nextSeniority: 2,
    });

    expect(await store.readArena(versionB)).toBeUndefined();
  });

  // The reproduction archive: every gauntlet-clearer's commit may carry a reproduction record that
  // is appended ATOMICALLY with the arena swap (one gen-guarded step — land together or not at all).
  // No read surface ships yet; `readArchive` exists for the contract + the future `/replay`.

  it("reads an empty archive for an untouched version", async () => {
    const { store, versionA } = make();

    expect(await store.readArchive(versionA)).toEqual([]);
  });

  it("appends a reproduction record atomically with a commit and reads it back verbatim", async () => {
    const { store, versionA } = make();

    const record = repro("clearer", {
      defenders: [champ("king"), champ("second")],
      seeds: [4, 5, 6],
      version: versionA,
      memberSeniority: 1,
    });

    await store.commitArena(
      versionA,
      null,
      { members: [member("clearer", 1)], generation: 1, nextSeniority: 2 },
      record,
    );

    // The whole record round-trips — challenger, the exact defenders fought, seeds, version, and the
    // pin key — so a "drop/replace a field" mutant on the append path is caught.
    expect(await store.readArchive(versionA)).toEqual([record]);
  });

  it("does not append the record when the commit loses the CAS race (moved)", async () => {
    const { store, versionA } = make();

    await store.commitArena(versionA, null, {
      members: [member("a", 1)],
      generation: 1,
      nextSeniority: 2,
    });

    // A commit expecting generation 0 has gone stale → moved. The record must NOT be appended
    // (the append lives INSIDE the gen-guard — nothing is written on a lost race).
    const res = await store.commitArena(
      versionA,
      0,
      { members: [member("b", 2)], generation: 2, nextSeniority: 3 },
      repro("b"),
    );

    expect(res).toEqual({ ok: false, reason: "moved" });
    expect(await store.readArchive(versionA)).toEqual([]);
  });

  it("appends records in submission order across successive commits", async () => {
    const { store, versionA } = make();

    await store.commitArena(
      versionA,
      null,
      { members: [member("a", 1)], generation: 1, nextSeniority: 2 },
      repro("first"),
    );
    await store.commitArena(
      versionA,
      1,
      { members: [member("b", 2)], generation: 2, nextSeniority: 3 },
      repro("second"),
    );

    const archive = await store.readArchive(versionA);
    expect(archive.map((r) => r.challenger.name)).toEqual(["first", "second"]);
  });

  it("appends nothing when a commit carries no reproduction record", async () => {
    const { store, versionA } = make();

    await store.commitArena(versionA, null, {
      members: [member("a", 1)],
      generation: 1,
      nextSeniority: 2,
    });

    // A record-less commit (e.g. test/seed setup) swaps the arena but leaves the archive untouched —
    // the append fires ONLY when a record is supplied.
    expect(await store.readArchive(versionA)).toEqual([]);
  });
};
