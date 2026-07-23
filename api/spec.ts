// The self-describing spec endpoint — `GET /spec`. A Vercel serverless function
// (Web-standard `fetch` handler, no `@vercel/node` runtime dep) that serves the
// engine's canonical bot-authoring spec verbatim. The API is pure transport over
// `generateSpec()` — no DSL op, no host/network/fs/time/random access beyond the
// generator's own committed-source reads (TCB unchanged).
//
// The `fetch` export (not a bare `export default function`) is the form the Vercel
// Node runtime invokes with a Web `Request` -> `Response`; it owns every method in
// one handler, so the non-GET 405 stays our RFC 9457 problem+json shape.
//
// Routing: `vercel.json` rewrites public `/spec` -> this function at `/api/spec`.
//
// The response is a LAYERED envelope: the canonical `generateSpec()` core served
// verbatim, then a serve-time **API envelope** telling the caller WHERE to act.
// The envelope carries the live deployment URL, so it is composed here at request
// time and kept OUT of the byte-hashed, drift-tested core (adding it to
// `generateSpec()` would fold a per-deployment URL into `docs/spec.md`/`INPUT_HASH`).
import { generateSpec } from "../src/cli/gen-spec.js";

// The live API surface, in one place. A later slice advertises its endpoint by
// adding a row here — never by editing prose — so the envelope can only ever list
// endpoints that actually exist (no dead URLs).
const LIVE_ENDPOINTS: readonly {
  method: string;
  path: string;
  summary: string;
}[] = [
  { method: "GET", path: "/spec", summary: "this self-describing spec" },
  {
    method: "POST",
    path: "/validate",
    summary:
      "pre-check a bot document; returns ok or the validator's structured issues",
  },
  {
    method: "POST",
    path: "/fight",
    summary:
      "fight a bot against the sitting champions and see where it lands in the arena — crowned, entered, or unplaced",
  },
  {
    method: "GET",
    path: "/king",
    summary:
      "the reigning King of the Hill and the recent line of succession for the live version; identity only, never the DSL",
  },
];

// The public origin to advertise. Behind Vercel's proxy the caller-facing host
// arrives in `x-forwarded-host` (the internal request URL is not public), so it
// wins; otherwise fall back to the request URL's own origin (local `vercel dev`
// and the pure-function tests).
const baseUrlOf = (req: Request): string => {
  const forwardedHost = req.headers.get("x-forwarded-host");

  if (forwardedHost) {
    const proto = req.headers.get("x-forwarded-proto") ?? "https";

    return `${proto}://${forwardedHost}`;
  }

  return new URL(req.url).origin;
};

const apiEnvelope = (baseUrl: string): string =>
  [
    "## API endpoints",
    "",
    "This spec is served live by the ModelKombat API. Currently available:",
    "",
    ...LIVE_ENDPOINTS.map(
      (e) => `- \`${e.method} ${baseUrl}${e.path}\` — ${e.summary}.`,
    ),
  ].join("\n");

export default {
  fetch(req: Request): Response {
    if (req.method !== "GET") {
      return new Response(
        JSON.stringify({
          type: "/problems/method-not-allowed",
          title: "Only GET is supported on /spec.",
          status: 405,
        }),
        {
          status: 405,
          headers: {
            "content-type": "application/problem+json; charset=utf-8",
            allow: "GET",
          },
        },
      );
    }

    const body = generateSpec() + "\n\n" + apiEnvelope(baseUrlOf(req));

    return new Response(body, {
      status: 200,
      headers: { "content-type": "text/markdown; charset=utf-8" },
    });
  },
};
