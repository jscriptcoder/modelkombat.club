import { describe, expect, it } from "vitest";

import handler from "./replay.js";

// A request to the replay route. No body — it is a pure read. The list form has no `id`; the item
// form carries the content-hash id the rewrite forwards as `?id=`.
const replayRequest = (path: string, method = "GET"): Request =>
  new Request(`https://mk.example${path}`, { method });

// The wrapper wires the PRODUCTION deps (`selectThroneStore(process.env)` + `BENCHMARK_VERSION` +
// the frozen `CANONICAL_RULES` / `MAX_TICKS` / `MATCH`). With no Upstash env set (the test/preview
// default), the store is the per-instance in-memory fake — an untouched version has an empty
// archive — so a list read is `200 []`. The endpoint's shaping/error behaviour is exhaustively
// covered at the `handleReplay` seam; here we assert only that the wrapper is correctly wired.
describe("GET /replay — the endpoint wrapper", () => {
  it("lists the (empty) archive as a 200 [] on the default (in-memory) store", async () => {
    const res = await handler.fetch(replayRequest("/replay"));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(await res.json()).toEqual([]);
  });

  it("rejects a non-GET request with 405 and Allow: GET", async () => {
    const res = await handler.fetch(replayRequest("/replay", "POST"));

    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("GET");
  });
});
