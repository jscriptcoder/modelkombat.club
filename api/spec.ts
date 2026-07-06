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
import { generateSpec } from "../src/cli/gen-spec.js";

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

    return new Response(generateSpec(), {
      status: 200,
      headers: { "content-type": "text/markdown; charset=utf-8" },
    });
  },
};
