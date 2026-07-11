// The shared `ThroneStore` contract — the behavioral spec that BOTH the in-memory fake and
// the production Upstash adapter must satisfy. `throne-store.test.ts` runs it against the fake
// in the ordinary suite; the env-gated smoke test runs the SAME spec against live Upstash, so
// the port's semantics are pinned in exactly one place. Not a `*.test.ts` file — it exports a
// function that emits `it()`s into whichever suite invokes it.
import { expect, it } from "vitest";

import type {
  ArenaMember,
  ArenaRecord,
  ThroneRecord,
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

// A harness makes a FRESH, isolated store, a way to observe its append-only lineage, and the
// two version keys the spec exercises (`versionB` proves isolation). The fake uses fixed keys
// on a fresh in-memory store; the live smoke harness uses unique throwaway keys per call (so a
// persistent Redis stays isolated between cases) and reads lineage via LRANGE.
export type ThroneStoreHarness = () => {
  store: ThroneStore;
  readLineage: (version: string) => Promise<ThroneRecord[]>;
  versionA: string;
  versionB: string;
};

export const runThroneStoreContract = (make: ThroneStoreHarness): void => {
  it("reads undefined for an empty version throne", async () => {
    const { store, versionA } = make();

    expect(await store.read(versionA)).toBeUndefined();
  });

  it("crowns on an empty throne (expected null) and reflects it in read + lineage", async () => {
    const { store, readLineage, versionA } = make();
    const a = champ("a");

    const res = await store.compareAndSwap(versionA, null, {
      champion: a,
      generation: 1,
    });

    expect(res).toEqual({ ok: true, record: { champion: a, generation: 1 } });
    expect(await store.read(versionA)).toEqual({ champion: a, generation: 1 });
    expect(await readLineage(versionA)).toHaveLength(1);
  });

  it("crowns on a matching generation and appends to the lineage (newest last)", async () => {
    const { store, readLineage, versionA } = make();

    await store.compareAndSwap(versionA, null, {
      champion: champ("a"),
      generation: 1,
    });

    const res = await store.compareAndSwap(versionA, 1, {
      champion: champ("b"),
      generation: 2,
    });

    expect(res.ok).toBe(true);
    expect((await store.read(versionA))?.champion.name).toBe("b");
    // history preserved: both crownings kept, newest last
    expect((await readLineage(versionA)).map((e) => e.champion.name)).toEqual([
      "a",
      "b",
    ]);
  });

  it("rejects a stale generation as moved and does not append", async () => {
    const { store, readLineage, versionA } = make();

    await store.compareAndSwap(versionA, null, {
      champion: champ("a"),
      generation: 1,
    });

    // the throne is now at generation 1; a crown expecting generation 0 has gone stale
    const res = await store.compareAndSwap(versionA, 0, {
      champion: champ("b"),
      generation: 2,
    });

    expect(res).toEqual({ ok: false, reason: "moved" });
    expect((await store.read(versionA))?.champion.name).toBe("a"); // king unchanged
    expect(await readLineage(versionA)).toHaveLength(1); // challenger NOT appended
  });

  it("keeps versions isolated — a crown under one version leaves others empty", async () => {
    const { store, readLineage, versionA, versionB } = make();

    await store.compareAndSwap(versionA, null, {
      champion: champ("a"),
      generation: 1,
    });

    expect(await store.read(versionB)).toBeUndefined();
    expect(await readLineage(versionB)).toHaveLength(0);
  });

  it("reads an empty recent lineage for an untouched version", async () => {
    const { store, versionA } = make();

    expect(await store.recent(versionA, 3)).toEqual([]);
  });

  it("returns the most-recent crownings, oldest-first, bounded by the limit", async () => {
    const { store, versionA } = make();

    // Four successive crownings a→b→c→d (each CAS matches the prior generation).
    await store.compareAndSwap(versionA, null, {
      champion: champ("a"),
      generation: 1,
    });
    await store.compareAndSwap(versionA, 1, {
      champion: champ("b"),
      generation: 2,
    });
    await store.compareAndSwap(versionA, 2, {
      champion: champ("c"),
      generation: 3,
    });
    await store.compareAndSwap(versionA, 3, {
      champion: champ("d"),
      generation: 4,
    });

    const recent = await store.recent(versionA, 3);

    // The three most-recent, oldest-first (the /king handler reverses to newest-first);
    // the fourth-oldest ("a") has dropped off the bounded tail.
    expect(recent.map((e) => e.champion.name)).toEqual(["b", "c", "d"]);
    expect(recent.map((e) => e.generation)).toEqual([2, 3, 4]);
  });

  it("keeps the recent lineage version-isolated", async () => {
    const { store, versionA, versionB } = make();

    await store.compareAndSwap(versionA, null, {
      champion: champ("a"),
      generation: 1,
    });

    expect(await store.recent(versionB, 3)).toEqual([]);
  });

  // --- Arena (top-N ranked champion set) — the S1 re-architecture, exercised at N=1. ------------
  // The arena record is the new source of truth for the reigning champion. Every commit is atomic:
  // it swaps the arena record AND appends the new King (arena #1) to the crowning lineage that
  // `read()`/`recent()` still serve — the S1 bridge that keeps `/king` byte-identical while the
  // podium change is deferred to S3 (the lineage is retired then).

  it("reads an undefined arena for an untouched version", async () => {
    const { store, versionA } = make();

    expect(await store.readArena(versionA)).toBeUndefined();
  });

  it("commits on an empty arena (expected null) and reflects it in readArena, read, and recent", async () => {
    const { store, versionA } = make();

    const arena: ArenaRecord = {
      members: [member("a", 1)],
      generation: 1,
      nextSeniority: 2,
    };

    const res = await store.commitArena(versionA, null, arena);

    expect(res).toEqual({ ok: true, record: arena });
    expect(await store.readArena(versionA)).toEqual(arena);
    // lineage bridge: the crowned King is the reigning record and the sole recent entry
    expect((await store.read(versionA))?.champion.name).toBe("a");
    expect(
      (await store.recent(versionA, 3)).map((e) => e.champion.name),
    ).toEqual(["a"]);
  });

  it("commits on a matching generation, swaps the arena, and appends the new King to the lineage (newest last)", async () => {
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
    // history preserved via the lineage: both crownings, newest last, with their generations
    expect(
      (await store.recent(versionA, 3)).map((e) => e.champion.name),
    ).toEqual(["a", "b"]);
    expect((await store.recent(versionA, 3)).map((e) => e.generation)).toEqual([
      1, 2,
    ]);
    expect((await store.read(versionA))?.champion.name).toBe("b");
  });

  it("does NOT grow the lineage when the King (arena #1) is unchanged (a non-crowning placement)", async () => {
    const { store, versionA } = make();

    await store.commitArena(versionA, null, {
      members: [member("a", 1)],
      generation: 1,
      nextSeniority: 2,
    });

    // "b" enters at #2; the King ("a") is unchanged — a defender joined without a new reign.
    const res = await store.commitArena(versionA, 1, {
      members: [member("a", 1), member("b", 2)],
      generation: 2,
      nextSeniority: 3,
    });

    expect(res.ok).toBe(true);
    // the arena record reflects both members, rank-ordered
    expect(
      (await store.readArena(versionA))?.members.map((m) => m.champion.name),
    ).toEqual(["a", "b"]);
    // but the succession lineage did NOT grow — the crown never changed hands (D-E). A blind
    // append would duplicate the sitting King in `/king recent` (the Hall of Kings).
    expect(
      (await store.recent(versionA, 3)).map((e) => e.champion.name),
    ).toEqual(["a"]);
    expect((await store.read(versionA))?.champion.name).toBe("a");
  });

  it("rejects a stale arena generation as moved and writes neither the arena nor the lineage", async () => {
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
    expect((await store.read(versionA))?.champion.name).toBe("a");
    expect(await store.recent(versionA, 3)).toHaveLength(1); // challenger NOT appended
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
    expect(await store.recent(versionB, 3)).toEqual([]);
  });
};
