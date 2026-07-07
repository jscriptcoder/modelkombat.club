import { describe, expect, it } from "vitest";

import handler from "./king.js";

// A request to the king route. No body — it is a pure read.
const kingRequest = (method: string): Request =>
  new Request("https://mk.example/king", { method });

// The wrapper wires the PRODUCTION deps (`selectThroneStore(process.env)` +
// `BENCHMARK_VERSION`). With no Upstash env set (the test/preview default), the store is
// the per-instance in-memory fake — empty on a cold start — so a GET reads an open
// throne. The endpoint's shaping/error behaviour is exhaustively covered at the
// `handleKing` seam; here we assert only that the wrapper is correctly wired.
describe("GET /king — the endpoint wrapper", () => {
  it("reads the (empty) throne as a 200 success on the default (in-memory) store", async () => {
    const res = await handler.fetch(kingRequest("GET"));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );

    const body = (await res.json()) as { current: unknown };

    expect(body.current).toBeNull();
  });

  it("rejects a non-GET request with 405 and Allow: GET", async () => {
    const res = await handler.fetch(kingRequest("POST"));

    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("GET");
  });
});
