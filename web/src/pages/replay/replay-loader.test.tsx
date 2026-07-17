import { describe, expect, it, vi } from "vitest";

import { loadById, loadReplay } from "./replay-loader";
import type { ReplayFrame, ReplayItem, ReplaySummary } from "./replay-contract";

// A 200 JSON response and a non-2xx response, standing in for the /replay endpoints. The loader is
// driven with an injected `fetch`, so no network — exactly how RingPage injects `postFight`.
const ok = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

const failure = (code: number): Response =>
  new Response(JSON.stringify({ title: "nope" }), {
    status: code,
    headers: { "content-type": "application/json" },
  });

const frame = (): ReplayFrame => ({
  x: 150_000,
  y: 0,
  facing: 1,
  posture: 0,
  attacking: false,
  attackBand: 0,
  guardBand: 0,
  throwing: false,
  knockdown: false,
  points: 0,
  stamina: 100,
});

const summary = (id: string): ReplaySummary => ({
  id,
  fighters: [
    { name: "challenger", model: "m" },
    { name: "king", model: "m" },
  ],
});

const item = (): ReplayItem => ({
  tape: [{ tick: 0, a: frame(), b: frame() }],
  fighters: [
    { name: "challenger", model: "m" },
    { name: "king", model: "m" },
  ],
});

describe("loadReplay — the two-step /replay fetch", () => {
  it("reports empty and does not fetch an item when the archive list is empty", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValueOnce(ok([]));

    const result = await loadReplay(fetchFn);

    expect(result).toEqual({ kind: "empty" });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("loads the newest (first-listed) fight's tape when the list is non-empty", async () => {
    const body = item();

    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(ok([summary("newest"), summary("older")]))
      .mockResolvedValueOnce(ok(body));

    const result = await loadReplay(fetchFn);

    expect(result).toEqual({ kind: "ready", item: body });
    // First the list endpoint, then the FIRST summary's id — the newest fight.
    expect(fetchFn).toHaveBeenNthCalledWith(1, "/replay");
    expect(fetchFn).toHaveBeenNthCalledWith(2, "/replay/newest");
  });

  it("throws when the list request is not ok (store unreachable → 503)", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValueOnce(failure(503));

    await expect(loadReplay(fetchFn)).rejects.toThrow();
  });

  it("throws when the item request is not ok (a transient 404 race)", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(ok([summary("gone")]))
      .mockResolvedValueOnce(failure(404));

    await expect(loadReplay(fetchFn)).rejects.toThrow();
  });
});

describe("loadById — the /replay/{id} permalink fetch", () => {
  it("returns the reconstructed fight for a resolvable id", async () => {
    const body = item();

    const fetchFn = vi.fn<typeof fetch>().mockResolvedValueOnce(ok(body));

    const result = await loadById("abc123", fetchFn);

    expect(result).toEqual({ kind: "found", item: body });
    expect(fetchFn).toHaveBeenCalledWith("/replay/abc123");
  });

  it("reports not-found (not an error) when the id 404s", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValueOnce(failure(404));

    const result = await loadById("gone", fetchFn);

    expect(result).toEqual({ kind: "not-found" });
  });

  it("throws on a transient failure so the page can offer retry (503)", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValueOnce(failure(503));

    await expect(loadById("abc123", fetchFn)).rejects.toThrow();
  });

  it("throws on a 500 — distinct from a 404 not-found", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValueOnce(failure(500));

    await expect(loadById("abc123", fetchFn)).rejects.toThrow();
  });
});
