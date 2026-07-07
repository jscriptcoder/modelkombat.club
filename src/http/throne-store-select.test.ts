import { describe, expect, it, vi } from "vitest";

import { selectThroneStore } from "./throne-store-select.js";

// The fake (in-memory) exposes `lineage()` for test introspection; the durable Upstash adapter
// does not. So `"lineage" in store` cleanly discriminates WHICH store was selected — without
// touching the network (the adapter's own behavior is covered by throne-store-upstash.test.ts).
const isFake = (store: object): boolean => "lineage" in store;

describe("selectThroneStore — durable store when configured, else the in-memory fake", () => {
  it("uses the fake when no Upstash config is present", () => {
    expect(isFake(selectThroneStore({}))).toBe(true);
  });

  it("uses the fake when only the URL is set (partial config never half-configures)", () => {
    expect(
      isFake(selectThroneStore({ UPSTASH_REDIS_REST_URL: "https://x" })),
    ).toBe(true);
  });

  it("uses the fake when only the token is set", () => {
    expect(isFake(selectThroneStore({ UPSTASH_REDIS_REST_TOKEN: "t" }))).toBe(
      true,
    );
  });

  it("uses the fake when a var is present but empty", () => {
    expect(
      isFake(
        selectThroneStore({
          UPSTASH_REDIS_REST_URL: "",
          UPSTASH_REDIS_REST_TOKEN: "t",
        }),
      ),
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

      // Not the fake (the fake never touches the network) ...
      expect(isFake(store)).toBe(false);

      // ... and reading it hits the CONFIGURED url — proving `{ url, token }` threaded through
      // (not an empty config, which would POST to `undefined`).
      await store.read("v19");
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

      expect(isFake(store)).toBe(false);

      await store.read("v19");
      expect(fetchMock).toHaveBeenCalledWith(
        "https://prefixed.upstash.io",
        expect.anything(),
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("selects the durable adapter via the default Vercel-KV names", () => {
    // What a default-prefix re-provision would inject.
    expect(
      isFake(
        selectThroneStore({
          KV_REST_API_URL: "https://kv.upstash.io",
          KV_REST_API_TOKEN: "t",
        }),
      ),
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

      await store.read("v19");
      expect(fetchMock).toHaveBeenCalledWith(
        "https://canonical.upstash.io",
        expect.anything(),
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
