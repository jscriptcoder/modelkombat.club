# Plan: Public page — Slice 1 (walking skeleton)

**Branch**: `feat/public-page-skeleton`
**Status**: ✅ COMPLETE — all three slices merged (1a #195, 1b #196, 1c #197, 2026-07-07);
every feature-level AC met + preview-smoked. Archived under `docs/archive/`.

## Goal

A newcomer visiting `/` lands on a real ModelKombat page — served by a new `web/`
Vite+Solid app deployed on Vercel — that explains what the game is and how to enter, while
`/spec` · `/validate` · `/fight` keep working.

## Source of truth

- Story: **Slice 1** in `plans/public-page-stories.md` ("Newcomer understands the game +
  how to enter").
- Applicable hardened ACs (same file): **Testing strategy**, **AC-R1–R4**, **AC-A1–A4**,
  **AC-M1**.
- Design: `plans/public-page-decisions.md` (dark theme; `web/` sibling dir; Vite+Solid;
  Vercel `buildCommand`/`outputDirectory`; `api/` + rewrites untouched).

This plan covers **only** Slice 1. Live King data (Slice 2), the podium (Slice 3), the SVG
hero + logos (Slice 4), and the fights teaser (Slice 5) are separate plans.

## Acceptance Criteria (feature-level, Slice 1)

- [x] Visiting `/` on a Vercel preview serves the built Solid SPA (not the old
      `public/index.html` placeholder); `GET /spec` still returns markdown; `/validate` +
      `/fight` still respond. _(smoke-verified, non-TDD — Testing strategy)_ — **1a: verified
      on preview `…fh8993ukb…` 2026-07-07: `/`→200 SPA (`/assets/index-*.js`), `/spec`→200
      markdown, `/validate`+`/fight`→405 `problem+json` POST-only.**
- [x] The page renders a "How it works" explainer (the 4 steps) and a CTA to `GET /spec`
      plus a `POST /fight` snippet. _(Slice 1b)_ — **1b: verified on preview `…exk2hio7q…`
      2026-07-07 (a11y tree: `region "How it works"` + 4 ordered step headings + `link "Read
the spec"` + the curl snippet).**
- [x] A slim sticky nav (anchors to the sections that exist in Slice 1: How it works ·
      Spec ↗) + a footer; smooth-scroll honors `prefers-reduced-motion`. _(AC-R2, AC-A4 —
      Slice 1c)_ — **1c: `navigation "Primary"` + `contentinfo` landmarks; CSS-native
      reduced-motion gate.**
- [x] Usable at ≤360px with no horizontal scroll; keyboard-navigable with a visible focus
      ring; WCAG AA contrast on the dark theme. _(AC-R1, AC-A1–A2)_ — **dark theme + `pre`
      in-container scroll in 1a; single-column steps in 1b; nav flex-wrap + `:focus-visible`
      ring in 1c; high-contrast palette (`--fg` #e6e8ee / `--muted` #aab2c0 on `--bg`
      #0b0e14).**
- [x] Unknown non-API routes fall back to the SPA index; the 3 API rewrites keep
      precedence. _(AC-R4, smoke-verified)_ — **1a: `/nope`→200 SPA index; `/validate`+`/fight`
      → 405 from the functions (rewrites win over the `/(.*)` catch-all).**
- [x] `<title>` + `<meta name="description">` are set and descriptive. _(AC-M1)_ — **1a.**

## Resolved decision — Pixi deferred (2026-07-07)

**Scaffold Vite + Solid only in 1a; Pixi is deferred** to the replay-viewer slice (its
real consumer), since `find-gaps` flagged Pixi has no v1 consumer (the hero is SVG, replay
is deferred). 1a's `web/` deps: `solid-js`, `vite`, the browser-mode vitest + Playwright
provider, `@solidjs/testing-library` — **no `pixi.js`**. (Reverses the earlier "scaffold
the full stack" choice; recorded in `plans/public-page-decisions.md` §3.)

## Risk retired (Slice 1a — RESOLVED 2026-07-07)

**Mutation testing on browser-mode components does NOT work — fallback adopted.**
Empirically confirmed in 1a: a dedicated Stryker config pointing its Vitest runner at the
`web/` browser-mode project (`vitest: { configFile: "web/vitest.config.ts" }`, both with
and without `related: false`) fails the dry run — _"Vitest failed to find test files
related to mutated files" → "No tests were executed."_ Stryker's `@stryker-mutator/vitest-runner`
cannot drive a Vitest 4 browser-mode project.

**Adopted split (durable rule for all web slices):**

- **Pure logic** (helpers, reducers, `modelToLogo`, `smoothScrollEnabled`, …) lives in
  **node-testable `.ts`** modules under `src/` (or a node-covered path) and IS
  mutation-tested by the normal `npm run mutation` (globs `src/**` + `api/**`).
- **Browser-mode components** (`web/**/*.tsx`) are NOT Stryker-mutated. They are guarded by
  **strong, mutation-aware browser assertions** written in the RED phase: assert exact
  values (exact heading name, `href` `=== "/spec"`, opaque-dark-bg, title/meta regexes),
  never `toBeTruthy`.
- Stryker's own config is pinned to the Node project
  (`vitest: { configFile: "vitest.node.config.ts" }`) so `npm run mutation` stays green and
  fast (verified: `src/engine/prng.ts` scoped run = 100%, 4/4 killed).

`App.tsx` (1a) has no branching pure logic to extract; its five browser tests assert exact
values, so the fallback fully covers it.

## Slices

Every slice follows RED→GREEN→MUTATE→KILL MUTANTS→REFACTOR. **No production code without a
failing test.** Before code changes in each slice, load `tdd`, `testing`,
`mutation-testing`, `refactoring` (+ `front-end-testing`/`react-testing` patterns adapted
to Solid). Present each slice's acceptance criteria to the human and get approval before
writing any code. Wait for explicit commit approval at the end of each slice.

### Slice 1a: The `web/` app deploys at `/` and shows a minimal real page — ✅ DONE

**Status**: ✅ Merged in **PR #195** (`6d79661`, 2026-07-07). Preview smoke green (see
feature-level ACs above). The Vercel-integration risk is burned; later slices ride the
proven `web/` build path.

**Value**: Newcomer sees a real (if minimal) ModelKombat page at the root; **the whole
Vercel-integration risk is burned** so every later slice rides a proven path.
**Path**: browser → Vercel serves `web/dist/index.html` at `/` → Solid mounts `<App/>`
(site name + tagline + a working `/spec` link) → `<title>`/meta set. The three API rewrites
(`/spec` · `/validate` · `/fight`) still resolve to the functions. Intentionally skipped
here: the explainer, CTA, nav, footer (later slices); the SVG hero (Slice 4).
**Required implementation skills**: load `tdd`, `testing`, `mutation-testing`,
`refactoring` before code.
**Acceptance criteria** (confirm before coding):

- Mounting `<App/>` renders the site name "ModelKombat" as the page heading and a link
  whose `href` is exactly `/spec` and whose accessible name references the spec.
- The app sets `document.title` to a descriptive string containing "ModelKombat" and a
  `<meta name="description">`. _(AC-M1)_
- Dark theme applied; no horizontal scroll at 360px. _(AC-R1, AC-A2)_
- _(smoke, non-TDD)_ On a Vercel preview: `GET /` → the SPA HTML; `GET /spec` → markdown;
  `/validate` + `/fight` respond; an unknown route (`/nope`) → the SPA index. _(AC-R4)_
- _(harness)_ One browser-mode test runs green; the MUTATE step runs on it (see Risk).
  **RED**: a `@solidjs/testing-library` browser-mode test — `render(() => <App/>)` then assert
  the "ModelKombat" heading and `getByRole('link', { name: /spec/i })` has `href="/spec"`;
  a second test asserts `document.title` matches `/ModelKombat/`. Anticipated mutants: the
  title/heading **StringLiteral** and the `/spec` href literal (assert exact values, not
  `toBeTruthy`); a `BooleanLiteral`/removed-attribute on the link.
  **GREEN**: `web/{index.html, vite.config.ts, tsconfig.json (DOM+JSX), src/main.tsx,
src/App.tsx}`; the `web/` vitest browser-mode project (Playwright provider); minimal
  `App` (heading, tagline, `/spec` link, head title/meta). Update `vercel.json`:
  `buildCommand: "vite build"` (or the web build script) + `outputDirectory: "web/dist"`;
  keep the 3 rewrites + `functions.includeFiles`. Remove/replace `public/index.html`.
  Decide Pixi per the Open decision above.
  **MUTATE**: run `mutation-testing` on `web/src/App.tsx` (prove Stryker↔browser-mode works).
  **KILL MUTANTS**: strengthen the title/href/heading assertions until the string + attribute
  mutants die. Ask the human if a survivor's value is ambiguous.
  **REFACTOR**: assess only if it adds value (e.g., extract a `<SiteHead>` if head-setting is
  noisy). Keep it minimal.
  **Done when**: all 1a criteria met, preview smoke green, mutation report reviewed, human
  approves commit.

### Slice 1b: Newcomer reads how it works and gets the links to enter — ✅ DONE

**Status**: ✅ Merged in **PR #196** (`7468de7`, 2026-07-07). Preview smoke green (rendered
content confirmed via headless a11y snapshot). `<HowItWorks/>` + `<Cta/>` live at `/`.

**Value**: The "simple to understand + how do I get in on this" payload — a newcomer
understands the loop and has the spec link + fight snippet to act on.
**Path**: `<App/>` renders `<HowItWorks/>` (the 4 steps, data-driven) + `<Cta/>` (a
prominent "Read the spec ↗" link → `/spec` and a `POST /fight` code snippet), each an
accessible, responsive section with an anchor id. Intentionally skipped: nav + footer (1c);
copy-to-clipboard on the snippet (parked nice-to-have).
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.
**Acceptance criteria** (confirm before coding):

- `<HowItWorks/>` renders **exactly 4** steps, in order, with the expected step text
  (source `/spec` → write a JSON bot → clear the 6-bot gauntlet → challenge the King), from
  a `steps` data array. Section has a heading + `id="how-it-works"`.
- `<Cta/>` renders a link with accessible name "Read the spec" and `href="/spec"`, plus a
  `<pre><code>` snippet whose text contains `POST` and `/fight`.
- Both sections readable at ≤360px (single-column, no h-scroll) and keyboard-focusable with
  a visible focus ring. _(AC-R1, AC-A1)_
  **RED**: browser-mode tests — assert `getAllByRole('listitem')` (or step nodes) has length
  4 and the ordered text; assert the spec link `href` + name; assert the snippet substring.
  Anticipated mutants: **ArrayDeclaration/length** (killed by count + all-4-labels), step
  **string literals** and **order** (assert full ordered text), the href literal, the snippet
  substring literal.
  **GREEN**: `HowItWorks` + `Cta` components + the `steps` data; wire into `App`.
  **MUTATE**: run on the new components + any pure data mapping.
  **KILL MUTANTS**: strengthen until step-count, ordering, and literal mutants die.
  **REFACTOR**: assess (e.g., a shared `<Section>` wrapper) only if it adds value.
  **Done when**: criteria met, mutation report reviewed, human approves commit.

### Slice 1c: Visitor navigates the page via a sticky nav + footer — ✅ DONE

**Status**: ✅ Merged in **PR #197** (`1997eba`, 2026-07-07). Preview smoke green (a11y tree
on `…6vsm3085g…`: `navigation "Primary"` with brand + How it works + Spec links, `region`
sections, `contentinfo` footer; loaded at `/#how-it-works`). **Design deviation:** smooth
scroll is **CSS-native** (`@media (prefers-reduced-motion: no-preference) { html {
scroll-behavior: smooth } }`) rather than the sketched JS `smoothScrollEnabled` helper —
simpler, native, more robust; chosen at the 1c CONFIRM gate. So 1c added **no** node-side
logic (browser-only, like 1b); the gate is verified by a CSSOM assertion.

**Value**: The single page feels navigable (the "very easy to navigate" goal); ties the
sections together and finalizes the cross-cutting nav/routing/motion a11y.
**Path**: `<App/>` renders a slim **sticky `<nav>`** with smooth-scroll anchors to the
sections that exist in Slice 1 (How it works · Spec ↗ external) + a `<footer>`; the nav
collapses to a compact form on narrow viewports; smooth-scroll gates on
`prefers-reduced-motion`. Note in the plan: the nav **grows** (King · Champions) as Slices
2–3 add those sections.
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.
**Acceptance criteria** (confirm before coding):

- `<Nav/>` is a `<nav>` landmark rendering an in-page anchor to `#how-it-works` and an
  external "Spec ↗" link to `/spec`; links are keyboard-reachable in order with a visible
  focus ring. _(AC-A1)_
- Smooth-scroll is applied only when `prefers-reduced-motion` is **not** set; with reduced
  motion, navigation jumps instantly (no smooth behavior). _(AC-A4)_
- A `<footer>` landmark renders. Nav is compact/usable at ≤360px (no h-scroll). _(AC-R1,
  AC-R2)_
- _(smoke, non-TDD)_ Re-confirm on preview: deep link `/#how-it-works` scrolls to the
  section; unknown route still falls back to the SPA. _(AC-R4)_
  **RED**: browser-mode tests — `getByRole('navigation')` contains a link with `href` ending
  `#how-it-works` and the external `/spec` link; a test that the reduced-motion branch is
  taken (e.g., a `smoothScrollEnabled(matchMedia)` pure helper returns `false` when
  `prefers-reduced-motion: reduce` — mutation-test this helper in node-vitest per the pure-
  logic split). Anticipated mutants: the anchor **string literal**, the reduced-motion
  **ConditionalExpression** (both arms — assert enabled AND disabled cases), the
  `<nav>`/`<footer>` roles.
  **GREEN**: `Nav` + `Footer` components; a pure `smoothScrollEnabled(mql)` helper (node-unit
  tested); sticky + collapse CSS; reduced-motion gate. Verify the SPA-fallback config.
  **MUTATE**: run on the components + the `smoothScrollEnabled` helper.
  **KILL MUTANTS**: kill both arms of the reduced-motion conditional + the anchor/role
  mutants.
  **REFACTOR**: assess only if valuable.
  **Done when**: criteria met, preview smoke green, mutation report reviewed, human approves
  commit.

## Pre-PR Quality Gate (each slice)

1. Mutation testing — run `mutation-testing` (node-vitest for pure logic; the browser-mode
   path proven in 1a).
2. Refactoring assessment — run `refactoring`.
3. `npm run typecheck` (base + `tsconfig.api.json`; add the `web/` tsconfig to the
   typecheck chain), `npm run lint`, `npm run format:check` all pass.
4. The node test suite + the new `web/` browser-mode suite both green.
5. `docs/spec.md` drift test + `INPUT_HASH`/`BENCHMARK_VERSION` unchanged (this slice
   touches no scoring input — a guard, not a task).

## Notes for later slices (carried, not built here)

- Nav grows with King · Champions anchors when Slices 2–3 land.
- Pixi added with the replay viewer (its real consumer), per the Open decision.
- OG/social image (AC-M2), full scrollable Hall of Kings, styled 404 — parked (stories
  doc Parking Lot).

---

_Slice 1 complete → this plan is **archived (not deleted)** under `docs/archive/` with a
`docs/archive/README.md` entry, per the standing "archive plans, don't delete" rule. Its
siblings `public-page-decisions.md` + `public-page-stories.md` stay **live in `plans/`** as
the design/roadmap source for the still-pending Slices 2–5 (mirroring the platform-http-api
precedent); they get archived when the whole public-page feature ships. Slices 2–5 get their
own plans._
