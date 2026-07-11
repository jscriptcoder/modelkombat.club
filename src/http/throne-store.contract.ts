// The shared `ThroneStore` contract — the behavioral spec that BOTH the in-memory fake and
// the production Upstash adapter must satisfy. `throne-store.test.ts` runs it against the fake
// in the ordinary suite; the env-gated smoke test runs the SAME spec against live Upstash, so
// the port's semantics are pinned in exactly one place. Not a `*.test.ts` file — it exports a
// function that emits `it()`s into whichever suite invokes it.
import { expect, it } from "vitest";

import type { ArenaMember, ArenaRecord, ThroneStore } from "./throne-store.js";
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
};
