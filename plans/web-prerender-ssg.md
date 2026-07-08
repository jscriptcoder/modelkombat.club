# Plan: Web SSG / Prerender (LLM- & crawler-readable pages)

**Branch**: `feat/web-prerender-*` (one branch + PR per slice — see the repo's "PR per slice" flow)
**Status**: Active

## Goal

Make the `web/` home page (and `/spec-guide`) content **server-visible** to LLMs and
crawlers by prerendering it to real HTML at build time (SSG), while keeping **Current
King** and **Hall of Kings** client-side.

## Problem & approach (resolved via grill-me)

Today `web/index.html`'s `<body>` is just `<div id="root"></div>` + a module script;
all visible content is painted client-side, so a non-JS fetch (LLMs, our own WebFetch,
crawlers that don't execute JS) sees an empty shell. The `<head>` is already static and
rich (title/description/canonical/OG/Twitter/JSON-LD), so link previews already work —
**only the body content is invisible**.

Almost all home content is **static** (hand-curated `readonly` arrays: Hero, HowItWorks,
Arsenal, Gauntlet, Fights, Footer, Nav). Only `King` + `Podium` fetch `/king`. That maps
perfectly to **build-time prerendering with client hydration**, keeping the two dynamic
sections client-side — **not** a SolidStart/SSR-server migration.

### Locked technical decisions (grill outcomes)

1. **Mechanism** — hand-rolled post-build `tsx` script + a Vite **SSR build** of an
   `entry-server.tsx` exporting `renderApp(pathname)`; `vite-plugin-solid({ hydratable: true })`
   on the client build; inject the rendered string into `#root` of the built `index.html`;
   `main.tsx` switches `render()` → `hydrate()` **for the home route**.
2. **Dynamic sections** — `createResource` gated by a `createSignal(false)` source that `onMount`
   flips to `true` (no network on the server; the fetch defers to client-post-hydration — simpler
   than `isServer`, confirmed by Spike 1) + **sync** `renderToString` (does not await resources);
   prerender the **empty-throne / "no champions yet" fallback**. _Spike first_ to confirm the
   server branch and the first client paint
   agree (no hydration mismatch).
3. **Render-time browser APIs** — guard head side-effects (`document.title`/meta in `App`,
   title in `SpecPage`) to client-only via `onMount`; a shared **canonical-origin constant**
   (`https://modelkombat.club`) for `HowItWorks`' displayed URLs on both sides.
4. **spec-guide** — **fully static, no client JS**; content = `renderMarkdown(generateSpec())`,
   **API envelope omitted**; drop `createResource`/runtime `/spec` fetch/`marked`-at-runtime/
   loading-error-Retry/the custom hash-scroll effect (native `#hash` scroll works once content
   is in the initial HTML); `marked` becomes a **build-time** dependency; `main.tsx` ends up
   only ever hydrating `App`.
5. **Output & routing** — Vite's client build keeps `index.html` as its only entry; the
   post-build script synthesizes `dist/spec-guide.html` (own distinct `<head>`: title +
   canonical; reuse the hashed CSS `<link>` parsed from the built `index.html`; no `<script>`);
   explicit `vercel.json` rewrite `/spec-guide → /spec-guide.html` **before** the catch-all
   (the catch-all regex matches `/spec-guide`, so filesystem-vs-rewrite precedence is
   ambiguous without it).
6. **Testing** — TDD the render functions in a **node** vitest project if the SSR-in-vitest
   spike (Slice 2) is cheap; otherwise fall back to a **build-and-assert integration test**
   on `dist/`. Keep the existing browser component tests. (Stryker is node-only in this repo;
   web-presentation logic is covered by exhaustive **exact-assertion** tests + a **manual
   mutator scan**, per established practice.)

### Key ordering constraint (why routing lands in Slice 2)

Once `index.html` holds prerendered **home** content, the SPA catch-all rewrite would serve
that home HTML for `/spec-guide` too — leaking home content into the spec page and, with a
client `render()`, duplicating markup. So Slice 2 must emit a **separate `spec-guide.html`
shell** and add the explicit `/spec-guide` rewrite, keeping the two pages isolated. Slice 3
then upgrades that shell from "empty + CSR `SpecPage`" to "fully static, no JS".

## Failure, recovery & rollout

- **Build-failure policy — fail-fast.** If the SSR build or `scripts/prerender.ts` throws
  (e.g. an unguarded `window.`/`document.` access reaches the server render), the step exits
  **non-zero** so `build:web` fails and **Vercel aborts the deploy, keeping the last good
  deployment live**. We never catch-and-degrade to a plain CSR shell: a silent loss of
  crawler/LLM readability is precisely the regression this feature exists to prevent, so it
  must surface as a red build, not a quiet SEO drop. Trade-off accepted: a prerender bug
  blocks all deploys (including unrelated fixes) until fixed — the prerender path is small and
  covered by tests, so this is the safer default.

- **Hydration verification — manual smoke (no automated hydrate test).** We do **not** add a
  browser-mode test that hydrates the prerendered string and asserts a clean console. Instead,
  "no hydration mismatch" is verified by the reviewer during PR review: build `web`, open `/` in
  Chromium, confirm **no hydration-mismatch warning/error** in the console (a mandatory item in
  the Pre-PR Quality Gate below). Accepted risk: a hydration regression introduced by a _later_
  edit is not caught in CI — only at the next manual smoke.
- **No separate post-build CI content check.** The **Slice 2 render/integration test is the sole
  automated guard** that the page carries content. **Consequence (keep consistent):** this makes
  the Spike-2 testing choice load-bearing — **prefer the build-and-assert integration variant**
  (which reads the real `dist/index.html`) so this guard actually exercises the injected output.
  If Spike 2 instead lands on a node-unit `renderApp` test, the injection/wiring itself rests on
  manual smoke only — call that out in the Slice 2 PR.

- **Rollback per slice.** Each slice is one PR against a static-file deploy, so rollback is
  cheap and independent: **revert the PR** (or **promote the previous Vercel deployment** for an
  immediate fix) — no data migration, no server state, no coupled release. Slice 2's `vercel.json`
  `/spec-guide` rewrite is additive; reverting it simply restores the catch-all behavior.

## Acceptance Criteria (feature-level)

- [ ] A no-JS fetch of `/` returns HTML whose body contains the real section content
      (e.g. "The Arsenal", the Gauntlet fighter names, the empty-throne copy).
- [ ] In a JS browser, `/` **hydrates** the prerendered markup with no hydration-mismatch
      warning; `King`/`Podium` still fetch `/king` and update from fallback → live state.
- [ ] `/spec-guide` returns fully static HTML containing the rendered spec (headings/body),
      with **no** `<script>` tag, and native `#section` deep-links scroll correctly.
- [ ] `/spec` (raw markdown API) and the `api/*` functions, `INPUT_HASH`, and the engine/TCB
      are **untouched**.
- [ ] The Vercel deploy stays **static files** (`outputDirectory: web/dist`); no server runtime added.

## Slices

Every slice follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR. No production code without a
failing test. Load `tdd`, `testing`, `mutation-testing`, `refactoring` before code — and
`front-end-testing` for the browser-mode slices.

---

### Slice 1: Show canonical absolute spec/fight URLs (baked host, SSG-ready)

**Value**: The copy-paste-into-LLM affordances (`HowItWorks` link, Copy-link, starter prompt,
curl snippet) always point at the **real ring** (`https://modelkombat.club`) in every
environment — an absolute URL an LLM can actually POST to — instead of the serving origin.
This also makes `HowItWorks` prerenderable (SSG has no runtime origin at build time).
**Design reversal (approved 2026-07-08)**: this intentionally **reverses** the prior
"follow the serving origin, never a baked-in host" design (`HowItWorks.tsx:5-6` comment;
`HowItWorks.test.tsx:65-73` asserted the URL is _not_ `modelkombat.club`). Reasons: SSG can't
follow a runtime origin, and the starter-prompt feature needs an absolute URL (relative would
degrade it). The two origin-following tests are inverted to assert the canonical host.
**Path**: a single exported `CANONICAL_ORIGIN` constant → `HowItWorks`' `specUrl`/`fightUrl`
compose from it → shown link text, Copy-link clipboard value, starter prompt, and curl snippet
all read the canonical host; `href`s stay the relative `/spec`. Still `render()` (CSR);
otherwise identical. _(The `onMount` head guards and the `isServer` fetcher gate are **not**
here — without SSR no failing test demands them; they land in Slice 2 where the SSR render forces them.)_
**Required implementation skills**: `tdd`, `testing`, `front-end-testing`, `mutation-testing`, `refactoring`.
**Acceptance criteria** _(present to human before coding)_:

- A single exported `CANONICAL_ORIGIN` (`https://modelkombat.club`) is the source of the
  spec/fight URLs shown **and** copied in `HowItWorks`; the `href`s stay the relative `/spec`.
- The shown/copied URLs read `https://modelkombat.club/spec` and `…/fight` in **all**
  environments (localhost/preview/prod), no longer derived from `window.location.origin`.
- The origin-following tests are inverted to assert the canonical host: `HowItWorks.test.tsx:65-73`
  now asserts the shown URL **contains** `modelkombat.club`; `SPEC_URL`/`FIGHT_URL` (HowItWorks
  test) and `App.test.tsx:88,106` assert the canonical host.
- No other behavior change (head guards / fetcher gate deferred to Slice 2).
  **RED**: Invert/rewrite the origin assertions to expect `` `${CANONICAL_ORIGIN}/spec` `` /
  `…/fight` (exact full-URL strings) — fails while the code still reads `window.location.origin`.
  Mutator gaps: exact full-URL assertion on the visible link, the Copy-link clipboard value, the
  starter prompt, and the curl snippet (kills a mutated host/path or a missed call-site); assert
  `CANONICAL_ORIGIN` has no trailing slash so `` `${CANONICAL_ORIGIN}/spec` `` can't gain `//`.
  **GREEN**: Add `CANONICAL_ORIGIN` (`web/src/config.ts`); point `HowItWorks`' `specUrl`/`fightUrl` at it.
  **MUTATE**: Browser project isn't under Stryker — **manual mutator scan** (exact-URL assertions at
  every call site; confirm an emptied/typo'd constant fails a test).
  **KILL MUTANTS**: Add assertions for any surviving call site (Copy-link, prompt, curl).
  **REFACTOR**: Only if the constant wants a shared home (align with `SPEC_PATH` in `routes.ts`).
  **Done when**: All criteria met, manual mutator scan clean, typecheck/lint pass, human approves.

---

### Slice 2: Prerender + hydrate the home page (walking skeleton of the real path)

**Value**: A no-JS fetch of `/` returns the full home content as HTML (LLMs/crawlers can read
it); browsers hydrate it with no re-render flash. This is the core outcome.
**Path**: `vite-plugin-solid({ hydratable: true })` on the client build → new `entry-server.tsx`
exporting `renderApp(pathname)` → Vite SSR build → post-build `scripts/prerender.ts` renders the
home tree with **sync `renderToString`**, injects into built `index.html`'s `#root`, and also
emits a plain `spec-guide.html` **shell** (empty root, keeps CSR `SpecPage`) → `main.tsx`
`hydrate(App)` on the home route, `render(SpecPage)` on the spec route → `vercel.json` gains the
explicit `/spec-guide → /spec-guide.html` rewrite before the catch-all. `King`/`Podium` fetchers
become **source-signal-gated** (a `createSignal(false)` `shouldFetch` flipped in `onMount`) so no
network runs on the server and the prerendered HTML shows their fallback branch; the fetch fires
only after the client hydrates. `App`'s `document.title`/meta side-effects (and `SpecPage`'s title) are wrapped
in **`onMount`** (client-only) — moved here from Slice 1 because the SSR render is the first thing
that makes an unguarded `document.` access throw, i.e. the failing test that demands the guard.
**Required implementation skills**: `tdd`, `testing`, `front-end-testing`, `mutation-testing`, `refactoring`.

**Spike 1 — hydration branch agreement — ✅ RESOLVED (2026-07-08).** Confirmed via a throwaway
`renderToString` spike. **The gate is a source signal, not `isServer`**: `createResource` takes a
`createSignal(false)` "shouldFetch" source that `onMount` flips to `true`. `onMount` never runs on
the server _and_ runs only **after** the client's first hydrate paint, so the signal is `false` on
both sides at initial render → both render the **empty-throne / "no champions yet" fallback** →
they agree. Spike output: `renderToString(<GatedKing/>)` → `<p data-hk="0110">THRONE-AWAITS</p>`
(the fallback branch — not loading, not the champion). This is **simpler than the planned
`isServer`-gated fetcher** (no `isServer` import; the fetch naturally defers to client-post-mount).
The final hydrate-console check stays in manual smoke (per the verification decision above).

**Spike 2 — SSR-in-vitest feasibility — ✅ RESOLVED (2026-07-08): FEASIBLE.** A node-environment
vitest with `solid({ ssr: true, hydratable: true })` renders Solid components to **hydratable** SSR
HTML: spike output `renderToString(<Hello/>)` → `<p data-hk="00">The Arsenal</p>` — the `data-hk`
keys confirm the client `hydrate()` will have the markers it needs. **Decision:** unit-test the
render logic in a node vitest project (fast, clean TDD). To also cover the injection wiring the
find-gaps decision flagged (without a slow in-test build), keep the prerender script's core a
**pure `injectBody(htmlTemplate, body)` function** and unit-test that too; the real build artifact
rests on the mandatory manual smoke + fail-fast build. (The slower build-and-assert-on-`dist`
variant remains available if belt-and-suspenders coverage is wanted.)

**Acceptance criteria** _(present to human before coding)_:

- `renderApp("/")` (node-unit test, resolved Spike 2) contains "The Arsenal", the Gauntlet fighter
  names, the four HowItWorks step titles, and King's empty-throne copy.
- `injectBody(template, body)` (node-unit) places `body` inside the template's `#root`, so the
  prerendered `#root` is **non-empty**; the prerendered King/Podium show the **fallback** branch
  (no fabricated champion), and contain **no** `/king` fetch result.
- In Chromium (browser mode / manual smoke), `/` hydrates with **no** hydration-mismatch console
  warning; after mount, `King`/`Podium` fetch `/king` and render loading→resolved.
- `/spec-guide` still serves an empty-root shell that CSR-renders `SpecPage` (no regression, no
  home content leakage, no duplicated markup).
- `build:web` runs client build → SSR build → prerender script as one pipeline; `web/dist`
  remains the deploy output; the SSR build emits to a **non-deployed** dir **outside `web/dist`**
  (e.g. `web/.ssr/`, gitignored) so the server bundle is never shipped to the CDN.
  **RED**: Node-unit tests (resolved Spike 2): `expect(renderApp("/")).toContain("The Arsenal")` (+
  the other markers, + a "does not contain a champion name / fetch marker" negative), and
  `injectBody` placing a body inside `#root`. Mutator gaps to cover: exact content markers
  (kills an emptied/placeholder root), the negative-fetch assertion (kills a fetcher that runs on the
  server), and a `#root`-non-empty assertion (kills a no-op injection).
  **GREEN**: Add the client `hydratable` plugin option + a node SSR-vitest project, `entry-server.tsx`,
  the SSR build step, `scripts/prerender.ts` (pure `injectBody` + home inject; copy shell →
  `spec-guide.html`), the `createSignal(false)`/`onMount` fetch gates on King/Podium, the `onMount`
  head-side-effect guards on `App`/`SpecPage`, the `main.tsx` hydrate/render split, and the
  `vercel.json` rewrite — minimum to pass.
  **MUTATE**: Node render/integration test under Stryker where applicable; browser hydration behavior
  via **manual mutator scan** (exact markers; confirm a server-side fetch or empty root would fail).
  **KILL MUTANTS**: Strengthen the fallback-branch and no-server-fetch assertions as needed.
  **REFACTOR**: Factor `renderApp`/`prerender.ts` for reuse by Slice 3; only if it adds value.
  **Done when**: All criteria met, both spikes resolved & recorded, no hydration warning, human approves.

---

### Slice 3: Serve `/spec-guide` as fully static HTML (no client JS)

**Value**: A no-JS fetch of `/spec-guide` returns the whole spec as readable HTML; deep-links
work natively; the client bundle shrinks (`marked` + `SpecPage` machinery leave it).
**Path**: `scripts/prerender.ts` renders `SpecPage` with `renderMarkdown(generateSpec())`
(imported like `api/spec.ts` does; **envelope omitted**) into `dist/spec-guide.html` with a
**distinct `<head>`** (title "ModelKombat — Bot authoring spec", canonical
`https://modelkombat.club/spec-guide`), reusing the hashed CSS `<link>` from the built
`index.html`, and **no `<script>`**. `SpecPage` loses `createResource`/`/spec` fetch/runtime
`marked`/loading-error-Retry/the custom hash-scroll effect; `main.tsx` drops the spec route and
only ever `hydrate(App)`s; `marked` moves to a build-time (dev) dependency.
**Required implementation skills**: `tdd`, `testing`, `front-end-testing`, `mutation-testing`, `refactoring`.
**Acceptance criteria** _(present to human before coding)_:

- `dist/spec-guide.html` contains the rendered spec (e.g. the top-level spec heading + a known
  section heading with a slug `id`), has a distinct `<title>` + canonical, links the shared
  stylesheet, and contains **no** `<script>` tag.
- The spec content matches `generateSpec()` (single source of truth; no envelope, no second copy).
- Known section headings carry stable slug `id`s in the static HTML — the **testable proxy** for
  native `#slug` deep-linking (the browser handles the scroll natively, so the custom hash-scroll
  effect is removed; we assert the `id`s exist, not the scroll itself).
- `/spec-guide` is served via the explicit rewrite; `/spec` (raw markdown) is unchanged.
- `marked` no longer ships in the client bundle.
  **RED**: A test (node render/integration per Slice 2's choice) asserting `spec-guide.html` contains
  the known spec heading **and** `expect(html).not.toContain("<script")` **and** the canonical link.
  Mutator gaps: exact heading/slug assertion (kills empty/placeholder render), the no-`<script>`
  negative (kills accidental JS inclusion), canonical-href exact match (kills a wrong/missing canonical).
  **GREEN**: Extend `prerender.ts` to emit static `spec-guide.html`; strip `SpecPage`'s runtime
  machinery; simplify `main.tsx`; move `marked` to build-time use.
  **MUTATE**: As Slice 2 (node under Stryker where applicable; manual mutator scan for presentation).
  **KILL MUTANTS**: Add assertions for any survivor (esp. the no-`<script>` and canonical checks).
  **REFACTOR**: Remove now-dead `SpecPage` states/tests; assess `prerender.ts` shape. Only if valuable.
  **Done when**: All criteria met, bundle no longer contains `marked`, human approves.

## Pre-PR Quality Gate (each slice)

1. Mutation testing — node logic under Stryker; **manual mutator scan** for browser-mode
   presentation (exact-assertion coverage), per repo practice.
2. Refactoring assessment — run `refactoring`.
3. `npm run typecheck` (root + `tsconfig.api.json` + `web/tsconfig.json`) and `npm run lint` pass.
4. Manual smoke (mandatory): build `web`, then (a) a **no-JS fetch** of `/` (and `/spec-guide`
   after Slice 3) shows the content — the actual acceptance signal for this feature — and (b)
   open `/` in Chromium and confirm **no hydration-mismatch warning/error** in the console.

## Accepted consequences

- **Crawlers/LLMs always see the King/Podium _fallback_, never the live champion.** The
  prerendered HTML shows "👑 The throne awaits" / "No champions have been crowned yet" to any
  non-JS fetcher, even when a king reigns — a deliberate consequence of keeping those two
  sections client-side. Accepted: the King is dynamic and secondary; the marketing + spec
  content is what matters for readability, and a build-time snapshot would be stale between
  deploys. Not revisited unless "who is the current king?" becomes a crawler-facing requirement.
- **Build time roughly doubles** (client build + SSR build + prerender script vs. one client
  build). Accepted: the app is tiny and this stays well within Vercel's build limits.

## Notes / out of scope

- `sitemap.xml` + a `robots.txt` sitemap entry are an adjacent crawlability win but **out of
  scope** here.
- Following the repo convention, this plan is **archived** under `docs/archive/` (not deleted)
  when the feature closes; add a `docs/archive/README.md` entry then.

---

_Delete/archive this file when the plan is complete. If `plans/` is empty, delete the directory._
