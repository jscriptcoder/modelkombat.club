# Plan: Public page — Slice 2 (who rules the ring)

**Branch**: feat/public-page-king (implementation) · plan authored on `docs/public-page-s2-plan`
**Status**: Active (awaiting approval)

> Sequences **Slice 2** of the 5-slice public-page feature from
> `plans/public-page-stories.md` ("Returning fan sees who currently rules the ring —
> or that it's open") into PR-sized TDD stages. Source of truth: the story split +
> hardened ACs (AC-K1–K5, AC-C1/C4, AC-R1/R2, AC-A1–A2) and
> `plans/public-page-decisions.md` (decisions 5, 7, 11 + the version-scoping/data-load
> defaults). Slice 1 (walking skeleton) is complete and live.

## Goal

A visitor sees **who currently rules the ring** — the reigning King's identity (name ·
model · handle · generation), or an inviting **"the throne awaits"** call when it's
empty — driven by a real, version-scoped `GET /king` read endpoint that reuses the
existing throne store without forking the read path.

## Grounding (what exists, what we reuse — do NOT fork)

- **Throne read:** `ThroneStore.read(version)` (`src/http/throne-store.ts`) returns the
  reigning `ThroneRecord | undefined`. Slice 2 uses this **as-is** — no port change. The
  bounded **lineage/recent read** (predecessors → podium) is **Slice 3**, and is the
  only thing that touches the port.
- **Store selection:** `selectThroneStore(process.env)`
  (`src/http/throne-store-select.ts`) already resolves the durable Upstash adapter in
  prod / the in-memory fake locally. `/king` reuses it verbatim.
- **Handler seam:** mirror `handle-fight.ts` → thin `api/fight.ts`. We add
  `src/http/handle-king.ts` (store + version injected) and a thin `api/king.ts` wrapper.
  The seam is what makes AC-K3 (store-down → 503) unit-testable with an injected
  throwing store.
- **Envelope:** the shared `problem()` (RFC 9457) + method-405 shape from
  `src/http/envelope.ts` / `api/spec.ts`. `/king`'s 405 and 503 use it.
- **Identity shaping:** `handle-fight.ts` has a private `incumbentOf(record)` →
  `{ name, model, handle }` (the `/fight` title block, generation-less). Decision 5 wants
  the King as `{ name, model, handle, generation }` — a superset. We extract the shared
  identity-nulling knowledge into `championIdentity(record)` and have `incumbentOf`
  delegate (its output unchanged), honoring the split's "reuse, don't fork" warning.
- **`/spec` advertisement:** `LIVE_ENDPOINTS` lives in `api/spec.ts` (the **serve-time**
  API envelope), **not** in the byte-hashed `gen-spec.ts` core — so advertising `/king`
  adds a row here and does **NOT** touch `INPUT_HASH` / `BENCHMARK_VERSION`.
- **Routing:** `vercel.json` rewrites `/spec` · `/validate` · `/fight` → `/api/*` then
  `/(.*)` → `/index.html`. We insert `/king` → `/api/king` **before** the SPA fallback.
  No `includeFiles` (king reads the store, not `bots/*.json`).
- **Web:** `web/` Vite+Solid app; browser-mode tests (`*.test.tsx`, Playwright provider)
  inject dependencies rather than hitting the network. The King section uses a Solid
  `createResource` with an **injectable `fetchKing`** prop (default = fetch `/king`), so
  every state is driven deterministically in-test.

## Invariants (unchanged)

`/king` is pure transport over the platform-layer throne store — **no DSL op, TCB
untouched (invariant #2)**, no engine/`INPUT_HASH`/`BENCHMARK_VERSION` change. The
version scoping reads `BENCHMARK_VERSION` (v19) but does not alter it.

## Acceptance Criteria

- [ ] `GET /king` returns the reigning champion **identity only** — never the DSL/`rules`.
- [ ] Empty throne is a **success** (`200 { current: null }`), visibly distinct from a
      store failure (`503`).
- [ ] Store-unreachable → `503 application/problem+json` (never rendered as "empty").
- [ ] Non-`GET` → `405` + `Allow: GET`.
- [ ] `/king` is advertised in `/spec`; no `INPUT_HASH`/`BENCHMARK_VERSION` change.
- [ ] The page shows the King's identity, the empty-throne CTA, a loading state, and a
      distinct error+Retry state — untrusted champion strings render as inert text.
- [ ] `/spec` · `/validate` · `/fight` · `/` all still respond (preview smoke).

## Scoping decisions to confirm (deviations / boundaries)

1. **`recent` is deferred to Slice 3.** Slice 2's endpoint returns `{ current }` **only**
   (no `recent` key). Nothing in Slice 2 can populate it (the port has no lineage read)
   or consume it (the King section shows only the current King), so shipping
   `recent: []` now would be speculative. Adding `recent` in Slice 3 is
   backward-compatible. This scopes the AC-K1/K2 `recent` clause (whose header already
   reads "Slices 2–3") to Slice 3.
2. **AC-C2 (truncate + `title`) and AC-C3 (control-char strip) ride with the podium
   cards (Slice 3/4).** They matter when multiple fixed-height cards sit side by side;
   Slice 2's single centered King renders plain, auto-escaped text (AC-C1) with absent
   optionals handled (AC-C4). Flagged so the deferral is explicit, not an oversight.
3. **`championIdentity` extraction** (shared shaper) + `incumbentOf` refactored to
   delegate — a behavior-preserving refactor of `/fight` code (existing tests stay green).
4. **503 problem `type`** = `/problems/throne-unavailable` (RFC 9457, via `problem()`).
5. **Slice 2a is a backend-only PR** — justified: it ships the platform's first `GET`
   data endpoint, advertised in `/spec` (an immediate real consumer) and smoke-verifiable,
   and burns the `/king` routing risk **before** the UI depends on it — the same
   "de-risk the integration first" rationale the story split used for Slice 1. Not
   plumbing-for-its-own-sake.
6. **Cache-Control** on `/king` `200` responses (King changes rarely): a short
   `public, max-age=30` (tune at TDD time); `503`/`405` are **not** cached.

---

## Slices

Every slice follows RED → GREEN → MUTATE → KILL MUTANTS → REFACTOR. Load `tdd`,
`testing`, `mutation-testing`, `refactoring` before code. **CONFIRM** the slice's ACs
with the human before any code; **STOP** for commit approval after each slice.

### Slice 2a: `GET /king` serves the reigning champion's identity (or an empty throne)

**Value**: An API client (and, immediately, the `/spec` envelope) can read who currently
holds the throne for the live version — the platform's first stateful **read** surface.
Burns the `/king` routing risk before the UI rides on it.

**Path**: `GET /king` → `vercel.json` rewrite → `api/king.ts` (wires
`selectThroneStore(process.env)` + `BENCHMARK_VERSION`) → `handleKing(req, { store,
version })` → `store.read(version)` → `championIdentity` shaping → `200 { current }` /
`200 { current: null }` / `503` / `405`. Node-tested at the `handleKing` seam + the
`api/king.ts` wrapper, exactly like `api/fight.test.ts`.

**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.

**Acceptance criteria** (present to human before code):

- **AC-K1** (happy): a crowned King for `BENCHMARK_VERSION` → `200`, `content-type:
application/json`, body `{ current: { name, model, handle, generation } }`. A champion
  doc **carrying `rules`** yields a response in which **no rule/DSL field appears
  anywhere** (first-class no-leak test). `model`/`handle` absent → `null` (not omitted,
  not "undefined").
- **AC-K2** (empty): no King for the version → `200 { current: null }` (a success, not
  an error).
- **AC-K3** (store down): `store.read` rejects → `503 application/problem+json` with
  `type: "/problems/throne-unavailable"` via `problem()`. Never a 200/empty.
- **AC-K4** (method): non-`GET` → `405` problem+json + `Allow: GET`.
- **AC-K6** (cache): `200` responses carry `Cache-Control: public, max-age=30`;
  `503`/`405` carry no positive cache directive.
- **AC-envelope**: `api/spec.ts` `LIVE_ENDPOINTS` gains a `GET /king` row (asserted in
  `api/spec.test.ts`); `gen-spec` output / `INPUT_HASH` / `BENCHMARK_VERSION` unchanged
  (existing drift + version tests stay green).
- **AC-reuse**: `championIdentity(record)` is the single identity shaper; `/fight`'s
  `incumbentOf` delegates to it, `/fight` response bytes unchanged (existing
  `api/fight.test.ts` / `handle-fight.test.ts` green).
- **Infra (smoke, not unit)**: `/king` rewrite added before the SPA fallback.

**RED**: `src/http/handle-king.test.ts` — inject an in-memory fake with a crowned King
(assert K1 shape + **no-leak**: a champion with `rules` never surfaces a rule field), an
empty fake (K2), a stub whose `read` rejects (K3), and a non-GET request (K4 + `Allow`).
Assert the `Cache-Control` header on 200 (K6) and its absence on 503. Add an
`api/king.test.ts` smoke over the real wrapper (default env → in-memory → empty → `200 {
current: null }`). Extend `api/spec.test.ts` for the `/king` envelope row. Mutator
scan: the `undefined`→null-vs-empty branch (K1/K2), the reject→503 boundary (K3), the
method equality (K4), the `?? null` defaults, the status literals.

**GREEN**: `championIdentity` (extract from `incumbentOf`), `handle-king.ts` (try/catch
`read` → 503; `undefined` → `{ current: null }`; record → `{ current:
championIdentity(record) }`; non-GET → 405), `api/king.ts` wrapper, the `LIVE_ENDPOINTS`
row, the `vercel.json` `/king` rewrite.

**MUTATE**: `npm run mutation` scoped to `handle-king.ts`, `champion-identity.ts`,
`api/king.ts` (node config). **KILL MUTANTS**: strengthen the no-leak / 503-vs-empty /
method / cache-header assertions; ask if any survivor is genuinely equivalent.

**REFACTOR**: fold the shared identity-nulling into `championIdentity` and confirm
`incumbentOf` delegates cleanly; assess whether `handleKing`'s method guard should reuse
a shared helper (only if it adds value).

**Done when**: all ACs met; mutation report reviewed; typecheck+lint+format clean;
**preview smoke** — `GET /king` → `200 { current: null }` (in-memory preview store),
`/spec` lists `GET /king`, `/validate`+`/fight`+`/` still respond; human approves commit.

### Slice 2b: The page shows who rules the ring (King section)

**Value**: A returning fan lands on the page and immediately sees the reigning King —
or an inviting "be the first to claim it" when the throne is open (the likely launch
reality) — with honest loading and error states.

**Path**: `<App>` renders a new `<King>` section → `createResource(fetchKing)` (prop,
default fetches `/king` and throws on non-2xx) → renders loading → { populated | empty
CTA | error + Retry }. The nav grows a `#king` anchor. Browser-mode tested by injecting
`fetchKing`; smoke-verified on preview against the real 2a endpoint.

**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`
(+ browser-mode `testing` patterns — inject the fetcher, assert exact text/roles, never
`toBeTruthy`).

**Acceptance criteria** (present to human before code):

- **AC-K5** (loading): while the fetch is pending, the King section shows an accessible
  loading placeholder (e.g. `role`/`aria-busy` or a labelled status), replaced on
  resolve.
- **AC-K1 display**: resolved with a King → the section shows the `name`, the `model` as
  **text** beside a **generic head** placeholder, and a `generation` label
  (e.g. "Gen 3"). (SVG logo marks are Slice 4 — a generic head stands in.)
- **AC-K2 display**: resolved with `current: null` → "👑 The throne awaits — be the
  first to claim it" with a link to `/spec`.
- **AC-K3 display**: fetch rejects (incl. 503) → a **distinct** "⚠ Couldn't reach the
  ring" state with an **enabled Retry** button that re-runs the fetch (`refetch`). A
  failure is never shown as the empty-throne CTA.
- **AC-C1** (escaping): a champion whose `name` is `"<script>alert(1)</script>"` renders
  as **literal text**; no `<script>` element is created (Solid auto-escapes).
- **AC-C4** (absent optionals): `model` null → generic head + **no** model label (not the
  string "null"); `handle` null → the byline omits the handle entirely.
- **AC-nav**: the sticky nav gains a `#king` link; anchors are now `["#top",
"#how-it-works", "#king", "/spec"]` (Nav test updated). The King section is a landmark
  `region` (`id="king"`, `aria-labelledby`) so the anchor + smooth-scroll (already
  CSS-native) resolve.
- **AC-R1/A1/A2 (carry)**: King section is single-column with no horizontal scroll at
  ≤360px; the Retry button is keyboard-reachable with a visible focus ring; text +
  interactive elements meet WCAG AA on the dark theme.

**RED**: `web/src/King.test.tsx` (or extend `App.test.tsx`) — render `<King
fetchKing={...}>` with: a never-resolving promise (K5 loading), a resolved King incl. a
`<script>` name and full fields (K1 + C1 exact-text + generation label), `null` model +
handle (C4), `current: null` (K2 CTA + `/spec` href), and a rejecting fetcher (K3
error + Retry present/enabled; clicking Retry with a then-resolving fetcher shows the
King). Extend the nav test to the 4-anchor order. Assertions are exact (roles, exact
text, exact hrefs) — browser `.tsx` is not Stryker-mutated.

**GREEN**: `web/src/King.tsx` (resource + the four render branches + generic-head
placeholder), wire `<King>` into `App.tsx` in decision-11 order (How it works → CTA →
Current King), add the `#king` nav link + `.king`/state CSS.

**MUTATE**: no new node/pure logic ⇒ Stryker scope unchanged (per the durable web-layer
rule — browser components are guarded by strong exact assertions, not Stryker). If any
non-trivial pure helper emerges (e.g. a status-mapping fn), extract it to a node-tested
`.ts` under `src/` and mutate it. **KILL MUTANTS**: n/a for the browser layer beyond the
exact-assertion discipline.

**REFACTOR**: assess sharing the section-landmark shape with `HowItWorks`/`Cta`; only if
it adds value.

**Done when**: all ACs met; browser suite green; typecheck+lint+format clean; **preview
smoke** — the deployed page shows the **empty-throne CTA** (preview store is in-memory,
so empty) and the nav `#king` anchor scrolls to it; `/king` returns `200 { current:
null }`; human approves commit.

## Pre-PR Quality Gate (each slice)

1. `npm run mutation` (node scope) — review survivors (2a; 2b adds none).
2. `refactoring` assessment.
3. `npm run typecheck && npm run lint && npm run format:check`.
4. `npm test` — full node + web suites green.
5. **Preview smoke** on the Vercel preview URL (the non-TDD deploy boundary): curl
   `/king` (+ `/spec` lists it) · `/validate` · `/fight` · `/` · a bogus route (SPA
   fallback); `agent-browser` a11y snapshot of the King section for 2b.

## Out of scope (Slice 3+)

- **`recent`/lineage + Hall-of-Kings podium + sparse states** (AC-P1–P6, the
  `ThroneStore` lineage read + Upstash `LRANGE` + contract-spec extension) → **Slice 3**.
- **AC-C2 (truncate + `title`) / AC-C3 (control-char strip)** → ride the podium cards
  (Slice 3/4).
- **SVG logo marks + `modelToLogo` normalization + hero** (AC-L1–L3) → **Slice 4**
  (generic head placeholder until then).
- **`#champions` nav anchor** → added with the podium (Slice 3).
- **Fights "coming soon" teaser** (AC-R3/A3) → **Slice 5**.

---

_Archive to `docs/archive/` when the whole public-page feature ships (per
[[archive-plans-not-delete]] — decisions/stories stay live meanwhile). Do not delete._
