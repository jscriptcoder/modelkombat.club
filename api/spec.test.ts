import { describe, expect, it } from "vitest";

import handler from "./spec.js";
import { generateSpec } from "../src/cli/gen-spec.js";

// A request to the spec route. `url` varies the host so the serve-time envelope's
// absolute-URL derivation can be exercised; `headers` lets a test set the Vercel
// proxy's `x-forwarded-*` (the production host source).
const specRequest = (
  method: string,
  url = "https://mk.example/spec",
  headers?: Record<string, string>,
): Request => new Request(url, { method, headers });

// The appended API-envelope block — from its `## API endpoints` heading to the
// end of the served body (the envelope is the last thing the handler appends).
const envelopeOf = (body: string): string => {
  const i = body.indexOf("## API endpoints");

  return i < 0 ? "" : body.slice(i);
};

describe("GET /spec — the self-describing spec endpoint", () => {
  it("serves the canonical spec as markdown on GET", async () => {
    const res = handler.fetch(specRequest("GET"));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(
      "text/markdown; charset=utf-8",
    );
    // the canonical generator output is served verbatim as the body's PREFIX —
    // the handler does not re-render or truncate it; the serve-time API envelope
    // is layered on AFTER the core (asserted in its own describe below)
    expect((await res.text()).startsWith(generateSpec())).toBe(true);
  });

  it("rejects a non-GET method with an RFC 9457 405 problem+json", async () => {
    const res = handler.fetch(specRequest("POST"));

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

describe("GET /spec — the serve-time API envelope (where to act)", () => {
  const bodyFor = async (
    url?: string,
    headers?: Record<string, string>,
  ): Promise<string> => handler.fetch(specRequest("GET", url, headers)).text();

  it("appends the exact API-endpoints envelope after the core, separated by a blank line", async () => {
    // a byte-exact pin of the serve-time envelope (the handler has no drift test),
    // for the fallback host source (request URL). Proves the layout, the prose, the
    // bullet template, and the `\n\n` core/envelope separator all at once.
    const expectedEnvelope = [
      "## API endpoints",
      "",
      "This spec is served live by the ModelKombat API. Currently available:",
      "",
      "- `GET https://a.example/spec` — this self-describing spec.",
    ].join("\n");

    const body = await bodyFor("https://a.example/spec");

    expect(body).toBe(generateSpec() + "\n\n" + expectedEnvelope);
  });

  it("derives the host per request — a different host yields a different absolute URL", async () => {
    expect(envelopeOf(await bodyFor("https://a.example/spec"))).toContain(
      "https://a.example/spec",
    );
    expect(envelopeOf(await bodyFor("https://b.example/spec"))).toContain(
      "https://b.example/spec",
    );
  });

  it("prefers the Vercel proxy's x-forwarded-host, defaulting the scheme to https", async () => {
    const envelope = envelopeOf(
      await bodyFor("http://internal.vercel.app/api/spec", {
        "x-forwarded-host": "modelkombat.club",
      }),
    );

    // the forwarded host wins over the internal request URL, and with no
    // x-forwarded-proto the advertised scheme defaults to https (not the
    // internal request's http)
    expect(envelope).toContain("https://modelkombat.club/spec");
    expect(envelope).not.toContain("internal.vercel.app"); // the internal host never leaks
  });

  it("honors x-forwarded-proto for the advertised scheme", async () => {
    const envelope = envelopeOf(
      await bodyFor("https://internal.vercel.app/api/spec", {
        "x-forwarded-host": "modelkombat.club",
        "x-forwarded-proto": "http",
      }),
    );

    // the scheme is read from the forwarded header, not defaulted/hardcoded
    expect(envelope).toContain("http://modelkombat.club/spec");
    expect(envelope).not.toContain("https://modelkombat.club/spec");
  });

  it("lists EXACTLY the live endpoints — one entry, and advertises no unbuilt endpoint", async () => {
    const envelope = envelopeOf(await bodyFor("https://a.example/spec"));
    const bullets = envelope.split("\n").filter((l) => l.startsWith("- "));

    expect(bullets).toHaveLength(1); // only GET /spec is live at S1
    // no dead URLs for endpoints that don't exist yet
    expect(envelope).not.toContain("/validate");
    expect(envelope).not.toContain("/fight");
  });

  it("is layered at serve time — NOT baked into the hashed, drift-tested core spec", () => {
    const core = generateSpec();
    // the envelope heading and any absolute URL live only in the handler's
    // response, never in generateSpec() (so docs/spec.md + INPUT_HASH are untouched)
    expect(core).not.toContain("## API endpoints");
    expect(core).not.toContain("https://a.example/spec");
  });
});
