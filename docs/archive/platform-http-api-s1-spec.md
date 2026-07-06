# Plan: Platform HTTP API — S1 (`GET /spec`)

**Branch**: `feat/platform-api-s1-spec`
**Status**: Active

Source of truth: `plans/platform-http-api-decisions.md` (resolved decisions + API response
contract) and `plans/platform-http-api-stories.md` (S1 row + gaps-closed log). This plan
sequences **S1 only** — the deployment walking skeleton + the self-describing spec + the
`model` engine precursor. S2 (`POST /validate`), S3 (`POST /fight` gauntlet gate), and S4
(the throne) are separate stories, not planned here.

## Goal

An LLM author, handed one URL, can `GET /spec` from the deployed API and author a
validator-passing bot from it — proving the greenfield Vercel deployment path (serverless
function importing the engine from `src/` under NodeNext ESM) end-to-end.

## Acceptance Criteria

- [ ] `GET /spec` on the deployed API returns 200 `text/markdown` whose body is the
      authoring spec (DSL grammar + JSON Schema + frame table + win condition + strategy
      primer + the new game-overview intro).
- [ ] The response carries a **serve-time API envelope** that lists **only live
      endpoints** (at S1: just `GET /spec`) with absolute URLs derived from the request —
      **no dead/unbuilt URLs advertised**.
- [ ] The core-spec changes (game intro) regenerate `docs/spec.md`, keep the byte-for-byte
      **drift test green**, and leave `INPUT_HASH` **and** `BENCHMARK_VERSION` unchanged.
- [ ] A bot declaring `model` (e.g. `"Claude Opus 4.8"` / `"human"`) validates; the field
      is **optional** (absent ⇒ byte-identical parse/interpret) and **never affects a
      fight** (the interpreter never reads it); the 6 frozen gauntlet files stay without it.
- [ ] Every error path on the route is **RFC 9457** `application/problem+json` per the
      status table in the decisions doc (at S1: wrong method → 405 `/problems/method-not-allowed`).
- [ ] Demonstrable loop quality: an LLM (or the offline dogfood) given only the `/spec` URL
      authors a validator-passing bot on the first try.

## Deployment & tooling notes (Slice 1 resolves these; named here so they don't surprise us)

- **Greenfield.** No `vercel.json`, no `api/`, no runtime deps today. `tsconfig.json` is
  `rootDir:"src"`, `include:["src"]` — so a repo-root `api/` function is **not** covered by
  `npm run typecheck`. Slice 1 adds coverage (a dedicated `tsconfig.api.json` extending the
  base with `include:["api"]`, `noEmit`, wired into the `typecheck` script) rather than
  perturbing the engine build (`tsconfig.build.json` → `dist/`). `eslint .` and
  `prettier .` already cover `api/`.
- **Routing.** Vercel file routing maps `api/spec.ts` → `/api/spec`; we want clean `/spec`.
  Resolve via a `vercel.json` rewrite (`/spec` → `/api/spec`) — confirm exact form against
  current Vercel docs during Slice 1.
- **Handler signature.** Prefer the **Web-standard** `(req: Request) => Response |
Promise<Response>` default export (typed by `@types/node` globals, ideal for pure-function
  tests — construct a `Request`, assert the `Response`). Confirm current Vercel Node-runtime
  support for Web-standard handlers before writing the RED test; fall back to the
  `(req, res)` signature only if required.
- **Dependency posture.** `@vercel/node` — if needed at all — is a **devDependency only**
  (types + local `vercel dev`); the runtime is platform-provided, so the "no runtime deps"
  invariant holds and the `src/engine` import path stays dep-free. Confirm whether it's
  needed during Slice 1.
- **Vercel project link** (one-time prerequisite inside Slice 1): the repo must be linked to
  a Vercel project to deploy + run the post-deploy smoke test. The Vercel MCP tools
  (`deploy_to_vercel`, `get_deployment`, `search_vercel_documentation`) and the
  `vercel:deployment-expert` agent are available; an interactive `vercel login` (if needed)
  is run by the user via `! vercel login`.
- **TCB untouched** across all of S1: no DSL op touches host/network/fs/time/randomness; the
  API is transport over the canonical `generateSpec`/`validate` (invariants #1, #2).

## Slices

Every slice follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR. No production code without a
failing test. Before code changes in **each** slice, load `tdd`, `testing`,
`mutation-testing`, and `refactoring`.

Slices 2 and 4 are pure engine/spec changes with **no deployment dependency** — if Vercel
project linking needs lead time, they may be reordered ahead of Slice 1 without loss.

### Slice 1: `GET /spec` is live — the deployment walking skeleton

**Value**: LLM author + platform operator — one deployed URL returns the authoring spec,
proving a Vercel serverless function can import the engine from `src/` (NodeNext ESM) and
deploy. Retires the single biggest S1 unknown (integration) at the lowest feature cost.
**Path**: `GET /spec` → Vercel function `api/spec.ts` → imports `generateSpec()` from
`src/cli/gen-spec.js` → returns `200 text/markdown` with the current spec body. Wrong method
→ `405 application/problem+json`. Observability: Vercel function logs
`{ endpoint:"/spec", status, latency }`. _Skipped in this slice:_ the game-intro narrative
(Slice 2), the API envelope (Slice 3), the `model` field (Slice 4).
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`;
optionally the `vercel:deployment-expert` agent + Vercel MCP doc search to confirm handler
signature / routing.
**Acceptance criteria** (confirm with human before coding):

- Pure-function handler test: construct `new Request("https://host/spec", {method:"GET"})`,
  invoke the handler, assert `res.status === 200`, `Content-Type` is
  `text/markdown; charset=utf-8`, and the body **equals `generateSpec()`** (byte-identical —
  the handler serves the canonical spec, it does not re-render).
- `POST /spec` (or any non-GET) → `405` `application/problem+json` with
  `type:"/problems/method-not-allowed"`, `title`, `status:405`, and an `Allow: GET` header.
- Deployed: `curl https://<deployment>/spec` returns 200 and the body contains the spec
  header line `# ModelKombat — Bot authoring spec` and the current `BENCHMARK_VERSION`.
- `npm run typecheck` (base **and** `tsconfig.api.json`), `lint`, `format:check`, and the
  full `test` suite pass.
  **RED**: `api/spec.test.ts` — the GET-returns-200-markdown-equals-generateSpec test, plus
  the non-GET-405-problem+json test. Both fail (no `api/spec.ts` yet). Likely mutator gaps to
  pre-empt: the status literals (`200`/`405` — assert both exact), the method-equality check
  (`=== "GET"` vs negation — the 405 test with an explicit non-GET kills the flip), the
  `Content-Type` string (assert exact), the `Allow` header value.
  **GREEN**: minimal `api/spec.ts` default handler: if method ≠ GET → problem+json 405; else
  `new Response(generateSpec(), { status:200, headers:{ "content-type":"text/markdown; charset=utf-8" } })`.
  Add `vercel.json` (`/spec` rewrite) + `tsconfig.api.json` + wire `typecheck`.
  **MUTATE**: run `mutation-testing` on `api/spec.ts` — verify status codes, the method guard,
  and header strings are all killed.
  **KILL MUTANTS**: strengthen the handler tests for any survivor (e.g. a header-string
  mutant → assert the exact `Content-Type`).
  **REFACTOR**: assess extracting a tiny shared `problem(type,title,status,extra?)` helper for
  RFC 9457 responses (it will be reused by every later endpoint) — only if it reads cleaner now.
  **Done when**: all ACs met; deployed to a Vercel URL; post-deploy smoke `curl` passes;
  mutation report reviewed; human approves commit.

### Slice 2: the core spec teaches "what this game is"

**Value**: LLM author (online **and** offline) — the spec self-describes the game before the
DSL mechanics, so a cold model understands the domain it's authoring for. Served
automatically by `GET /spec` (Slice 1 returns `generateSpec()` verbatim).
**Path**: add a **version-neutral** game-overview section to `generateSpec()` (a new
`overviewSection()`), placed near the top (after the header, before/around `## Limits`) →
`npm run gen:spec` regenerates `docs/spec.md` → drift test pins the new bytes. _No handler
change._
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.
**Acceptance criteria** (confirm with human before coding):

- The spec contains a game-overview section describing, in plain prose, what ModelKombat is
  (LLMs author JSON-DSL karate fighters that battle deterministically; the bot is data not
  code; you're scored vs a frozen gauntlet), placed **before** the `## Expressions` /
  `## Action grammar` mechanics.
- The section is **version-neutral**: it cites **no** `BENCHMARK_VERSION`, `INPUT_HASH`, or
  frozen-manifest number (a `BENCHMARK_VERSION` bump must not touch this prose). Asserted by
  generating with a stub version/hash context and confirming the intro bytes are unchanged.
- `docs/spec.md` regenerated; the **drift test byte-matches**; the header still renders the
  **unchanged** `INPUT_HASH` and `BENCHMARK_VERSION`.
  **RED**: `gen-spec.test.ts` — assert `sectionOf(spec, "## <overview heading>")` is non-empty,
  sits before `## Expressions`, and contains stable domain phrases; assert it contains no
  version/hash token. Fails (section absent). Mutator gap to pre-empt: the section-ordering
  `indexOf(...) < indexOf(...)` comparisons (assert both directions where relevant), and the
  version-neutrality negative assertion (a mutant that interpolates the version must fail).
  **GREEN**: add `overviewSection()` (static, version-neutral string) and splice it into
  `generateSpec()`'s section list; run `npm run gen:spec`.
  **MUTATE**: run `mutation-testing` on `gen-spec.ts` (the new section + its placement).
  **KILL MUTANTS**: address survivors (ordering, phrase presence).
  **REFACTOR**: assess only if the section list composition reads better.
  **Done when**: ACs met; `docs/spec.md` committed with the regen; drift test green;
  `INPUT_HASH`/`BENCHMARK_VERSION` unchanged; mutation report reviewed; human approves commit.

### Slice 3: the `/spec` response is self-describing — serve-time API envelope

**Value**: LLM author — the served spec tells the caller **where to act**, honestly listing
only endpoints that exist (S1: `GET /spec`). Establishes the "layered envelope" mechanism
that S2/S3/S4 grow — without ever putting the deployment URL into the byte-stable,
drift-tested core.
**Path**: the `api/spec.ts` handler appends an **API-envelope** block to the response body at
serve time, rendered from a small live-endpoints config + the base URL derived from the
incoming request (`Host`/`req.url`). The envelope is **NOT** part of `generateSpec()` — it is
composed by the handler. _`generateSpec()` / `docs/spec.md` / `INPUT_HASH` untouched._
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.
**Acceptance criteria** (confirm with human before coding):

- The `GET /spec` body contains an API-envelope section listing **exactly** the live
  endpoints — at S1, only `GET /spec` — each with an **absolute URL built from the request
  host** (e.g. `https://<host>/spec`).
- Serve-time derivation is real, not hardcoded: a request with host `a.example` yields
  `https://a.example/spec`; host `b.example` yields `https://b.example/spec`.
- **No dead URLs**: the envelope does not mention `/validate`, `/fight`, or any unbuilt
  endpoint. (A single source — the live-endpoints config — drives the list; adding an entry
  is how a later slice advertises its endpoint.)
- The envelope is **outside** the hashed core: `generateSpec()` output does **not** contain
  the envelope marker, and the drift test / `INPUT_HASH` remain green/unchanged.
  **RED**: extend `api/spec.test.ts` — assert the response body (after the `generateSpec()`
  core) contains the envelope heading + `https://<host>/spec`; a second request with a
  different host yields the different absolute URL; assert `generateSpec()` (imported directly)
  does **not** contain the envelope heading; assert no `/validate`/`/fight` string appears.
  Fails (handler doesn't append yet). Mutator gaps: the base-URL construction (scheme + host
  concatenation — the two-host test kills a hardcoded-host mutant), the endpoint-list length
  (the "exactly one entry" assertion kills an off-by-one / duplicated-entry mutant).
  **GREEN**: add a `LIVE_ENDPOINTS` config (`[{method:"GET", path:"/spec", summary}]`) and an
  `apiEnvelope(baseUrl)` renderer; in the handler, derive `baseUrl` from the request and append
  `generateSpec() + "\n\n" + apiEnvelope(baseUrl)`.
  **MUTATE**: run `mutation-testing` on the handler + envelope renderer.
  **KILL MUTANTS**: address survivors (URL assembly, list membership).
  **REFACTOR**: assess only if the compose step reads cleaner.
  **Done when**: ACs met; drift test green + `INPUT_HASH` unchanged; deployed body shows the
  envelope with the real deployment host; mutation report reviewed; human approves commit.

### Slice 4: `model` provenance field on `BotDoc` (the engine precursor)

**Value**: LLM author — declare _what authored the fighter_ (`"Claude Opus 4.8"`, `"human"`),
travelling with the document for later replay / hall-of-fame / crown display (S4). Purely
descriptive and inert in v1.
**Path**: `src/engine/dsl.ts` — add optional `model?: string` to the `BotDoc` type + a
validator length check (mirroring `name`: when present, a string of 1..64 chars); the
interpreter never reads it (determinism-safe, invariant #1) and it adds **no DSL op** (TCB
allowlist untouched, invariant #2). Then `src/cli/gen-spec.ts` — add `model` to
`documentShapeSection()` and `botDocSchema()` (optional string, `maxLength`); regenerate
`docs/spec.md`. _The 6 frozen `bots/_.json`gauntlet files stay WITHOUT`model`, so
`INPUT_HASH`/`BENCHMARK_VERSION`are unchanged (adding it to a frozen file would flip the
hash → throne reset, decision 8).*
**Required implementation skills**:`tdd`, `testing`, `mutation-testing`, `refactoring`.
**Acceptance criteria** (confirm with human before coding):

- `validate()` accepts a bot with `model:"Claude Opus 4.8"`; accepts a bot with **no**
  `model` (optional); rejects `model` that is a non-string; rejects `model` longer than the
  cap (boundary: 64 ok, 65 rejected — mirroring `name`) with a structured
  `{path:"model", reason}` issue.
- **Determinism guard**: a fight (or an interpreted tick) with vs without `model` on an
  otherwise-identical bot produces **byte-identical** output — proving the interpreter never
  reads it.
- The spec's **Document shape** shows `model` as an optional sibling of `name`, and
  `botDocSchema()` includes `model` (`{type:"string", maxLength:64}`, **not** in `required`);
  `docs/spec.md` regenerated, drift test green.
- `INPUT_HASH` and `BENCHMARK_VERSION` **unchanged**; all frozen `bots/*.json` unchanged; the
  existing gauntlet/benchmark tests stay green.
  **RED**: `dsl.test.ts` — the accept/absent/non-string/over-length cases + the
  determinism-guard test (equal fight results with/without `model`). `gen-spec.test.ts` — the
  Document-shape + JSON-Schema `model` assertions. All fail. Mutator gaps to pre-empt: the
  length boundary (`> 64` vs `>= 64` — the 64-ok / 65-rejected pair kills it), the `typeof`
  guard, the optionality (the absent-`model` accept test kills a "required" mutant).
  **GREEN**: add the type field; add the validator block (guarded by `d.model != null`); add
  the schema property + doc-shape line; `npm run gen:spec`.
  **MUTATE**: run `mutation-testing` on the `dsl.ts` validator block + `gen-spec.ts` schema/shape.
  **KILL MUTANTS**: address survivors — expect the classic boundary + string-literal survivors
  (mirror how `name` and the score-0 move readers were handled elsewhere).
  **REFACTOR**: assess factoring a shared "optional capped string" check with `name` — only if
  it genuinely reads cleaner (don't over-abstract a two-call pattern).
  **Done when**: ACs met; determinism guard green; `docs/spec.md` regen committed; drift green;
  `INPUT_HASH`/`BENCHMARK_VERSION` unchanged; mutation report reviewed; human approves commit.

## Pre-PR Quality Gate (every slice)

1. Mutation testing — run `mutation-testing`; review the report.
2. Refactoring assessment — run `refactoring`.
3. `npm run typecheck` (base + `tsconfig.api.json`), `npm run lint`, `npm run format:check`,
   `npm test` all green.
4. For any spec-touching slice (2, 4): `docs/spec.md` regenerated via `npm run gen:spec`,
   drift test byte-matches, and `INPUT_HASH` + `BENCHMARK_VERSION` confirmed unchanged.
5. PR per slice; wait for explicit commit + merge approval.

## Out of scope for S1 (later stories)

- `POST /validate` (S2), `POST /fight` gauntlet gate (S3), the version-scoped throne + title
  fight + atomic CAS (S4), `/replay` (parking lot), rate-limit + payload cap (attach to the
  first public compute endpoint, S3), the author `handle` envelope metadata (S4).

---

_Delete this file when S1 is complete (archive per the "archive plans, don't delete"
convention — move to `docs/archive/` with a README entry). If `plans/` is empty, delete it._
