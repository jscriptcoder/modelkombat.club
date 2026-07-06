# Plan: Platform HTTP API — S2 (`POST /validate`)

**Branch**: feat/platform-api-s2-validate
**Status**: Active
**Story**: S2 in `plans/platform-http-api-stories.md`. Decisions: `plans/platform-http-api-decisions.md` (decision 10 + § API response contract). Prior slice: S1 (`GET /spec`), archived at `docs/archive/platform-http-api-s1-spec.md`.

## Goal

An LLM author can POST a bot document to `/validate` and learn — **without spending a fight** — whether it is well-formed, receiving the validator's structured issues (RFC 9457) when it is not.

## Context (why S2 is thin transport — reuse, don't rebuild)

- `validate(doc: unknown): { ok, issues: {path,reason}[], nodeCount }` — the TCB validator in `src/engine/dsl.ts`. S2 wraps it; adds no new trust.
- `safeParse(text): unknown` — prototype-pollution-safe intake; throws `ValidationError` on **oversize** (`LIMITS.maxBytes` = 32 KB) or a **forbidden key**, and a `SyntaxError` on **unparseable** JSON. ⇒ the payload cap already EXISTS; S2 only maps it to the right status.
- `parseBotDoc` (`src/cli/load.ts`) composes these but **flattens** every failure into one issue list — it can't drive per-failure HTTP status. So the handler composes `safeParse` + `validate` **directly** and branches on the failure kind. TCB untouched (invariant #2).
- S1's `api/spec.ts` is the template: a Web-standard `fetch` export, an inline RFC 9457 `405`, a `LIVE_ENDPOINTS` array, and a `vercel.json` rewrite. S2 mirrors it for POST.
- The `/spec` serve-time envelope is designed to **grow by adding a `LIVE_ENDPOINTS` row** ("no dead URLs"). Going live ⇒ advertise `/validate` there (and flip the S1 test that pins "no `/validate` yet").

## Acceptance Criteria (feature-level)

- [ ] `POST /validate` with a valid bot → `200 application/json` `{ "ok": true }`.
- [ ] `POST /validate` with a structurally-invalid bot → `422 application/problem+json` `type: "/problems/invalid-bot"` with an **`errors`** member = the validator's `{path,reason}` issues (verbatim).
- [ ] Unparseable JSON body → `400 /problems/malformed-request`.
- [ ] Non-POST method → `405 /problems/method-not-allowed`, `Allow: POST`.
- [ ] Oversize body (> `LIMITS.maxBytes`) → `413 /problems/payload-too-large`.
- [ ] (decision 2) A present, non-JSON `Content-Type` → `415 /problems/unsupported-media-type`; an ABSENT content-type stays lenient (parse-first).
- [ ] `GET /spec` now advertises `POST …/validate` in its serve-time envelope (and still not `/fight`).
- [ ] No fights, no opponent docs, no state. `INPUT_HASH` / `BENCHMARK_VERSION` unchanged (no engine / bot-file / spec-INPUT edits); the `docs/spec.md` drift test stays green.

## Slices

Every slice follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR. No production code without a failing test. Handler logic is TDD'd as a **pure function** — construct a `Request`, assert the `Response` (per decisions § Testing strategy), exactly like `api/spec.test.ts`.

### Slice 1: `POST /validate` returns `{ok:true}` or the structured validator issues

The walking skeleton — the complete **core value** (confirm well-formed / get structured errors) end-to-end through the real deploy path, and `/spec` advertises it.

**Value**: LLM author — cheaply confirms a bot is well-formed, or gets the exact issues to fix, before ever spending a fight.
**Trigger**: `POST /validate` with a JSON bot-document body.
**Observable outcome**: `200 {ok:true}` (valid) · `422` problem+json + `errors` (structurally invalid) · `400` (unparseable JSON) · `405` (non-POST). `GET /spec` lists `/validate`.
**Path**: `vercel.json` rewrite `/validate → /api/validate` → `api/validate.ts` `async fetch` handler → `await req.text()` → `safeParse` (`SyntaxError` → 400 `/problems/malformed-request`; `ValidationError` from a forbidden key → 422 + `errors`) → `validate(doc)` (`ok:false` → 422 + `errors`) → `200 {ok:true}`. Plus: add the `LIVE_ENDPOINTS` row in `api/spec.ts`.
**Intentionally skipped this slice**: 413 oversize + 415 content-type → **Slice 2**; 429 rate-limit → **S3** public-release gate.
**Required implementation skills**: load `tdd`, `testing`, `mutation-testing`, `refactoring` before code.
**Acceptance criteria** (present at CONFIRM gate before any code):

- valid bot → `200`, `content-type: application/json; charset=utf-8`, body exactly `{"ok":true}`.
- invalid bot (e.g. `version: 2`) → `422`, `content-type: application/problem+json; charset=utf-8`, `body.type === "/problems/invalid-bot"`, `body.status === 422`, and `body.errors` **deep-equals** the validator's issues (each `{path,reason}` present — not just a non-empty array).
- `"{"` (broken JSON) → `400`, `body.type === "/problems/malformed-request"`.
- `GET /validate` (and any non-POST) → `405`, `Allow: POST`, `body.type === "/problems/method-not-allowed"`.
- `GET /spec` envelope now has **2** endpoint bullets, contains `POST …/validate`, and still does NOT contain `/fight`.
  **RED**: `api/validate.test.ts` with a `validateRequest(method, body?, headers?)` factory + a valid `BotDoc` (reuse the `getMockBotDoc()` test factory or a minimal literal `{version:1,name:"t",rules:[],default:{type:"idle"}}`). Tests: the four rows above. Mutator focus (`resources/mutator-rules.md`): pin each **status number** (a 422↔400↔413↔405 swap must fail), each `type` **string**, and the `errors` **contents** (an empty-array / dropped-issues mutant must fail); pin the `res.ok ? 200 : 422` boundary (invert → a valid bot 422s → fails). Update `api/spec.test.ts`: envelope bullets `toHaveLength(2)`, contains `/validate`, `not.toContain("/fight")`.
  **GREEN**: `api/validate.ts` — POST-only Web `fetch` handler; a **local** `problem(status, type, title, extras?)` helper building the `application/problem+json` envelope; compose `safeParse` + `validate`; branch failures to statuses. `vercel.json`: add the `/validate` rewrite (**no** `includeFiles` — `/validate` reads no bot files). `api/spec.ts`: append the `LIVE_ENDPOINTS` row `{ method: "POST", path: "/validate", summary: "pre-check a bot document — returns ok or the validator's structured issues" }`.
  **MUTATE**: `npx stryker run --mutate 'api/validate.ts:<range>,api/spec.ts:<envelope-range>'` (one `--mutate`, comma-ranges — per the air-actions gotcha).
  **KILL MUTANTS**: strengthen tests for survivors; ask if a survivor's value is ambiguous.
  **REFACTOR**: keep `problem()` **local** to `api/validate.ts` (S1's single 405 + S2 ≠ enough shared knowledge to extract yet; the rule-of-three trigger is S3's 3rd handler — and a shared module must live OUTSIDE `api/`, since Vercel routes every `api/*.ts`). Do NOT retrofit S1's 405 to a shared helper in this slice.
  **Done when**: all ACs met, mutation report reviewed, human approves commit.

### Slice 2: `/validate` rejects oversize and wrong-media-type requests with the correct status

Harden the public request envelope — surface the existing `LIMITS.maxBytes` bound as `413`, and (decision 2) reject a declared non-JSON media type as `415`. This is the shared HTTP-envelope hardening S3's public gate reuses.

**Value**: operator + honest LLM author — malformed **transport** (too big / wrong type) gets the precise RFC 9457 status instead of a generic 422 or an ugly 500, so a caller can react correctly.
**Trigger**: `POST /validate` with an oversize body, or a present non-JSON `Content-Type`.
**Observable outcome**: body > `LIMITS.maxBytes` → `413 /problems/payload-too-large`; `Content-Type: text/plain` → `415 /problems/unsupported-media-type`.
**Path**: in `api/validate.ts`, BEFORE `safeParse`: (a) if a `Content-Type` is present and is not `application/json` (ignoring `; charset=…`) → 415; (b) `text.length > LIMITS.maxBytes` → 413 (import the engine constant — **one** size boundary, mapped to the right status, no second magic number). Absent content-type ⇒ parse-first (lenient).
**Intentionally skipped**: 429 rate-limit — needs Vercel WAF/firewall config (not handler code), has no positive user outcome, and per the parking lot attaches to S3's public-release gate.
**Required implementation skills**: load `tdd`, `testing`, `mutation-testing`, `refactoring` before code.
**Acceptance criteria** (present at CONFIRM gate):

- a body one byte over `LIMITS.maxBytes` → `413`, `body.type === "/problems/payload-too-large"`.
- a body **at** the cap that is otherwise valid → NOT 413 (boundary; validates normally).
- `Content-Type: text/plain` with a valid-JSON body → `415`, `body.type === "/problems/unsupported-media-type"` (decision 2).
- `application/json; charset=utf-8` → accepted (param-tolerant).
- **absent** `Content-Type` + valid JSON → `200` (leniency pinned — LLM callers that omit the header aren't punished).
  **RED**: oversize-body test → 413; at-cap boundary test → not 413; `text/plain` → 415; `application/json; charset=utf-8` → 200; no content-type + valid JSON → 200. Mutator focus: the `>` vs `>=` on the cap (both boundary tests present), and the content-type equality/`startsWith` check (a mutated comparison must flip a case).
  **GREEN**: add the two pre-`safeParse` guards to `api/validate.ts`.
  **MUTATE / KILL / REFACTOR**: standard; reassess whether `problem()` now wants extracting (still likely local until S3).
  **Done when**: all ACs met, mutation report reviewed, human approves commit.

## Open decisions — lock at the relevant CONFIRM gate

1. **Success body shape** (slice 1) — `{ok:true}` (minimal) vs `{ok:true,nodeCount}` (a free diagnostic: doc size vs `LIMITS.maxNodes`). **Recommend `{ok:true}`** — the story AC says only "ok"; `nodeCount` adds an unrequested field and is trivially addable later.
2. **415 content-type strictness** (slice 2) — reject a PRESENT non-JSON type (415) while staying lenient on an ABSENT one, vs drop 415 for v1 (parse everything; 400 on failure). **Recommend the middle** (reject present-non-JSON, lenient on absent) — honors the decisions § contract table without punishing LLM callers that forget the header.
3. **Slice count** — 2 slices (cleaner review) vs fold slice 2 into slice 1 (one `/validate` PR). **Recommend 2.**
4. **`problem()` helper location** — local to `api/validate.ts` now; extract to a shared module (OUTSIDE `api/`, e.g. `src/api/problem.ts`) at S3. **Recommend local now** (rule of three; avoids Vercel routing a helper file).

## Pre-PR Quality Gate (per slice)

1. Mutation testing on `api/validate.ts` (+ the `api/spec.ts` envelope diff in slice 1) — 100% on changed regions.
2. Refactoring assessment (`refactoring` skill).
3. `npm run typecheck` + `tsc -p tsconfig.api.json --noEmit` + `npm run lint` + `npm run format:check` all clean.
4. Confirm `INPUT_HASH` / `BENCHMARK_VERSION` unchanged (no engine/bot/spec-input edits) and the `docs/spec.md` drift test is green (only slice 1 edits `api/spec.ts`, never `generateSpec()`).
5. Post-deploy smoke (manual/CI, integration — not a unit test): `curl -sX POST …/validate -d '<valid bot>'` → `200 {"ok":true}`; `-d '{'` → `400`.

---

_On completion, **archive** this file to `docs/archive/` + a README entry (project convention — completed plans are archived, never deleted). See the S1 plan's archival as the pattern._
