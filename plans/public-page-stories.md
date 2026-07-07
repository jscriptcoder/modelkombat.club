# Public webpage — story split

> Output of `story-splitting` (2026-07-07) over the resolved design in
> `plans/public-page-decisions.md`. Vertical, user-visible child stories — each
> end-to-end and demonstrable. Feeds `planning` (one slice at a time), then TDD.

## Parent

A visitor to **modelkombat.club** lands on a single page that (a) makes them
understand what ModelKombat is and how to enter, and (b) shows **who currently rules
the ring** — the live King and the recent lineage — with the coming replay feature
teased. **Constraint:** it spans a brand-new frontend stack (Vite+Pixi+Solid, not yet
scaffolded), a new backend read surface, real deploy-integration risk, and asset work
— too large and too component-shaped for one PR.

Actors: **newcomer** (understand + how to enter), **returning fan / competitor** (who's
King now, the lineage), and **us as operator** (does the new app deploy cleanly next to
the existing functions?).

## Recommended First Slice

**A visitor lands on a real ModelKombat page that explains the game and how to enter —
served by the new Solid app, deployed, with `/spec` · `/validate` · `/fight` still
working.**

**Why this first:** it burns the biggest unknown — the Vite+Solid app coexisting with
the existing static `public/` + serverless functions + rewrites on Vercel (outDir
collision, rewrite precedence, build command) — _while already delivering value_ (a real
explainer + CTA, strictly better than today's placeholder). Every later slice rides on a
proven deploy path. This is the walking skeleton / zero-feature release.

## Split Candidates

| #   | Slice (actor + capability)                                                                                                | Value                                                                      | Includes                                                                                                                                                                                                                                                                                                                                                                             | Defers                                                                                      | Acceptance examples                                                                                                                                                             | Release                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | **Newcomer understands the game + how to enter** (walking skeleton)                                                       | Understand-the-game value + burns deploy-integration risk                  | `web/` Vite+Solid app; Vercel build wiring (`buildCommand`/`outputDirectory: web/dist`); "How it works" (4 steps); CTA → `GET /spec` + a `POST /fight` snippet; footer; minimal sticky nav; placeholder text hero                                                                                                                                                                    | Live King data; podium; SVG hero art; brand logos; fights teaser; Pixi (see Warnings)       | Visiting `/` renders the explainer + CTA from the built Solid bundle; `/spec`, `/validate`, `/fight` still respond; dark theme                                                  | **Shippable** (replaces the placeholder)                   |
| 2   | **Returning fan sees who currently rules the ring (or that it's open)**                                                   | The live headline — who's King _now_; empty throne → a "claim it" hook     | `GET /king` returning the **reigning** champion **identity-only** (name·model·handle·generation), version-scoped to `BENCHMARK_VERSION`, **reusing the existing `ThroneStore.read` + `incumbentOf` shaping** (no port change); advertised in `/spec` `LIVE_ENDPOINTS`; King section with loading/error/**empty-throne CTA**; minimal identity display (model as text + generic head) | Predecessors/podium (needs lineage read); rich brand logos                                  | With a crowned King: `/king`→`200` identity JSON, page shows name/model/gen. Empty throne: page shows "The throne awaits — be first" → `/spec`. Never returns the DSL.          | **Shippable** (empty state is the likely launch reality)   |
| 3   | **Fan sees the recent lineage of Kings on a podium** (Hall of Kings)                                                      | The succession / hall-of-fame; honest sparse states                        | Add a bounded **lineage/recent read** to the `ThroneStore` **port + Upstash adapter + in-memory fake**, extending the shared `runThroneStoreContract` spec (fake in-suite + live smoke); `/king` extended with `recent[]` (identity-only); podium UI (gold/silver/bronze) + 1–2-champion sparse states                                                                               | Reign-length/defenses leaderboard (no data); logos                                          | ≥3 Kings → podium shows current + 2 prior (from lineage tail). 1 King → gold filled, silver/bronze dimmed/empty (no fabricated bronze). Endpoint returns a bounded recent list. | **Shippable**                                              |
| 4   | **Visitor is greeted by logo-headed fighters facing off; every champion shows its model's mark** (SVG hero + logo system) | The engaging visual hook + brand identity across the page                  | Static **SVG face-off hero** (3 logo-headed stickmen in stances); in-house brand SVG marks (Claude / OpenAI / Gemini + **generic fallback**); `model→logo` **substring-normalization** util; retrofit King + podium cards to render the real marks                                                                                                                                   | Entrance **animation** (later); Pixi                                                        | Hero renders the 3 marks in karate stances facing center. King with model `"gpt-4o"` → OpenAI mark; `"claude-opus-4-8"` → Claude mark; unknown/absent → generic head.           | **Shippable** (deferrable — page works with the text hero) |
| 5   | **Visitor learns fight replays are coming** (fights teaser + nav finalize)                                                | Sets expectations + advertises the next feature; completes single-page nav | "⏳ Fight replays — in development" section; **disabled play button + tooltip**; finalize sticky-nav anchors across all sections                                                                                                                                                                                                                                                     | Real fight rows / replay (needs title-fight persistence + Pixi viewer — a separate feature) | Section visible; play button disabled, tooltip on hover ("Replays are in development"); nav links smooth-scroll to each section.                                                | **Shippable** (small — may ride along with 1 or 4)         |

## Hardened acceptance criteria (find-gaps, 2026-07-07)

Concrete, testable additions surfaced during the gap pass. Each is tied to a slice.

### AC — `GET /king` response contract (Slices 2–3)

- **AC-K1 (happy path):** Given a crowned King for the current `BENCHMARK_VERSION`, when
  a client `GET /king`s, then it returns `200 application/json` with
  `{ current: { name, model, handle, generation }, recent: [...] }` — **identity only,
  never `rules`/DSL** (assert a test that a champion doc with `rules` never leaks any
  rule field into the response).
- **AC-K2 (empty throne):** Given no King yet for the current version (the likely launch
  state), when a client `GET /king`s, then it returns **`200`** with
  `{ current: null, recent: [] }` — a _success_ response, not an error. The King section
  renders the "👑 The throne awaits — be the first to claim it" CTA → `/spec`.
- **AC-K3 (store unavailable):** Given the throne store (Upstash) is unreachable or
  errors, when a client `GET /king`s, then it returns **`503 application/problem+json`**
  (RFC 9457, via the shared `problem()` envelope — consistent with `/spec` · `/validate`
  · `/fight`). The King section shows a distinct **"⚠ Couldn't reach the ring"** state
  with an enabled **Retry** button; a 503 is **never** rendered as the empty-throne CTA.
- **AC-K4 (method):** Given a non-`GET` request to `/king`, then `405` +
  `Allow: GET` (consistent with the other endpoints).
- **AC-K5 (loading):** Given the King fetch is in flight, the King section shows a
  loading placeholder (skeleton/spinner), replaced on resolve by K1/K2/K3.

### AC — champion identity display (Slices 2–4)

- **AC-C1 (escaping):** Given a champion whose `name`/`model`/`handle` contains HTML/JS
  metacharacters (`<script>`, `"`, `&`, …), when the card renders, then the value appears
  as literal text (Solid auto-escapes) — **no HTML/JS is interpreted** (assert a test with
  a `<script>`-laden name).
- **AC-C2 (length):** Given a name/model/handle up to the 64-char max, the card renders it
  on a **single line, CSS-truncated with an ellipsis** to the card width; the **full value
  is exposed via a `title` attribute** (shown on hover/focus). Card height stays uniform
  across the podium regardless of length.
- **AC-C3 (unicode / control chars):** Emoji, CJK, and RTL text render as plain text
  without breaking layout; **C0/DEL control characters are stripped or replaced for
  display** (defensive — the `BotDoc` `name`/`model` are not guaranteed control-char-free
  the way the `/fight` handle is).
- **AC-C4 (absent optionals):** `model` absent → generic logo + no model label (not the
  string "null"/"undefined"); `handle` absent → the byline omits the handle entirely.

### AC — logo normalization (Slice 4)

- **AC-L1 (roster):** v1 ships **four** inline SVG marks — Claude, OpenAI/ChatGPT,
  Gemini, and a **neutral generic "mystery challenger"** head. No other brand marks.
- **AC-L2 (matching rule):** `modelToLogo(model)` **lowercases** the string and tests
  substrings in a **fixed priority order** — `claude` → (`gpt`|`openai`|`chatgpt`) →
  (`gemini`|`google`|`bard`) — **first match wins**; no match, empty, or absent →
  **generic**. Pinned by a fixture table (e.g. `"claude-opus-4-8"`→Claude, `"gpt-4o"`→
  OpenAI, `"gemini-2.5-pro"`→Gemini, `"weirdmodel"`→generic, `undefined`→generic, and a
  double-match like `"gpt-via-gemini"`→OpenAI to prove the precedence).
- **AC-L3 (a11y):** each mark has an accessible label naming the model
  (`aria-label="authored by Claude"` / alt text) — the logo is never the _only_ signal;
  the model text label accompanies it.

### AC — sparse podium states (Slice 3)

- **AC-P1 (recent size):** `/king` `recent` returns up to the **3 most-recent** lineage
  entries (current + 2 prior) — exactly the podium's need. (A longer scrollable "full
  Hall of Kings" list is a parked follow-up.)
- **AC-P2 (≥3 Kings):** gold = current (lineage tail), silver = prior, bronze = two-prior.
- **AC-P3 (exactly 2):** gold + silver filled, **bronze shown dimmed/empty** — no
  fabricated third champion.
- **AC-P4 (exactly 1):** gold filled, silver + bronze dimmed/empty.
- **AC-P5 (0 Kings):** the podium **section is omitted**; the King section's empty-throne
  CTA (AC-K2) stands alone.
- **AC-P6 (duplicates allowed):** the same author/name may appear on multiple steps
  (dethroned then re-crowned = distinct generations) — **not** deduped.

### AC — responsive & navigation (Slices 1, 5)

- **AC-R1 (mobile):** the page is usable at **≤360px** — sections stack single-column,
  the hero SVG scales/stacks, **no horizontal scroll**.
- **AC-R2 (nav):** the sticky nav collapses to a compact form on narrow viewports;
  anchors **smooth-scroll**, honoring `prefers-reduced-motion` (→ instant jump).
- **AC-R3 (touch):** the fights "in development" state is conveyed by a **visible
  label/badge on the disabled control**; the hover tooltip is an _enhancement only_ (touch
  devices have no hover).
- **AC-R4 (routing):** unknown non-API routes fall back to the SPA index (deep `#anchor`
  links resolve); the three API rewrites (`/spec` · `/validate` · `/fight`) keep
  precedence over the SPA fallback.

### AC — accessibility baseline (all slices)

- **AC-A1 (keyboard):** every interactive element (nav links, Retry, spec CTA, disabled
  play) is reachable in a sensible tab order with a **visible focus ring**.
- **AC-A2 (contrast):** **WCAG AA** contrast on text + interactive elements in the dark
  theme.
- **AC-A3 (disabled control):** the disabled play button uses `aria-disabled` + an
  accessible name ("Replays — in development") — not a bare visually-greyed button.
- **AC-A4 (motion):** `prefers-reduced-motion` is honored (no smooth-scroll; and the
  future hero animation must gate on it too).

### AC — page metadata / sharing (Slice 1)

- **AC-M1:** the page sets a descriptive `<title>` and `<meta name="description">`.
- **AC-M2 (parked):** Open Graph / Twitter-card tags + a social share image are **parked**
  (need an image asset) — v1 ships text meta only.

### Testing strategy (all slices)

- **Backend (`GET /king`, `ThroneStore` lineage read):** TDD in the existing **node
  vitest**, exactly like `api/*.test.ts` — RED→GREEN→MUTATE→KILL→REFACTOR per stage. The
  lineage read extends the shared `runThroneStoreContract` spec (fake in-suite + live
  env-gated Upstash smoke), matching the S4 pattern. AC-K1's "never leaks the DSL" is a
  first-class test.
- **Solid components:** **Vitest browser mode** (Playwright provider) +
  `@solidjs/testing-library` — honoring CLAUDE.md's "prefer Browser Mode for UI tests."
  Introduced in **Slice 1** as its own `web/` vitest project (separate from the node
  suite). Cost accepted: a browser-provider dev-dep + a second vitest config + slower CI.
- **The Vercel deploy/integration is explicitly NOT unit-tested** (the TDD boundary): the
  walking skeleton is **smoke-verified on a Vercel preview URL** (`GET /` → the Solid SPA;
  `GET /spec` → markdown; `/validate` · `/fight` still respond), via the `verify`/`run`
  skills. Stated here so the "no production code without a failing test" rule isn't read
  as broken — infrastructure wiring is verified, not test-driven.

## Parking Lot

- **Persist title fights** (challenger/incumbent identity, outcome, winRate, **seeds**,
  transport-layer timestamp) → makes the fights list _real_ and captures the seeds that
  unlock replay. The natural **next feature** after this page.
- **Hero entrance animation** (choreographed slide-in from different directions).
- **In-page "submit your bot" UI** (paste JSON → `/validate` → `/fight` → live report).
- **Reign-length / defenses leaderboard** (a real ranked podium — needs new persisted
  metrics: crown timestamps + a `king-retained` defense counter).
- **Cross-version "seasons" history** (v1 shows the current version's throne only).
- **Replay viewer** (Pixi rig from the event log) — the true Pixi consumer.
- **Open Graph / Twitter-card + social share image** (AC-M2) — a share preview when the
  page is linked; needs a designed image asset.
- **Full scrollable "Hall of Kings"** — a longer lineage list below the 3-step podium
  (v1 caps `recent` at 3); needs a bounded-but-larger lineage read.
- **404 page** — a styled not-found rather than the soft SPA-index fallback (AC-R4).

## Warnings

- **Pixi has no v1 consumer.** The hero is SVG and replay is deferred, so scaffolding
  Pixi in slice 1 installs an unused dependency. Recommend **Vite + Solid in the
  skeleton, add Pixi in the replay-viewer slice** where it earns its place — but the user
  explicitly chose to scaffold the full stack now, so this is a conscious call, not an
  oversight. Flag at planning.
- **Keep slice 1 honest.** It's easy to frame the walking skeleton as pure "scaffolding"
  (a task). It must ship the real explainer + CTA content so it delivers newcomer value,
  not just a green deploy.
- **Reuse, don't fork, the throne read.** Slice 2's reigning-King read must reuse the
  existing `ThroneStore.read` + `incumbentOf`; only **slice 3** touches the port (the
  lineage read). Don't build a parallel throne path.
- **Vercel integration is the real risk** (engine tsconfig `outDir: dist` vs the web
  build output; `/` serving `web/dist/index.html` while the three rewrites keep
  precedence; function `includeFiles` unaffected). Burn it in slice 1.
- **Slice 5 is thin** — independently shippable, but fold it into slice 1 or 4 if a
  standalone PR feels too small.

## Gaps closed — find-gaps session, 2026-07-07

Resolved (10 gap areas → ACs/sections):

```
[Blocker → AC-K3]              GET /king store-unavailable → 503 + retry state
[Blocker → AC-K2]              Empty throne → 200 { current: null }
[Blocker → Testing strategy]   Solid = browser-mode TDD; deploy = smoke (non-TDD)
[Should  → AC-K1/K4/K5]        /king happy-path (no-DSL-leak) / method / loading
[Should  → AC-C1–C4]           Untrusted champion strings: escape/truncate/unicode/absent
[Should  → AC-L1–L3]           Logo roster (big-3+generic) + matching rule + a11y
[Should  → AC-P1–P6]           Sparse podium 0/1/2/3 + recent=3 + duplicates allowed
[Should  → AC-R1–R4]           Mobile ≤360px / nav collapse / touch label / SPA routing
[Should  → AC-A1–A4]           Keyboard, AA contrast, aria-disabled, reduced-motion
[Should  → AC-M1]              <title> + meta description
```

Parked (owner: this feature's follow-ups):

```
[Nice] AC-M2   Open Graph / social share image (needs a designed asset)
[Nice]         Full scrollable "Hall of Kings" (recent capped at 3 in v1)
[Nice]         Styled 404 page (soft SPA-index fallback for now)
```

## Next Step

Load **`planning`** for **Slice 1** (the walking skeleton) to sequence it into PR-sized
TDD stages. Every planning stage must run the full cycle — load `tdd`, `testing`,
`mutation-testing`, `refactoring`; RED → GREEN → MUTATE → KILL MUTANTS → REFACTOR —
before the next stage (endpoint stages tested like the existing `api/*.test.ts`; Solid
components via **Vitest browser mode**). Optionally run **`find-gaps`** on this split
first to harden the acceptance examples.
