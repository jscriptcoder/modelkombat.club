/// <reference types="node" />
// The shared RFC 9457 request envelope for the POST bot-authoring endpoints
// (`/validate`, `/fight`). Extracted from the S2 `/validate` handler now that a
// second handler needs it verbatim (the DRY-by-knowledge trigger S2 deferred). It
// lives under `src/` — NOT `api/` — because Vercel routes every `api/*.ts` as an
// endpoint, so a shared module cannot live there.
//
// Pure transport over the engine's TCB gate: `safeParse` (prototype-pollution-safe
// intake) + `validate` (the allowlist validator) composed DIRECTLY — not
// `parseBotDoc`, which flattens every failure into one issue list and so can't
// drive per-failure HTTP status. No DSL op, no host/network/fs/time/random access;
// the TCB (invariant #2) is untouched.
import {
  LIMITS,
  safeParse,
  validate,
  ValidationError,
  type BotDoc,
} from "../engine/dsl.js";

// One RFC 9457 `application/problem+json` response. `extra` carries extension
// members (e.g. the validator's `errors`); `headers` carries method-negotiation
// headers (e.g. `Allow`).
export const problem = (
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

// POST-only bot intake shared by `/validate` and `/fight`: method → size → parse
// → validate. Returns EITHER a problem+json `Response` (the caller returns it as
// is) OR the validated `BotDoc` (the caller proceeds). `route` names the endpoint
// in the 405 message. Parse-first: no content-type gate — real clients label JSON
// bodies `text/plain` / form-urlencoded, so a valid body is accepted on its merits.
export const readValidatedBot = async (
  req: Request,
  route: string,
): Promise<Response | { doc: BotDoc }> => {
  if (req.method !== "POST") {
    return problem(
      405,
      "/problems/method-not-allowed",
      `Only POST is supported on ${route}.`,
      undefined,
      { allow: "POST" },
    );
  }

  const text = await req.text();

  // Surface the engine's size bound (`safeParse` would otherwise throw it as a
  // generic invalid-bot) as a precise 413, so an over-cap caller knows to shrink
  // the document. Same predicate + constant the engine uses at `dsl.ts` — one
  // boundary, not a second magic number.
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

  // Justified assertion: `validate` returning ok is exactly the guarantee that
  // `doc` matches the BotDoc shape — the same precedent as `load.ts`'s parseBotDoc.
  return { doc: doc as BotDoc };
};
