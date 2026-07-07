import { describe, expect, it } from "vitest";

import { handleKing } from "./handle-king.js";
import { inMemoryThroneStore, type ThroneStore } from "./throne-store.js";
import type { BotDoc } from "../engine/dsl.js";

// The version the /king read is scoped to (a test key — the real endpoint reads
// BENCHMARK_VERSION). Enthroning under a DIFFERENT version must read as empty.
const VERSION = "v-test";

// A reigning champion whose document carries real `rules` (a DSL body). /king must
// surface the champion's IDENTITY only — the rules must never leak into the response,
// preserving the King's competitive edge (decision 5 / AC-K1 no-leak).
const champion = (overrides?: Partial<BotDoc>): BotDoc => ({
  version: 1,
  name: "reigning-king",
  model: "claude-opus-4-8",
  rules: [
    {
      when: {
        op: "gte",
        args: [
          { op: "field", path: "self.canAct" },
          { op: "const", value: 1 },
        ],
      },
      do: { type: "move", dir: 1 },
    },
  ],
  default: { type: "idle" },
  ...overrides,
});

const kingRequest = (method = "GET"): Request =>
  new Request("https://mk.example/king", { method });

// Interleave a control character into a string via its code point — keeps this source
// pure ASCII (git-diffable, formatter-safe) instead of embedding raw control bytes.
const ctrl = (code: number): string => String.fromCharCode(code);

// Pre-seat a reigning champion in the fake (generation 1, expected-empty). `handle` is
// the submitter label persisted on the record; omitted ⇒ the record has none.
const enthrone = (
  store: ThroneStore,
  reigning: BotDoc,
  opts?: { generation?: number; handle?: string | null },
): Promise<unknown> =>
  store.compareAndSwap(VERSION, null, {
    champion: reigning,
    generation: opts?.generation ?? 1,
    handle: opts?.handle,
  });

// Crown a whole succession under VERSION — each CAS matches the prior generation, so the
// lineage grows a→b→c→… (oldest-first in storage). Used to exercise the `recent[]` tail.
const crownLineage = (store: ThroneStore, names: string[]): Promise<unknown> =>
  names.reduce<Promise<unknown>>(
    (prior, name, i) =>
      prior.then(() =>
        store.compareAndSwap(VERSION, i === 0 ? null : i, {
          champion: champion({ name }),
          generation: i + 1,
        }),
      ),
    Promise.resolve(),
  );

// A store whose reads always fail — models Upstash being unreachable (the real adapter
// THROWS on an error reply, never silently reads empty). Drives the 503 path (AC-K3).
const failingStore = (): ThroneStore => ({
  read: () => Promise.reject(new Error("upstash unreachable")),
  recent: () => Promise.reject(new Error("upstash unreachable")),
  compareAndSwap: () => Promise.reject(new Error("unused in /king")),
});

type Champion = {
  name: string;
  model: string | null;
  handle: string | null;
  generation: number;
};

type KingBody = {
  current: null | Champion;
  recent: Champion[];
};

const IDENTITY_KEYS = ["generation", "handle", "model", "name"] as const;

describe("GET /king — the version-scoped reigning-King read", () => {
  it("returns the reigning champion's identity (name, model, handle, generation)", async () => {
    const store = inMemoryThroneStore();

    await enthrone(store, champion(), { generation: 3, handle: "grandmaster" });

    const res = await handleKing(kingRequest(), { store, version: VERSION });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );

    const body = (await res.json()) as KingBody;

    expect(body.current).toEqual({
      name: "reigning-king",
      model: "claude-opus-4-8",
      handle: "grandmaster",
      generation: 3,
    });
  });

  it("never leaks the champion's DSL/rules into the response", async () => {
    const store = inMemoryThroneStore();

    await enthrone(store, champion());

    const res = await handleKing(kingRequest(), { store, version: VERSION });

    const body = (await res.json()) as KingBody;

    // Exactly the four identity fields — no `rules`, no `version`, no `default`.
    expect(Object.keys(body.current ?? {}).sort()).toEqual([
      "generation",
      "handle",
      "model",
      "name",
    ]);

    // Defense in depth: no DSL token survives anywhere in the serialized payload.
    const raw = JSON.stringify(body);

    expect(raw).not.toContain("rules");
    expect(raw).not.toContain("canAct");
    expect(raw).not.toContain("default");
  });

  it("defaults an absent model and handle to null (not omitted, not 'undefined')", async () => {
    const store = inMemoryThroneStore();

    // A champion doc with no `model`, enthroned with no `handle`.
    await enthrone(store, champion({ model: undefined }));

    const res = await handleKing(kingRequest(), { store, version: VERSION });

    const body = (await res.json()) as KingBody;

    expect(body.current?.model).toBeNull();
    expect(body.current?.handle).toBeNull();
  });

  it("reads empty for a version with no crowned King (a success, not an error)", async () => {
    const store = inMemoryThroneStore();

    // Crown someone under a DIFFERENT version — the scoped read must still be empty.
    await store.compareAndSwap("other-version", null, {
      champion: champion(),
      generation: 1,
    });

    const res = await handleKing(kingRequest(), { store, version: VERSION });

    expect(res.status).toBe(200);

    const body = (await res.json()) as KingBody;

    expect(body.current).toBeNull();
  });

  it("returns the recent succession newest-first, each identity-only (recent[0] == current)", async () => {
    const store = inMemoryThroneStore();

    await crownLineage(store, ["a", "b", "c"]);

    const res = await handleKing(kingRequest(), { store, version: VERSION });
    const body = (await res.json()) as KingBody;

    expect(res.status).toBe(200);
    expect(body.recent.map((c) => c.name)).toEqual(["c", "b", "a"]);
    // The newest crowning is both the current King and the head of the succession.
    expect(body.recent[0]).toEqual(body.current);
    // Every entry is identity-only (no rules / version / default).
    body.recent.forEach((entry) => {
      expect(Object.keys(entry).sort()).toEqual([...IDENTITY_KEYS]);
    });
  });

  it("bounds the recent succession to the three most-recent Kings (older drop off)", async () => {
    const store = inMemoryThroneStore();

    await crownLineage(store, ["a", "b", "c", "d"]);

    const res = await handleKing(kingRequest(), { store, version: VERSION });
    const body = (await res.json()) as KingBody;

    expect(body.recent.map((c) => c.name)).toEqual(["d", "c", "b"]);
    expect(body.recent.map((c) => c.name)).not.toContain("a"); // oldest dropped
  });

  it("reads an empty recent lineage when no King is crowned", async () => {
    const store = inMemoryThroneStore();

    const res = await handleKing(kingRequest(), { store, version: VERSION });
    const body = (await res.json()) as KingBody;

    expect(body.current).toBeNull();
    expect(body.recent).toEqual([]);
  });

  it("never leaks the champions' DSL/rules anywhere in recent[]", async () => {
    const store = inMemoryThroneStore();

    // Both champions carry a real `rules` body — the whole lineage must project identity-only.
    await crownLineage(store, ["older-king", "newer-king"]);

    const res = await handleKing(kingRequest(), { store, version: VERSION });
    const body = (await res.json()) as KingBody;

    expect(body.recent).toHaveLength(2);
    body.recent.forEach((entry) => {
      expect(Object.keys(entry).sort()).toEqual([...IDENTITY_KEYS]);
    });

    const rawRecent = JSON.stringify(body.recent);

    expect(rawRecent).not.toContain("rules");
    expect(rawRecent).not.toContain("canAct");
    expect(rawRecent).not.toContain("default");
  });

  it("strips control characters from identity strings for current and every recent entry", async () => {
    const store = inMemoryThroneStore();

    // Two crownings whose name/model/handle carry C0 + DEL control characters. Boundary
    // coverage: 0x1F is stripped while the adjacent 0x20 space survives; 0x7F (DEL) is
    // stripped while the adjacent 0x7E "~" survives — pinning both edges of the strip range.
    await store.compareAndSwap(VERSION, null, {
      champion: champion({
        name: `ka${ctrl(0x00)}ta ${ctrl(0x1f)}master`, // -> "kata master"
        model: `claude${ctrl(0x07)}opus`, // -> "claudeopus"
      }),
      generation: 1,
      handle: `gr${ctrl(0x01)}and`, // -> "grand"
    });
    await store.compareAndSwap(VERSION, 1, {
      champion: champion({
        name: `new~${ctrl(0x7f)}king`, // -> "new~king"
        model: `opus${ctrl(0x1f)}x`, // -> "opusx"
      }),
      generation: 2,
      handle: `he${ctrl(0x02)}ir`, // -> "heir"
    });

    const res = await handleKing(kingRequest(), { store, version: VERSION });
    const body = (await res.json()) as KingBody;

    // current (the newest) is sanitized...
    expect(body.current).toEqual({
      name: "new~king",
      model: "opusx",
      handle: "heir",
      generation: 2,
    });
    // ...and so is the older lineage entry (every entry, not just current).
    expect(body.recent[1]).toEqual({
      name: "kata master",
      model: "claudeopus",
      handle: "grand",
      generation: 1,
    });
  });

  it("leaves ordinary and markup-bearing identity strings unchanged", async () => {
    const store = inMemoryThroneStore();

    // Spaces (0x20), `<`, `>`, `(` are all printable (≥ 0x20) — sanitization must not touch
    // them, so the Slice-2 auto-escaping behavior (inert markup) is preserved unchanged. The
    // embedded spaces also pin the top edge of the strip range (0x20 must survive).
    await enthrone(
      store,
      champion({
        name: "Grand Master <script>alert(1)</script>",
        model: "claude-opus-4-8",
      }),
      { generation: 1, handle: "kata-master" },
    );

    const res = await handleKing(kingRequest(), { store, version: VERSION });
    const body = (await res.json()) as KingBody;

    expect(body.current).toEqual({
      name: "Grand Master <script>alert(1)</script>",
      model: "claude-opus-4-8",
      handle: "kata-master",
      generation: 1,
    });
  });

  it("returns 503 when the recent lineage read fails even if the pointer read succeeds", async () => {
    // The pointer read succeeds but the lineage read throws — a partial outage must still be
    // a 503, never a 200 with a truncated/empty succession.
    const readOkRecentFails: ThroneStore = {
      read: () => Promise.resolve({ champion: champion(), generation: 1 }),
      recent: () => Promise.reject(new Error("lineage unreachable")),
      compareAndSwap: () => Promise.reject(new Error("unused in /king")),
    };

    const res = await handleKing(kingRequest(), {
      store: readOkRecentFails,
      version: VERSION,
    });

    expect(res.status).toBe(503);

    const body = (await res.json()) as { type: string };

    expect(body.type).toBe("/problems/throne-unavailable");
  });

  it("returns 503 problem+json when the throne store is unreachable", async () => {
    const res = await handleKing(kingRequest(), {
      store: failingStore(),
      version: VERSION,
    });

    expect(res.status).toBe(503);
    expect(res.headers.get("content-type")).toBe(
      "application/problem+json; charset=utf-8",
    );

    const body = (await res.json()) as {
      type: string;
      status: number;
      title: string;
    };

    expect(body.type).toBe("/problems/throne-unavailable");
    expect(body.status).toBe(503);
    expect(body.title).toBeTruthy(); // a human-readable RFC 9457 summary, never empty
  });

  it("rejects a non-GET request with 405 and an Allow: GET header", async () => {
    const store = inMemoryThroneStore();

    await enthrone(store, champion());

    const res = await handleKing(kingRequest("POST"), {
      store,
      version: VERSION,
    });

    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("GET");
    expect(res.headers.get("content-type")).toBe(
      "application/problem+json; charset=utf-8",
    );

    const body = (await res.json()) as { type: string; title: string };

    expect(body.type).toBe("/problems/method-not-allowed");
    expect(body.title).toBeTruthy(); // a human-readable RFC 9457 summary, never empty
  });

  it("caches a 200 read briefly but never caches a 503", async () => {
    const store = inMemoryThroneStore();

    await enthrone(store, champion());

    const ok = await handleKing(kingRequest(), { store, version: VERSION });

    expect(ok.headers.get("cache-control")).toBe("public, max-age=30");

    const down = await handleKing(kingRequest(), {
      store: failingStore(),
      version: VERSION,
    });

    expect(down.headers.get("cache-control")).toBeNull();
  });
});
