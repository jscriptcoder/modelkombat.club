# Public webpage — resolved design decisions

> Output of a `grill-me` session (2026-07-07). This is the design-of-record for the
> ModelKombat public marketing/landing page. Next step: `story-splitting` to carve
> PR-sized child stories, then `planning` per slice, then TDD. **Design only — no
> code written yet.**

## What we're building

An engaging, simple **single-page** public site at `/` that (a) explains what
ModelKombat is, (b) shows the **live King of the Hill** and a **Hall of recent
Kings**, and (c) teases the coming **fight-replay** feature. It replaces today's
minimal `public/index.html` placeholder.

## The data reality that shaped every decision

Grounding facts discovered up front (they drove the choices below):

- **Current King** exists in the Upstash throne store as a `ThroneRecord`
  (`{ champion: BotDoc{name, model?, rules, handle?}, generation, handle? }`) — but
  there is **no HTTP read endpoint**. Only `POST /fight` touches the throne (write).
- **Past champions**: the throne keeps an append-only **lineage** (`RPUSH` list), but
  the `ThroneStore` port has **no lineage read method** (only the in-memory fake
  exposes `lineage()`). "Podium 1/2/3" has no ranking data — lineage is _chronological
  succession_; there are **no timestamps, no defense counts, no per-fight records**.
- **Previous fights**: **not persisted at all** (invariant #1 — any fight
  reconstructs from seeds+bots; nothing is stored as a tape). Title-fight seeds/winRate
  are returned in the `/fight` response but thrown away.
- **Frontend**: no framework installed (zero runtime deps); today's site is one static
  `public/index.html` linking to `/spec`. The `api/` functions already live **outside**
  `src/` (so the "single `src/`" rule governs the engine TCB, not the whole repo).
- **Likely launch state**: the throne may be **empty** (clearing the 6-bot gauntlet is
  hard — blind attempts topped 4/6; durable persistence only went live today). The
  empty/sparse state is the _dominant_ early reality, not an edge case.

## Resolved decisions

1. **Data strategy — live King + coming-soon fights.** Drive the King/podium from
   **real** data via one new read endpoint; the fights section is designed but shown
   **disabled / "in development."** Not mocked; not a full persist-everything build.

2. **Podium meaning — recent Kings by succession.** Podium = current King (gold) + the
   two prior Kings (silver, bronze) from the **tail of the lineage**. Framed as a
   **"Hall of Kings"** (succession), **not** a competitive leaderboard. Zero new
   persistence. (A real reign-length/defense-count leaderboard is a future story that
   needs new persisted metrics.)

3. **Frontend tech — Vite + SolidJS now; Pixi deferred.** Stand up the planned viewer
   stack, but **Pixi is deferred to the replay-viewer slice** (its real consumer) —
   `find-gaps` established it has no v1 consumer (the hero is SVG, replay is deferred), so
   scaffolding it now would be an unused dep. Slice 1 installs **Vite + Solid** only. Tests
   via **Vitest browser mode** (+ `@solidjs/testing-library`), TDD per CLAUDE.md.
   _(Amended 2026-07-07 during planning — supersedes the original "Vite + Pixi + Solid
   now".)_

4. **App layout — sibling top-level `web/` dir.** `web/` (its own `vite.config`,
   `tsconfig` with **DOM + JSX**, `index.html`, `*.test.tsx`), sibling to `src/` and
   `api/` — matching how `api/` already sits outside `src/`. It imports engine **types**
   from `../src/engine`. Vercel: `buildCommand: vite build`, `outputDirectory: web/dist`;
   the `api/` functions + rewrites stay untouched. (Watch: the engine tsconfig `outDir`
   is `dist/` — build the web app to `web/dist` to avoid collision.)

5. **King exposure — identity only, never the DSL.** The read endpoint returns
   `name`, `model`, `handle`, `generation` for the King **and** its two predecessors —
   **never** the champion's `rules`/DSL. Consistent with `/fight`'s `incumbent` block;
   preserves the reigning bot's competitive edge. `model` is the visual hook (drives the
   logo). **Backend work:** add a `lineage`/recent read to the `ThroneStore` port +
   **Upstash adapter** (durable store currently only reads the _reigning_ record) + the
   in-memory fake, under the existing shared port contract spec; add a new
   version-scoped read endpoint (working name **`GET /king`**) returning
   `{ current, recent: [...] }`; advertise it in `/spec`'s `LIVE_ENDPOINTS`.

6. **Hero — static SVG face-off now, animate later.** Ship the three **logo-headed
   stickmen** already in karate stances facing off, composed in **SVG/CSS**. The
   entrance choreography (fighters sliding in from different directions) is a **later
   slice**. **Pixi is reserved for the replay viewer**, not the hero.

7. **Empty/sparse states — first-class.** Empty throne → an inviting **"The throne
   awaits — be the first to claim it"** moment (links to `/spec`, explains how to
   submit). 1–2 champions → the podium fills only the steps it has (gold, or
   gold+silver); **no fabricated bronze**.

8. **Fights section — honest "coming soon" teaser.** One section: **"⏳ Fight replays —
   in development,"** describing what's coming (replay any title fight tick-for-tick),
   with a **disabled play button + tooltip**. **No rows, no fabricated data.**
   Persisting real title fights (challenger/incumbent identity, outcome, winRate,
   **seeds**, a transport-layer timestamp) is the **immediate next slice** — it makes
   the list real _and_ captures the seeds that unlock replay.

9. **Participation / CTA — explainer + link-out.** A concise **"How it works"** (LLM
   reads the spec → emits a JSON bot → clears the 6-bot gauntlet → challenges the King)
   - a prominent CTA to **`GET /spec`** and a short **`POST /fight`** snippet. **No
     in-page submission UI** in v1 (a live "paste JSON → fight → see the report" panel is
     a strong future slice).

10. **Logos — curated marks + normalize + fallback.** Case-insensitively substring-match
    the free-text `model` (`claude`→Claude, `gpt`/`openai`/`chatgpt`→OpenAI,
    `gemini`/`google`→Gemini, + a few likely others) to a **simple in-house inline SVG
    mark**; unmatched or absent → a **neutral "mystery challenger"** head. Hero uses the
    three headline brands. Marks are lightweight nominative SVGs (not official brand
    assets); keep them inline/CSP-safe.

11. **Page skeleton — story-first + slim sticky nav.** Order: **Hero → How it works →
    Current King → Hall of Kings → Fight replays (coming soon) → footer.** A slim sticky
    top nav with smooth-scroll anchors (**King · Champions · How it works · Spec ↗**).

## Defaults taken (not separately grilled — confirm if wrong)

- **Version scoping:** show the **current `BENCHMARK_VERSION` ("v19") throne only**. A
  version bump is a throne reset ("season"); a subtle version/"season" label lets a
  future reset read correctly. Cross-version history is out of v1 scope.
- **Theme:** **dark** (matches the existing placeholder + the fighting-game vibe).
- **Data load:** client-side fetch of the King endpoint via a Solid resource with
  explicit **loading + error** states; a short `Cache-Control` on the endpoint (the King
  changes rarely).
- **Retiring the placeholder:** the current `public/index.html` is replaced by the built
  `web/` app; the `/spec`, `/validate`, `/fight` rewrites keep precedence over `/`.

## Open items for planning (non-blocking)

Several originally-open items were **resolved by the `find-gaps` pass** — see the hardened
AC blocks in `plans/public-page-stories.md`:

- ✅ **Read-endpoint contract:** `GET /king` → `200 { current, recent }` (identity only);
  empty throne → `200 { current: null, recent: [] }`; store unavailable → `503
problem+json`; non-GET → `405`. `recent` capped at **3** (podium need). (AC-K1–K5, P1.)
- ✅ **Logo roster:** **big-3 + generic fallback** (4 SVGs); case-insensitive substring
  match, fixed priority, first-match-wins. (AC-L1–L3.)
- ✅ **Testing strategy:** browser-mode TDD for Solid components, node-vitest TDD for the
  endpoint + the `ThroneStore` lineage read (shared contract spec), deploy **smoke-verified
  (non-TDD)** on a preview URL.
- Bounded lineage read on Upstash (`LRANGE` last 3) — implementation detail for Slice 3.
- Create the 4 SVG marks + the stickman rig for the hero (Slice 4).
- Nominative-use / trademark sanity check on the marks (keep simple).
- Vercel build wiring details (outDir vs engine `dist/`, `/` → `web/dist/index.html` with
  the SPA fallback for unknown routes, function `includeFiles` unaffected).

## Recommended next step

`story-splitting` to carve this into PR-sized vertical slices — candidate spine:

1. **`web/` scaffold + deploy skeleton** (Vite+Pixi+Solid app builds, deploys, serves a
   trivial page at `/`; `/spec` etc. still work; Vitest browser mode green).
2. **`GET /king` read endpoint + `ThroneStore` lineage read** (port + Upstash + fake,
   identity-only, version-scoped; advertised in `/spec`).
3. **Page sections consuming real data** (King + Hall of Kings + empty/sparse states).
4. **Static SVG hero** (logo-headed stickmen face-off) + logo normalization.
5. **How-it-works + CTA + fights "coming soon" teaser + nav/footer.**

Then `planning` per slice, PR per slice, TDD throughout.
