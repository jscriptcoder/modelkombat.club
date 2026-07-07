# Plan: Public page — Slice 3 (Hall of Kings — the podium)

**Branch**: feat/public-page-recent-lineage (3a) + feat/public-page-podium (3b) · plan authored on `docs/public-page-s3-plan`
**Status**: ✅ COMPLETE — shipped + live (2026-07-07). Slice 3a `GET /king` recent lineage (PR #204), Slice 3b Hall of Kings podium (PR #205); this close-out archives the plan.

> Sequences **Slice 3** of the 5-slice public-page feature from
> `plans/public-page-stories.md` ("Fan sees the recent lineage of Kings on a podium" —
> Hall of Kings) into PR-sized TDD stages. Source of truth: the story split + hardened
> ACs (AC-P1–P6, the AC-K1/K2 `recent[]` clause, AC-C2/C3, AC-nav) and
> `plans/public-page-decisions.md` (decisions 2, 5, 7, 11 + the version-scoping default).
> Slices 1 (walking skeleton) + 2 (`GET /king` + King section) are complete and live.

## Goal

A visitor sees the **recent succession of Kings on a podium** — gold (current) · silver
(prior) · bronze (two-prior) drawn from the tail of the throne's append-only lineage,
with honest **sparse states** (1, 2, or 0 champions never fabricate a step) — driven by a
new **bounded lineage read** on the `ThroneStore` port that `GET /king` exposes as a
capped, identity-only `recent[]`.

## Grounding (what exists, what we reuse — do NOT fork)

- **The lineage already exists in storage.** Every crown RPUSHes the champion record onto
  `champions:${version}` (an append-only list, oldest-first) in the same atomic `CROWN_SCRIPT`
  EVAL that sets the reigning pointer (`throne:${version}`). So the reigning record is
  always the **lineage tail** — no new write path, no migration. Slice 3 only adds a
  **read**.
- **The `ThroneStore` port** (`src/http/throne-store.ts`) today exposes `read` +
  `compareAndSwap`. The in-memory fake keeps the full lineage internally and exposes it via
  a test-only `lineage(version)` affordance on `InMemoryThroneStore`. Slice 3 adds a **real
  port method** `recent(version, limit)` to `ThroneStore` (implemented by BOTH the fake and
  the Upstash adapter). The fake's existing `lineage()` test affordance stays (it observes
  full history for the crown tests); `recent()` is the new bounded read under test.
- **The Upstash adapter** (`src/http/throne-store-upstash.ts`) is built from pure
  `build*Request` + `interpret*Reply` pairs (`buildReadRequest`/`interpretReadReply`,
  `buildCrownRequest`/`interpretCrownReply`) wired by `read`/`compareAndSwap`. Slice 3 adds
  the symmetric `buildRecentRequest`/`interpretRecentReply` (an `LRANGE champions:{version}
-limit -1` → parse each JSON entry; **an error reply THROWS, never a silent empty** —
  mirroring `interpretReadReply`) + a `recent` method. The env-gated smoke harness ALREADY
  reads lineage via `LRANGE ... 0 -1`, so the same Redis shape is proven.
- **The shared contract spec** (`src/http/throne-store.contract.ts`,
  `runThroneStoreContract`) is the single behavioral spec both stores satisfy — the fake
  in-suite (`throne-store.test.ts`) + live Upstash (`throne-store-upstash.smoke.test.ts`,
  env-gated). Slice 3 adds `recent` `it()`s here so the bounded read's semantics are pinned
  in **one** place and proven on real Redis.
- **`championIdentity(record)`** (`src/http/champion-identity.ts`) is the single
  identity-only shaper (`{ name, model, handle, generation }`, never `rules`). Slice 3
  reuses it verbatim to shape **every** `recent[]` entry — the no-DSL-leak guarantee (AC-K1)
  extends to the lineage for free. (Decision D3 below widens it for AC-C3.)
- **`handleKing`** (`src/http/handle-king.ts`) is the injectable `GET /king` seam
  (`{ store, version }`), already `try`/`catch`-wrapping the store read → 503. Slice 3 adds
  the `recent` read **inside the same try** and returns `{ current, recent }`.
- **The King section** (`web/src/King.tsx`) is a Solid `createResource` with an injectable
  `fetchKing` prop; its `KingView` type already carries a comment "`recent` lineage arrives
  in Slice 3". `KingView` gains `recent: Champion[]` (King ignores it — additive, Slice-2
  tests stay green); the new `<Podium>` consumes it.
- **Routing / `/spec`**: `/king` is already rewritten + advertised (Slice 2). Slice 3 does
  **not** add an endpoint — it enriches the existing `/king` body — so no `vercel.json`
  change and (at most) a cosmetic `LIVE_ENDPOINTS` summary refresh.

## Invariants (unchanged)

`recent` is pure transport over the platform-layer throne store — a **read-only**
identity-only projection of already-persisted lineage. **No DSL op, TCB untouched
(invariant #2)**, no engine / `INPUT_HASH` / `BENCHMARK_VERSION` change. Fights are still
never stored as tapes (invariant #1) — the lineage holds champion documents + crowning
metadata only. Version scoping reads `BENCHMARK_VERSION` (v19), does not alter it.

## Acceptance Criteria

- [ ] `GET /king` returns `{ current, recent }` — `recent` is the **≤3 most-recent** Kings,
      **newest-first** (`recent[0]` == current when non-empty), **identity only** (never the DSL).
- [ ] Empty throne → `200 { current: null, recent: [] }` (success, not an error).
- [ ] The bounded lineage read is a **`ThroneStore` port method** satisfied by BOTH the
      in-memory fake and the Upstash adapter, pinned by the shared contract spec (fake
      in-suite + live Upstash smoke).
- [ ] Champion identity strings are **control-char-sanitized** for safe display (AC-C3),
      and never leak `rules`/DSL — for the current King and every lineage entry alike.
- [ ] The page shows a **Hall of Kings podium**: gold/silver/bronze from `recent`, with
      honest sparse states (2 → no bronze; 1 → gold only; 0 → no fabricated podium), a
      loading + error/Retry state, and a `#champions` nav anchor.
- [ ] Long identity strings truncate to a single line with the full value in a `title`
      attribute (AC-C2); untrusted strings render inert (AC-C1); duplicate names across
      generations are allowed, not deduped (AC-P6).
- [ ] `/spec` · `/validate` · `/fight` · `/king` · `/` all still respond (preview smoke).

## Scoping decisions to confirm (deviations / boundaries)

1. **New port method `recent(version, limit)`** (bounded), NOT a full `lineage()` read on the
   port. The handler passes `limit = 3` (the podium's need, AC-P1); the bound lives at the
   store (`LRANGE -limit -1` / `entries.slice(-limit)`) so the read is always cheap. A future
   "full Hall of Kings" (parked) passes a larger bound with no port change. The method
   returns storage order (**oldest-first**, matching the fake's `lineage()` + the contract's
   "newest last" convention); the **handler reverses** to newest-first for the response.
2. **`current` stays sourced from the pointer `read`; `recent` from the lineage** — two reads,
   not one. Rationale: smallest change to the proven Slice-2 happy path; `current` remains the
   authoritative reigning pointer. Because the pointer == lineage tail (written in one atomic
   EVAL), `current` == `recent[0]` in practice; the only divergence is a sub-30s display race
   during an in-flight crown, which self-heals under the existing `max-age=30` cache.
   _Considered + rejected:_ derive `current = recent[0]` from a single `LRANGE` (one fewer
   Redis call, guaranteed consistency) — rejected to avoid refactoring the Slice-2 read path
   and to keep the pointer authoritative. **Proceeding on the recommendation (two reads).**
3. **AC-C3 (control-char strip) is done SERVER-SIDE in `championIdentity`** (a pure
   `stripControlChars` over `name`/`model`/`handle`), not client-side at render. Rationale:
   one node-tested + **Stryker-mutated** boundary change protects BOTH the podium AND the King
   section (a free retrofit — normal names + the `<script>` C1 name have no C0/DEL chars, so
   Slice-2 tests stay green), and keeps "safe public identity" as single-source knowledge
   (the same reason `championIdentity` exists). This shifts AC-C3 from a "display" concern to
   a boundary concern and lands it in **Slice 3a**. _Alternative:_ a `src/`-hosted pure
   `stripControlChars` imported by `Podium.tsx` (client-side, still node+Stryker, but the King
   stays unsanitized). **✅ CONFIRMED (2026-07-07): server-side in `championIdentity` (3a).**
4. **The Podium owns its own `createResource`** (injectable `fetchRecent` prop, default =
   fetch `/king` → `.recent`), mirroring the King's testable shape — NOT a shared lifted
   resource. The second `fetch("/king")` within 30s is served from the browser HTTP cache
   (`max-age=30`), so it is one network round-trip, not two. Keeps 3b a clean **additive**
   slice (new `Podium.tsx` + nav + CSS) with **zero Slice-2 refactor**. _Alternative:_ lift a
   single `/king` resource to a parent and pass `current`→King / `recent`→Podium (one fetch,
   guaranteed inter-section consistency) — deferred as a future refactor if a third consumer
   appears. **Proceeding on the recommendation (Podium owns its resource).**
5. **Empty Hall (0 Kings) renders an anchored honest empty line, not an omitted section**
   — a deviation from AC-P5's literal "section omitted". Rationale: Slice 3 adds a **static**
   nav "Champions" → `#champions` link; on the **dominant launch state** (empty throne) a
   literally-omitted section leaves that anchor dangling. So the Hall-of-Kings section always
   renders its `#champions`-anchored heading; when `recent` is empty it shows a short honest
   line ("No champions have been crowned yet — clear the gauntlet to be the first") instead of
   fabricating podium steps. This honors AC-P5's **intent** (no fabricated podium / no empty
   medal steps) while keeping the nav anchor valid and matching the King section's
   empty-CTA treatment. _Alternative:_ omit the section AND make the nav "Champions" link
   data-driven (omit it when empty) — rejected as it makes the static nav depend on fetch
   state. **✅ CONFIRMED (2026-07-07): anchored honest empty line (deviates from AC-P5 literal).**
6. **AC-C2 (truncate + `title`) is client-side CSS + attribute** (single-line
   `text-overflow: ellipsis`, full sanitized value in `title`), landing in **Slice 3b** with
   the podium cards (where multiple fixed-height cards sit side by side). No JS truncation
   logic ⇒ no new node helper for C2.
7. **No new endpoint, at most a cosmetic `/spec` summary refresh.** `/king` already exists +
   is advertised; Slice 3 enriches its body. Optionally update the `LIVE_ENDPOINTS` `/king`
   summary to mention "+ the recent lineage (Hall of Kings)" (updates the byte-exact
   `api/spec.test.ts` envelope). No `INPUT_HASH` / `BENCHMARK_VERSION` impact either way.

---

## Slices

Every slice follows RED → GREEN → MUTATE → KILL MUTANTS → REFACTOR. Load `tdd`,
`testing`, `mutation-testing`, `refactoring` before code. **CONFIRM** the slice's ACs with
the human before any code; **STOP** for commit approval after each slice.

### Slice 3a: `GET /king` serves the recent lineage (bounded, identity-only, sanitized)

**Value**: An API client (and, next, the podium UI) can read the recent succession of Kings
for the live version — the throne's history becomes readable over HTTP for the first time,
safely (bounded, identity-only, control-char-sanitized). Extends the one endpoint the UI
already consumes, so no new routing risk.

**Path**: `GET /king` → `api/king.ts` → `handleKing(req, { store, version })` → `store.read`
(current, pointer) **and** `store.recent(version, 3)` (lineage tail) inside one try →
`championIdentity` shaping (+ control-char strip) → `{ current, recent }` newest-first /
`{ current: null, recent: [] }` / `503` / `405`. The new bounded read is a `ThroneStore` port
method satisfied by the fake (`slice(-limit)`) + Upstash (`LRANGE -limit -1`), pinned by the
shared contract spec (fake in-suite + live smoke).

**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.

**Acceptance criteria** (present to human before code):

- **AC-P/K-recent (happy)**: with ≥3 crownings for `BENCHMARK_VERSION`, `GET /king` →
  `200`, body `recent` = the **3 most-recent** identities **newest-first** (`recent[0]` ==
  `current`), each `{ name, model, handle, generation }`.
- **AC-recent-bounded**: with 4+ crownings, `recent` has exactly **3** entries (the oldest is
  dropped) — proven at the contract layer (`recent(v, 3)` on `[a,b,c,d]` → `[b,c,d]`
  oldest-first) AND the handler layer (newest-first `[d,c,b]`).
- **AC-recent-empty**: no King → `recent: []` (and `current: null`).
- **AC-recent-no-leak**: a **lineage of `rules`-carrying champions** yields a response in
  which **no rule/DSL field appears anywhere in `recent[]`** (first-class, like the Slice-2
  `current` no-leak test).
- **AC-C3 (sanitize)**: a champion whose `name`/`model`/`handle` contains C0/DEL control
  characters → those characters are **stripped/replaced** in the response (for `current` and
  every `recent` entry); ordinary names + a `<script>`-laden name are returned **unchanged**
  (Slice-2 tests stay green).
- **AC-503**: `store.read` **or** `store.recent` rejecting → `503
/problems/throne-unavailable` (never a partial/empty 200).
- **AC-port-contract**: `recent(version, limit)` is a `ThroneStore` method; the shared
  `runThroneStoreContract` gains `it()`s for empty-recent, bounded+ordered-recent, and
  version-isolated-recent — passing for the fake in-suite **and** live Upstash smoke.
- **AC-spec (optional)**: the `/king` `LIVE_ENDPOINTS` summary mentions the recent lineage
  (byte-exact `api/spec.test.ts` updated); `INPUT_HASH` / `BENCHMARK_VERSION` unchanged.

**RED**:

- `throne-store.contract.ts` — add `recent` `it()`s: empty version → `recent(v,3)` == `[]`;
  crown a,b,c,d then `recent(v,3)` == `[b,c,d]` (bounded + oldest-first); crown under A →
  `recent(B,3)` == `[]` (version-isolated). (Runs against fake + live smoke unchanged.)
- `throne-store-upstash.test.ts` — `buildRecentRequest` emits `["LRANGE",
"champions:{v}", "-3", "-1"]`; `interpretRecentReply` parses a `string[]` of JSON records
  → `ThroneRecord[]`, and **throws** on an `{ error }` reply (never returns `[]`).
- `handle-king.test.ts` — recent happy (newest-first identities), recent bounded (4 → 3),
  recent empty, recent no-leak (rules never surface), 503-when-recent-throws, AC-C3
  (control-char name sanitized in both `current` + `recent`).
- `champion-identity.test.ts` (or via `handle-king`) — `stripControlChars` removes
  `\x00`–`\x1F` + `\x7F`, leaves normal + `<script>` text intact.
- Mutator scan: the `-limit` sign (vs `limit`), the `slice(-n)` boundary, the `.reverse()`,
  the `??`/`=== undefined` null-vs-empty branches, the strip regex class, the error-throw
  (not empty) in `interpretRecentReply`, the status literals.

**GREEN**: add `recent(version, limit)` to the `ThroneStore` type; fake
`recent = (v,n) => Promise.resolve(entries(v).slice(-n))`; Upstash `buildRecentRequest` +
`interpretRecentReply` + `recent`; `stripControlChars` + widen `championIdentity` to apply
it; `handleKing` — `recent = (await store.recent(version, 3)).map(championIdentity).reverse()`,
return `{ current, recent }`, both reads in the one try; (optional) `/spec` summary + test.

**MUTATE**: `npm run mutation` scoped to `throne-store.ts`, `throne-store-upstash.ts`,
`champion-identity.ts`, `handle-king.ts`, `api/king.ts` (node config). **KILL MUTANTS**:
strengthen the bound/order/newest-first, no-leak, sanitize, and 503-on-either-read
assertions; ask if any survivor is genuinely equivalent.

**REFACTOR**: confirm the Upstash `build/interpret` symmetry reads cleanly; assess whether
the handler's "shape a record list identity-only, newest-first" is worth a tiny named helper
(only if it adds value — a single call site may not warrant it).

**Done when**: all ACs met; contract green for fake (+ live smoke when creds present);
mutation report reviewed; typecheck+lint+format clean; **preview smoke** — `GET /king` →
`200 { current: null, recent: [] }` (in-memory preview store), `/spec` still lists `/king`,
`/validate`+`/fight`+`/` still respond; human approves commit.

### Slice 3b: The page shows the Hall of Kings (podium + sparse states)

**Value**: A returning fan sees the recent succession of Kings on a gold/silver/bronze
podium — or an honest "no champions yet" on the empty launch throne — completing the
"who rules the ring" story with its lineage.

**Path**: `<App>` renders a new `<Podium>` section after `<King>` →
`createResource(fetchRecent)` (prop; default fetches `/king`, returns `.recent`; throws on
non-2xx) → loading → { populated podium | honest empty | error + Retry }. Populated: gold =
`recent[0]`, silver = `recent[1]`, bronze = `recent[2]`, filling only present steps. The nav
grows a `#champions` anchor. Browser-mode tested by injecting `fetchRecent`; smoke-verified on
preview against the real 3a endpoint.

**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`
(+ browser-mode `testing` patterns — inject the fetcher, assert exact text/roles/attrs,
never `toBeTruthy`).

**Acceptance criteria** (present to human before code):

- **AC-P2 (≥3)**: `recent` of ≥3 → three steps; gold shows `recent[0]` (== current), silver
  `recent[1]`, bronze `recent[2]`, each with name / model text + generic head / "Gen N" /
  optional handle.
- **AC-P3 (exactly 2)**: gold + silver filled; **bronze shown dimmed/empty**, no fabricated
  third champion.
- **AC-P4 (exactly 1)**: gold filled; silver + bronze dimmed/empty.
- **AC-P5 (0 — deviation D5)**: the `#champions` section still renders (anchor valid) but
  shows an honest "no champions crowned yet" line — **no fabricated steps**.
- **AC-P6 (duplicates)**: the same `name` on multiple steps with **distinct `generation`**
  renders both (dethroned-then-re-crowned) — not deduped.
- **AC-K5 (loading)**: pending fetch → an accessible loading placeholder (`role="status"`),
  replaced on resolve.
- **AC-K3 (error)**: fetch rejects (incl. 503) → a distinct `role="alert"` state with an
  **enabled Retry** (`refetch`); never rendered as the empty state.
- **AC-C1 (escaping)**: a `<script>`-laden champion name renders as inert text (no `<script>`
  element).
- **AC-C2 (truncate)**: a 64-char name/model/handle renders single-line CSS-truncated with the
  **full value in a `title` attribute**; card heights stay uniform.
- **AC-nav**: the sticky nav gains a `#champions` link; order becomes `["#top",
"#how-it-works", "#king", "#champions", "/spec"]` (Nav + `App.test.tsx` updated). The
  section is a landmark `region` (`id="champions"`, `aria-labelledby`).
- **AC-R1/A1/A2 (carry)**: podium is single-column with no horizontal scroll at ≤360px; Retry
  is keyboard-reachable with a visible focus ring; medal rank is conveyed by **text/label, not
  color alone**; text + interactive elements meet WCAG AA on the dark theme.

**RED**: `web/src/Podium.test.tsx` — render `<Podium fetchRecent={...}>` with: a
never-resolving promise (K5 loading); a `recent` of 3 (P2 — three steps, exact champions,
gold==recent[0]); exactly 2 (P3 — bronze dimmed/empty, no 3rd name); exactly 1 (P4); `[]`
(P5 — anchored empty line, no steps); duplicate name across two generations (P6 — both
render); a `<script>` name (C1 inert); a 64-char name (C2 — element `title` == full value); a
rejecting fetcher (K3 error + Retry enabled; Retry with a then-resolving fetcher shows the
podium). Extend the nav test to the 5-anchor order. Assertions are exact (roles, exact text,
exact hrefs/attrs) — browser `.tsx` is not Stryker-mutated.

**GREEN**: `web/src/Podium.tsx` (resource + loading/error/empty/populated branches + the
three medal steps with generic-head placeholders + truncation markup); extend `KingView` /
reuse `Champion`; wire `<Podium>` into `App.tsx` after `<King>` (decision-11 order: … →
Current King → Hall of Kings); add the `#champions` nav link + `.champions`/`.podium`/
`.podium-step`/`.gold`/`.silver`/`.bronze`/truncation/dimmed-step CSS.

**MUTATE**: no new node/pure logic in 3b (AC-C3 sanitization shipped server-side in 3a) ⇒
Stryker scope unchanged (durable web-layer rule — browser components guarded by strong exact
assertions, not Stryker). If a non-trivial pure helper emerges (e.g. a `recent → [gold,
silver, bronze | empty]` step-mapper), extract it to a node-tested `.ts` under `src/` and
mutate it. **KILL MUTANTS**: n/a for the browser layer beyond the exact-assertion discipline.

**REFACTOR**: assess sharing the section-landmark + champion-card shape with
`King`/`HowItWorks`/`Cta` (a `<ChampionCard>` reused by King's card and the podium steps is a
plausible DRY win — only if it adds value, and behavior-preserving so King's tests stay green).

**Done when**: all ACs met; browser suite green; typecheck+lint+format clean; **preview
smoke** — the deployed page shows the **anchored empty Hall of Kings** (preview store is
in-memory, so `recent: []`) and the nav `#champions` anchor scrolls to it; `/king` returns
`200 { current: null, recent: [] }`; `/validate`+`/fight`+`/` still respond; human approves
commit.

## Pre-PR Quality Gate (each slice)

1. `npm run mutation` (node scope) — review survivors (3a; 3b adds none unless a step-mapper
   helper is extracted).
2. `refactoring` assessment.
3. `npm run typecheck && npm run lint && npm run format:check`.
4. `npm test` — full node + web suites green (incl. the extended throne-store contract; the
   live Upstash smoke runs only when creds are present).
5. **Preview smoke** on the Vercel preview URL: curl `/king` (now `{ current, recent }`) ·
   `/spec` (still lists `/king`) · `/validate` · `/fight` · `/` · a bogus route (SPA
   fallback); `agent-browser` a11y snapshot of the Hall-of-Kings section for 3b.

## Out of scope (Slice 4+)

- **SVG logo marks + `modelToLogo` normalization + hero** (AC-L1–L3) → **Slice 4** (the
  podium + King use a generic head placeholder until then; Slice 4 retrofits real marks).
- **Full scrollable "Hall of Kings"** beyond the 3-step podium (`recent` capped at 3) →
  parked follow-up (a larger bounded `recent(version, n)` — no port change).
- **Reign-length / defenses leaderboard** (a ranked podium) → parked; needs new persisted
  metrics (crown timestamps + a defense counter). Slice 3 is succession, not ranking.
- **Fights "coming soon" teaser** (AC-R3/A3) → **Slice 5**.

---

_✅ Archived 2026-07-07 (Slice 3 shipped: 3a `GET /king` recent lineage #204 + 3b Hall of
Kings podium #205). The spanning `plans/public-page-{decisions,stories}.md` stay live until
the whole public-page feature ships (per [[archive-plans-not-delete]]). Do not delete._
