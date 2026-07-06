// The validator-gate endpoint — `POST /validate`. A Vercel serverless function
// (Web-standard `fetch` handler, no `@vercel/node` runtime dep) that lets an LLM
// author pre-check a bot document WITHOUT spending a fight: 200 `{ok:true}` if it
// passes the validator, or the validator's structured issues (RFC 9457
// problem+json) if it does not.
//
// The API is pure transport over the engine's TCB gate: it composes `safeParse`
// (prototype-pollution-safe intake) + `validate` (the allowlist validator)
// DIRECTLY — not `parseBotDoc`, which flattens every failure into one issue list
// and so can't drive per-failure HTTP status. No DSL op, no host/network/fs/time/
// random access; the TCB (invariant #2) is untouched.
//
// Routing: `vercel.json` rewrites public `/validate` -> this function at
// `/api/validate`.
import {
  LIMITS,
  safeParse,
  validate,
  ValidationError,
} from "../src/engine/dsl.js";

// One RFC 9457 `application/problem+json` response. `extra` carries extension
// members (e.g. the validator's `errors`); `headers` carries method-negotiation
// headers (e.g. `Allow`). Kept LOCAL to this handler for now — the shared-helper
// extraction trigger is S3's third handler (and a shared module must live outside
// `api/`, since Vercel routes every `api/*.ts`).
const problem = (
  status: number,
  type: string,
  title: string,
  extra?: Record<string, unknown>,
  headers?: Record<string, string>,
): Response =>
  new Response(JSON.stringify({ type, title, status, ...extra }), {
    status,
    headers: {
      "content-type": "application/problem+json; charset=utf-8",
      ...headers,
    },
  });

const INVALID_BOT_TITLE = "The bot document failed validation.";

export default {
  async fetch(req: Request): Promise<Response> {
    if (req.method !== "POST") {
      return problem(
        405,
        "/problems/method-not-allowed",
        "Only POST is supported on /validate.",
        undefined,
        { allow: "POST" },
      );
    }

    const text = await req.text();

    // Surface the engine's size bound (`safeParse` would otherwise throw it as a
    // generic invalid-bot) as a precise 413, so an over-cap caller knows to shrink
    // the document. Same predicate + constant the engine uses at `dsl.ts` — one
    // boundary, not a second magic number. No content-type gate (parse-first):
    // real clients label JSON bodies `text/plain` / form-urlencoded, so a valid
    // body is accepted on its merits regardless of declared type.
    if (text.length > LIMITS.maxBytes) {
      return problem(
        413,
        "/problems/payload-too-large",
        "The bot document exceeds the maximum size.",
      );
    }

    let doc: unknown;

    try {
      doc = safeParse(text);
    } catch (e) {
      // `safeParse` throws a ValidationError for a forbidden key (a rejected bot);
      // anything else is a JSON.parse SyntaxError (an unparseable request body).
      if (e instanceof ValidationError) {
        return problem(422, "/problems/invalid-bot", INVALID_BOT_TITLE, {
          errors: e.issues,
        });
      }

      return problem(
        400,
        "/problems/malformed-request",
        "The request body is not valid JSON.",
      );
    }

    const result = validate(doc);

    if (!result.ok) {
      return problem(422, "/problems/invalid-bot", INVALID_BOT_TITLE, {
        errors: result.issues,
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  },
};
