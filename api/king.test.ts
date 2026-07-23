import { describe, expect, it } from "vitest";

import handler from "./king.js";

// A request to the king route. No body — it is a pure read.
const kingRequest = (method: string): Request =>
  new Request("https://mk.example/king", { method });

// The wrapper wires the PRODUCTION deps (`selectThroneStore(process.env)` +
// `BENCHMARK_VERSION` + the House seed from `buildSeedArena(loadGauntlet())`). With no Upstash env
// set (the test/preview default), the store is the per-instance in-memory fake — empty on a cold
// start — so a GET reads the House seed (D5/D15), proving the seed docs are loaded + injected. The
// endpoint's shaping/error behaviour is exhaustively covered at the `handleKing` seam; here we
// assert only that the wrapper is correctly wired.
describe("GET /king — the endpoint wrapper", () => {
  it("reads the House seed as a 200 success on the default (empty in-memory) store", async () => {
    const res = await handler.fetch(kingRequest("GET"));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );

    const body = (await res.json()) as {
      current: { name: string; model: string | null; handle: string | null };
      recent: Array<{ name: string }>;
    };

    // Empty store → the seeded House board: grappler crowned, credited [Gauntlet] / model House.
    expect(body.current).toEqual({
      name: "grappler",
      model: "House",
      handle: "Gauntlet",
    });
    expect(body.recent.map((c) => c.name)).toEqual(["sweeper", "rekka"]);
  });

  it("rejects a non-GET request with 405 and Allow: GET", async () => {
    const res = await handler.fetch(kingRequest("POST"));

    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("GET");
  });
});
