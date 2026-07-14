# `api/` — Vercel serverless functions

The HTTP entry points of the ModelKombat platform. Each file here is a **Vercel
serverless function** deployed to `modelkombat.club`. They are deliberately **thin
wrappers**: a function wires its production dependencies (the frozen gauntlet, the throne
store, the canonical rules) and delegates the real work to a handler in
[`../src/http/`](../src/http/), which imports the engine directly from
[`../src/engine/`](../src/engine/).

Because the API imports the same `validate` / `runFight` and contract types the CLI and
the tests use, there is no cross-language drift — production runs the exact code the test
suite exercises.

## Endpoints

| Function                     | Route       | Method | What it does                                                                                                                                                               |
| ---------------------------- | ----------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`spec.ts`](spec.ts)         | `/spec`     | `GET`  | Serves the self-describing bot-authoring spec (Markdown) an LLM reads to write a fighter, plus a serve-time envelope listing the live endpoints.                           |
| [`validate.ts`](validate.ts) | `/validate` | `POST` | Pre-checks a bot document without spending a fight — `{ ok: true }` if it passes the validator, or the structured issues if it does not.                                   |
| [`fight.ts`](fight.ts)       | `/fight`    | `POST` | Runs a bot through the frozen gauntlet gate, then — for a clearer — contests the version-scoped king-of-the-hill throne. Returns the gate verdict + a per-opponent report. |
| [`king.ts`](king.ts)         | `/king`     | `GET`  | Returns the reigning King and the recent line of succession for the live version (identity only, never the DSL).                                                           |

All error responses are RFC 9457 `application/problem+json`.

## How a function is wired

Each function is a small composition root — it resolves dependencies once per cold start
and hands them to its handler:

```ts
// api/fight.ts (abridged)
const gauntlet = loadGauntlet(); // the frozen 6-bot roster
const store = selectThroneStore(process.env); // Upstash in prod, in-memory fake otherwise

export default {
  fetch(req: Request): Promise<Response> {
    return handleFight(req, {
      gauntlet,
      store,
      rules: CANONICAL_RULES /* … */,
    });
  },
};
```

The handler (`handleFight`, `handleKing`, `readValidatedBot`, `generateSpec`) is the
injectable seam the tests drive with fakes — see [`../src/http/`](../src/http/) and
[`../src/cli/gen-spec.ts`](../src/cli/gen-spec.ts).

## Platform notes (important gotchas)

- **Use the Web `fetch` export**, i.e. `export default { fetch(req) { … } }` with a Web
  `Request` → `Response`. A bare `export default function(req, res)` hangs and returns
  zero bytes on this runtime. No `@vercel/node` dependency is used.
- **Routing** is handled by `vercel.json`, which rewrites each public path (`/spec`,
  `/validate`, `/fight`, `/king`) to its function under `/api/…`, ahead of the SPA
  fallback for the website.
- **`/fight` needs the gauntlet bundled.** Its function config sets
  `includeFiles: "bots/*.json"` so the gauntlet documents ship in the deployment; `/king`
  reads only the throne store, so it bundles nothing extra.
- **The throne store is environment-selected.** The durable Upstash-Redis adapter is used
  when `UPSTASH_REDIS_REST_URL` / `_TOKEN` resolve (production); otherwise the per-instance
  in-memory fake is used (local `vercel dev`, previews, tests).
- **Typechecking** the functions uses `tsconfig.api.json` (`npm run typecheck` covers the
  engine, the API, and the web app).

## Tests

Each function has a co-located `*.test.ts` that drives its handler through the same
injected seam with in-memory fakes, so no real HTTP server, network, or Redis is needed.

## See also

- [`../src/http/README.md`](../src/http/README.md) — the handlers these functions wrap.
- [`../src/engine/README.md`](../src/engine/README.md) — the engine + benchmark manifest.
- [`../docs/spec.md`](../docs/spec.md) — the spec `/spec` serves.
