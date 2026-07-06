// The validator-gate endpoint — `POST /validate`. A Vercel serverless function
// (Web-standard `fetch` handler, no `@vercel/node` runtime dep) that lets an LLM
// author pre-check a bot document WITHOUT spending a fight: 200 `{ok:true}` if it
// passes the validator, or the validator's structured issues (RFC 9457
// problem+json) if it does not.
//
// All the request handling (method / size / parse / validate → problem+json or a
// validated BotDoc) lives in the shared `src/http/envelope.ts` — reused verbatim
// by `/fight`. This handler only maps the success case to `{ok:true}`. No DSL op;
// the TCB (invariant #2) is untouched.
//
// Routing: `vercel.json` rewrites public `/validate` -> this function at
// `/api/validate`.
import { readValidatedBot } from "../src/http/envelope.js";

export default {
  async fetch(req: Request): Promise<Response> {
    const parsed = await readValidatedBot(req, "/validate");

    if (parsed instanceof Response) return parsed;

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  },
};
