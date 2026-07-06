import { describe, expect, it } from "vitest";

import handler from "./spec.js";
import { generateSpec } from "../src/cli/gen-spec.js";

// A GET/POST/etc. request to the spec route. Host is arbitrary — Slice 1 serves
// the canonical spec verbatim and never reads the URL (the serve-time API
// envelope that derives an absolute URL from the host arrives in Slice 3).
const specRequest = (method: string): Request =>
  new Request("https://mk.example/spec", { method });

describe("GET /spec — the self-describing spec endpoint", () => {
  it("serves the canonical spec as markdown on GET", async () => {
    const res = handler(specRequest("GET"));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(
      "text/markdown; charset=utf-8",
    );
    // byte-identical to the engine's own generator — the handler serves the
    // canonical spec, it does not re-render or truncate it
    expect(await res.text()).toBe(generateSpec());
  });

  it("rejects a non-GET method with an RFC 9457 405 problem+json", async () => {
    const res = handler(specRequest("POST"));

    expect(res.status).toBe(405);
    expect(res.headers.get("content-type")).toBe(
      "application/problem+json; charset=utf-8",
    );
    // the RFC 7231 method-negotiation header names the one allowed method
    expect(res.headers.get("allow")).toBe("GET");

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.type).toBe("/problems/method-not-allowed");
    expect(body.status).toBe(405);
    expect(body.title).toBeTruthy();
  });
});
