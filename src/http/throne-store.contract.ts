// The shared `ThroneStore` contract — the behavioral spec that BOTH the in-memory fake and
// the production Upstash adapter must satisfy. `throne-store.test.ts` runs it against the fake
// in the ordinary suite; the env-gated smoke test runs the SAME spec against live Upstash, so
// the port's semantics are pinned in exactly one place. Not a `*.test.ts` file — it exports a
// function that emits `it()`s into whichever suite invokes it.
import { expect, it } from "vitest";

import type { ThroneRecord, ThroneStore } from "./throne-store.js";
import type { BotDoc } from "../engine/dsl.js";

// A minimal, distinct champion document per name — the store treats it as opaque.
const champ = (name: string): BotDoc => ({
  version: 1,
  name,
  rules: [],
  default: { type: "idle" },
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
};
