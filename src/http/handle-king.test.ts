import { describe, expect, it } from "vitest";

import { handleKing } from "./handle-king.js";
import {
  inMemoryThroneStore,
  type ArenaMember,
  type ThroneStore,
} from "./throne-store.js";
import type { BotDoc } from "../engine/dsl.js";

// The version the /king read is scoped to (a test key — the real endpoint reads
// BENCHMARK_VERSION). An arena seated under a DIFFERENT version must read as empty.
const VERSION = "v-test";

// A champion whose document carries real `rules` (a DSL body). /king must surface the
// champion's IDENTITY only — the rules must never leak into the response, preserving the
// King's competitive edge (decision 5 / no-leak).
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

// Build one arena member from a name (+ optional handle / doc overrides). Every member's
// champion doc carries a real `rules` body, so each test also proves identity-only projection.
const arenaMember = (
  name: string,
  opts?: { handle?: string | null; seniority?: number; doc?: Partial<BotDoc> },
): ArenaMember => ({
  champion: champion({ name, ...opts?.doc }),
  handle: opts?.handle ?? null,
  seniority: opts?.seniority ?? 1,
});

// Seat a ranked arena under a version (members already in rank order, `[0]` = King). Uses the
// arena commit path — the single source of truth /king reads.
const seatArena = (
  store: ThroneStore,
  members: ArenaMember[],
  version = VERSION,
): Promise<unknown> =>
  store.commitArena(version, null, {
    members,
    generation: 1,
    nextSeniority: members.length + 1,
  });

// A store whose arena read fails — models Upstash being unreachable (the real adapter THROWS
// on an error reply, never silently reads empty). Drives the 503 path.
const failingStore = (): ThroneStore => ({
  readArena: () => Promise.reject(new Error("upstash unreachable")),
  readArchive: () => Promise.reject(new Error("unused in /king")),
  commitArena: () => Promise.reject(new Error("unused in /king")),
});

type Champion = { name: string; model: string | null; handle: string | null };

type KingBody = {
  current: null | Champion;
  recent: Champion[];
};

// The public identity fields — no `generation` (the throne CAS token left the contract in S3).
const IDENTITY_KEYS = ["handle", "model", "name"] as const;

describe("GET /king — the version-scoped ranked-arena read", () => {
  it("returns the King's identity (name, model, handle) — and no generation", async () => {
    const store = inMemoryThroneStore();

    await seatArena(store, [
      arenaMember("reigning-king", { handle: "grandmaster" }),
    ]);

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
    });
    // The throne CAS token must NOT leak into the public read (dropped in S3).
    expect(body.current).not.toHaveProperty("generation");
  });

  it("projects current = King (arena #1) and recent = defenders (arena #2..N) in RANK order", async () => {
    const store = inMemoryThroneStore();

    await seatArena(store, [
      arenaMember("king", { handle: "a", seniority: 1 }),
      arenaMember("silver", { handle: "b", seniority: 2 }),
      arenaMember("bronze", { handle: "c", seniority: 3 }),
    ]);

    const res = await handleKing(kingRequest(), { store, version: VERSION });
    const body = (await res.json()) as KingBody;

    // current is arena #1 — not a defender (kills a members[1]-as-current mutant).
    expect(body.current?.name).toBe("king");
    // recent is the defenders below the King, in arena RANK order (not reversed, not time order).
    expect(body.recent.map((c) => c.name)).toEqual(["silver", "bronze"]);
    // the King never appears among the defenders (recent = slice(1), not slice(0)).
    expect(body.recent.map((c) => c.name)).not.toContain("king");
  });

  it("returns an empty recent when the arena holds only the King", async () => {
    const store = inMemoryThroneStore();

    await seatArena(store, [arenaMember("lonely-king")]);

    const res = await handleKing(kingRequest(), { store, version: VERSION });
    const body = (await res.json()) as KingBody;

    expect(body.current?.name).toBe("lonely-king");
    expect(body.recent).toEqual([]);
  });

  it("never leaks the champion's DSL/rules into the response", async () => {
    const store = inMemoryThroneStore();

    await seatArena(store, [arenaMember("reigning-king")]);

    const res = await handleKing(kingRequest(), { store, version: VERSION });
    const body = (await res.json()) as KingBody;

    // Exactly the three identity fields — no `rules`, no `version`, no `default`, no `generation`.
    expect(Object.keys(body.current ?? {}).sort()).toEqual([...IDENTITY_KEYS]);

    // Defense in depth: no DSL token survives anywhere in the serialized payload.
    const raw = JSON.stringify(body);

    expect(raw).not.toContain("rules");
    expect(raw).not.toContain("canAct");
    expect(raw).not.toContain("default");
  });

  it("every recent entry is identity-only and carries no generation", async () => {
    const store = inMemoryThroneStore();

    await seatArena(store, [arenaMember("king"), arenaMember("challenger")]);

    const res = await handleKing(kingRequest(), { store, version: VERSION });
    const body = (await res.json()) as KingBody;

    expect(body.recent).toHaveLength(1);
    body.recent.forEach((entry) => {
      expect(Object.keys(entry).sort()).toEqual([...IDENTITY_KEYS]);
      expect(entry).not.toHaveProperty("generation");
    });

    const rawRecent = JSON.stringify(body.recent);

    expect(rawRecent).not.toContain("rules");
    expect(rawRecent).not.toContain("canAct");
    expect(rawRecent).not.toContain("default");
  });

  it("defaults an absent model and handle to null (not omitted, not 'undefined')", async () => {
    const store = inMemoryThroneStore();

    // A champion doc with no `model`, seated with no `handle`.
    await seatArena(store, [
      arenaMember("k", { handle: null, doc: { model: undefined } }),
    ]);

    const res = await handleKing(kingRequest(), { store, version: VERSION });
    const body = (await res.json()) as KingBody;

    expect(body.current?.model).toBeNull();
    expect(body.current?.handle).toBeNull();
  });

  it("reads empty for a version with no arena (a success, not an error)", async () => {
    const store = inMemoryThroneStore();

    // Seat an arena under a DIFFERENT version — the scoped read must still be empty.
    await seatArena(store, [arenaMember("elsewhere")], "other-version");

    const res = await handleKing(kingRequest(), { store, version: VERSION });

    expect(res.status).toBe(200);

    const body = (await res.json()) as KingBody;

    expect(body.current).toBeNull();
    expect(body.recent).toEqual([]);
  });

  it("reads empty current + empty recent when no champion has been crowned", async () => {
    const store = inMemoryThroneStore();

    const res = await handleKing(kingRequest(), { store, version: VERSION });
    const body = (await res.json()) as KingBody;

    expect(body.current).toBeNull();
    expect(body.recent).toEqual([]);
  });

  it("strips control characters from identity strings for current and every recent entry", async () => {
    const store = inMemoryThroneStore();

    // Two members whose name/model/handle carry C0 + DEL control characters. Boundary
    // coverage: 0x1F is stripped while the adjacent 0x20 space survives; 0x7F (DEL) is
    // stripped while the adjacent 0x7E "~" survives — pinning both edges of the strip range.
    await seatArena(store, [
      arenaMember(`new~${ctrl(0x7f)}king`, {
        handle: `he${ctrl(0x02)}ir`, // -> "heir"
        doc: { model: `opus${ctrl(0x1f)}x` }, // -> "opusx"
      }),
      arenaMember(`ka${ctrl(0x00)}ta ${ctrl(0x1f)}master`, {
        handle: `gr${ctrl(0x01)}and`, // -> "grand"
        doc: { model: `claude${ctrl(0x07)}opus` }, // -> "claudeopus"
      }),
    ]);

    const res = await handleKing(kingRequest(), { store, version: VERSION });
    const body = (await res.json()) as KingBody;

    // The King (arena #1) is sanitized...
    expect(body.current).toEqual({
      name: "new~king",
      model: "opusx",
      handle: "heir",
    });
    // ...and so is the defender (every entry, not just current).
    expect(body.recent[0]).toEqual({
      name: "kata master",
      model: "claudeopus",
      handle: "grand",
    });
  });

  it("leaves ordinary and markup-bearing identity strings unchanged", async () => {
    const store = inMemoryThroneStore();

    // Spaces (0x20), `<`, `>`, `(` are all printable (≥ 0x20) — sanitization must not touch
    // them, so the auto-escaping behavior (inert markup) is preserved. The embedded spaces
    // also pin the top edge of the strip range (0x20 must survive).
    await seatArena(store, [
      arenaMember("Grand Master <script>alert(1)</script>", {
        handle: "kata-master",
        doc: { model: "claude-opus-4-8" },
      }),
    ]);

    const res = await handleKing(kingRequest(), { store, version: VERSION });
    const body = (await res.json()) as KingBody;

    expect(body.current).toEqual({
      name: "Grand Master <script>alert(1)</script>",
      model: "claude-opus-4-8",
      handle: "kata-master",
    });
  });

  it("returns 503 problem+json when the arena store is unreachable", async () => {
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

    await seatArena(store, [arenaMember("king")]);

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

    await seatArena(store, [arenaMember("king")]);

    const ok = await handleKing(kingRequest(), { store, version: VERSION });

    expect(ok.headers.get("cache-control")).toBe("public, max-age=30");

    const down = await handleKing(kingRequest(), {
      store: failingStore(),
      version: VERSION,
    });

    expect(down.headers.get("cache-control")).toBeNull();
  });
});
