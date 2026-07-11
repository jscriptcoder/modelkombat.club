import { describe, expect, it, vi } from "vitest";

import {
  selectThroneStore,
  type ThroneStoreEnv,
} from "./throne-store-select.js";

// Both concrete stores now share one 2-method port shape, so discriminate WHICH was selected by
// BEHAVIOR, not shape: the in-memory fake serves reads from memory and never touches the network,
// while the durable Upstash adapter POSTs to the REST API. Stub fetch FIRST (the adapter binds the
// global `fetch` at construction), select, read once, and report whether the network stayed
// untouched — the adapter's own behavior is covered by throne-store-upstash.test.ts.
const selectsFake = async (env: ThroneStoreEnv): Promise<boolean> => {
  const fetchMock = vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify({ result: null }), { status: 200 }),
    ),
  );

  vi.stubGlobal("fetch", fetchMock);

  try {
    await selectThroneStore(env).readArena("probe");

    return fetchMock.mock.calls.length === 0;
  } finally {
    vi.unstubAllGlobals();
  }
};

describe("selectThroneStore — durable store when configured, else the in-memory fake", () => {
  it("uses the fake when no Upstash config is present", async () => {
    expect(await selectsFake({})).toBe(true);
  });

  it("uses the fake when only the URL is set (partial config never half-configures)", async () => {
    expect(await selectsFake({ UPSTASH_REDIS_REST_URL: "https://x" })).toBe(
      true,
    );
  });

  it("uses the fake when only the token is set", async () => {
    expect(await selectsFake({ UPSTASH_REDIS_REST_TOKEN: "t" })).toBe(true);
  });

  it("uses the fake when a var is present but empty", async () => {
    expect(
      await selectsFake({
        UPSTASH_REDIS_REST_URL: "",
        UPSTASH_REDIS_REST_TOKEN: "t",
      }),
    ).toBe(true);
  });

  it("selects the durable Upstash adapter, wired to the configured URL", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ result: null }), { status: 200 }),
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    try {
      const store = selectThroneStore({
        UPSTASH_REDIS_REST_URL: "https://x.upstash.io",
        UPSTASH_REDIS_REST_TOKEN: "t",
      });

      // Reading it hits the CONFIGURED url — proving `{ url, token }` threaded through (not an
      // empty config, which would POST to `undefined`) and that it is NOT the fake (which never
      // touches the network).
      await store.readArena("v19");
      expect(fetchMock).toHaveBeenCalledWith(
        "https://x.upstash.io",
        expect.anything(),
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("selects the durable adapter via the Vercel Marketplace prefixed names", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ result: null }), { status: 200 }),
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    try {
      // The names the Upstash Marketplace integration actually injects (chosen prefix
      // `UPSTASH_REDIS_REST` + the classic KV suffixes) — no canonical names present.
      const store = selectThroneStore({
        UPSTASH_REDIS_REST_KV_REST_API_URL: "https://prefixed.upstash.io",
        UPSTASH_REDIS_REST_KV_REST_API_TOKEN: "t",
      });

      await store.readArena("v19");
      expect(fetchMock).toHaveBeenCalledWith(
        "https://prefixed.upstash.io",
        expect.anything(),
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("selects the durable adapter via the default Vercel-KV names", async () => {
    // What a default-prefix re-provision would inject — no canonical or Marketplace-prefixed names.
    expect(
      await selectsFake({
        KV_REST_API_URL: "https://kv.upstash.io",
        KV_REST_API_TOKEN: "t",
      }),
    ).toBe(false);
  });

  it("prefers an explicit canonical URL over a lower-priority injected name", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ result: null }), { status: 200 }),
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    try {
      // Both a canonical URL and the prefixed injected URL are present — the explicit
      // canonical one must win, so a local override always beats the auto-injected value.
      const store = selectThroneStore({
        UPSTASH_REDIS_REST_URL: "https://canonical.upstash.io",
        UPSTASH_REDIS_REST_KV_REST_API_URL: "https://prefixed.upstash.io",
        UPSTASH_REDIS_REST_TOKEN: "t",
      });

      await store.readArena("v19");
      expect(fetchMock).toHaveBeenCalledWith(
        "https://canonical.upstash.io",
        expect.anything(),
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
