import { describe, expect, it } from "vitest";

import { inMemoryThroneStore } from "./throne-store.js";
import type { BotDoc } from "../engine/dsl.js";

// A minimal, distinct champion document per name — the store treats it as opaque.
const champ = (name: string): BotDoc => ({
  version: 1,
  name,
  rules: [],
  default: { type: "idle" },
});

describe("inMemoryThroneStore — the version-scoped throne contract", () => {
  it("reads undefined for an empty version throne", async () => {
    expect(await inMemoryThroneStore().read("v19")).toBeUndefined();
  });

  it("crowns on an empty throne (expected null) and returns the new record", async () => {
    const store = inMemoryThroneStore();
    const a = champ("a");

    const res = await store.compareAndSwap("v19", null, {
      champion: a,
      generation: 1,
    });

    expect(res).toEqual({ ok: true, record: { champion: a, generation: 1 } });
    expect(await store.read("v19")).toEqual({ champion: a, generation: 1 });
    expect(store.lineage("v19")).toHaveLength(1);
  });

  it("crowns on a matching generation and appends to the append-only lineage", async () => {
    const store = inMemoryThroneStore();

    await store.compareAndSwap("v19", null, {
      champion: champ("a"),
      generation: 1,
    });

    const res = await store.compareAndSwap("v19", 1, {
      champion: champ("b"),
      generation: 2,
    });

    expect(res.ok).toBe(true);
    expect((await store.read("v19"))?.champion.name).toBe("b");
    // history preserved: both crownings kept, newest last
    expect(store.lineage("v19").map((e) => e.champion.name)).toEqual([
      "a",
      "b",
    ]);
  });

  it("rejects a stale generation as moved and does not append", async () => {
    const store = inMemoryThroneStore();

    await store.compareAndSwap("v19", null, {
      champion: champ("a"),
      generation: 1,
    });

    // the throne is now at generation 1; a crown expecting generation 0 has gone stale
    const res = await store.compareAndSwap("v19", 0, {
      champion: champ("b"),
      generation: 2,
    });

    expect(res).toEqual({ ok: false, reason: "moved" });
    expect((await store.read("v19"))?.champion.name).toBe("a"); // king unchanged
    expect(store.lineage("v19")).toHaveLength(1); // challenger NOT appended
  });

  it("keeps versions isolated — a crown under one version leaves others empty", async () => {
    const store = inMemoryThroneStore();

    await store.compareAndSwap("v19", null, {
      champion: champ("a"),
      generation: 1,
    });

    expect(await store.read("v20")).toBeUndefined();
    expect(store.lineage("v20")).toHaveLength(0);
  });
});
