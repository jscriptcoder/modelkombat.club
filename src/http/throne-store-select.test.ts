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
});
