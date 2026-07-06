// The self-describing spec endpoint — `GET /spec`. A Vercel serverless function
// (Web-standard `Request` -> `Response`, no `@vercel/node` runtime dep) that
// serves the engine's canonical bot-authoring spec verbatim. The API is pure
// transport over `generateSpec()` — no DSL op, no host/network/fs/time/random
// access beyond the generator's own committed-source reads (TCB unchanged).
//
// Routing: `vercel.json` rewrites public `/spec` -> this function at `/api/spec`.
import { generateSpec } from "../src/cli/gen-spec.js";

export default function handler(req: Request): Response {
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
}
