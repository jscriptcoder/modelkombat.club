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

// A store whose read always fails — models Upstash being unreachable (the real adapter
// THROWS on an error reply, never silently reads empty). Drives the 503 path (AC-K3).
const failingStore = (): ThroneStore => ({
  read: () => Promise.reject(new Error("upstash unreachable")),
  compareAndSwap: () => Promise.reject(new Error("unused in /king")),
});

type KingBody = {
  current: null | {
    name: string;
    model: string | null;
    handle: string | null;
    generation: number;
  };
};

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
