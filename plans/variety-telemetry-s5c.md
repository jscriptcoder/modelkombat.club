# Plan: Variety web surface — S5c (public `/variety` page)

**Branch**: feat/variety-page
**Status**: Active

## Goal

A newcomer or community member can open `https://modelkombat.club/variety` and read the
frozen gauntlet's move-variety meta — a static, prerendered, no-JS page that renders the
existing `docs/variety.md` board, regenerated at build time so it can never go stale.

## Context & locked decisions (grill-me, 2026-07-13)

S5c is the last variety-telemetry story with a build (S5a is "point the S1b `-- <path…>`
override at a submissions dir" — no build; its only dependency is having submissions).
The scoping doc (`variety-telemetry-stories.md` §Split candidates, S5c row) had it as
"(defer — separate UX surface)". A grill-me pass resolved the design tree against the
existing `web/` precedents (surveyed by an Explore recon of `web/`); the resolved forks:

1. **Shape → prerendered `/variety` page (a `/spec-guide` clone).** The site is a static
   multi-page app (no client router); each route = an HTML shell + a Vercel rewrite + a
   `web/src/shared/lib/paths.ts` registry entry. `/spec-guide` is the exact precedent: a
   purely presentational SolidJS page that renders committed markdown via `marked`,
   **prerendered at build with no client JS**, composed by `renderSpecGuidePage(shell,
spec)` in `web/src/prerender/entry-server.tsx` and written to `dist/spec-guide.html` by
   `scripts/prerender.ts`. `/variety` mirrors it. (Rejected: a bespoke designed HTML
   presentation over the raw board — real tables/badges like Arsenal/Gauntlet — accepts
   hand-curation drift + a design pass; a possible later slice, not this one. Rejected: a
   home teaser linking only a raw `/variety.md`, no rendered page.)
2. **Content source → regenerate at build via `generateVariety()`** (user chose
   pipeline-consistency with `/spec-guide`). `scripts/prerender.ts` calls
   **`generateVariety()` unbundled** (imported from `../src/cli/gen-variety.js`, exactly
   as `generateSpec()` is called at `prerender.ts:43` — run under `tsx` so its
   committed-source reads resolve against the real repo layout), then pipes the board
   markdown through a new `renderVarietyPage` transform. Same generate-at-build lineage as
   the spec ⇒ the page is byte-derived from the generator and can't drift. (Rejected:
   `readFileSync("docs/variety.md")` — cheaper and already drift-guarded by
   `gen-variety.test.ts`, but the user chose consistency with the spec pipeline over
   deviating.)
3. **Discoverability → proportionate, NOT top-nav.** Add `/variety` to
   `web/public/sitemap.xml` + `web/public/llms.txt`, and one human-facing link from the
   Arsenal section (which already deep-links `${SPEC_GUIDE_PATH}#frame-table`, so a
   "how often each move actually gets used" hand-off fits there). **Kept out of the shared
   top `Nav`** — the figures are a caveated reference-population diagnostic, so
   proportionate discoverability beats elevating them to first-class site IA. (Rejected:
   full top-nav treatment like `/spec-guide`; sitemap/llms-only with no human link.)

**Framing travels with the board.** The board already opens with an H1 carrying
`BENCHMARK_VERSION`, a manifest-sourced provenance line, and the static §P7 note (soft
targets + "scan for ⚠"), and its header carries the small-sample caveat. Rendering it
verbatim carries all of that onto the page — **no second web-specific verdict** to drift.

**Non-goal (flag at plan review):** no raw `dist/variety.md` fallback route. The `/spec.md`
fallback exists because the `/spec` _function_ can choke some LLM browsers; `/variety` is
already static crawlable HTML with no function, so a raw `.md` mirror is unnecessary here.
Trivial to add later if wanted.

**Non-negotiable (shared with all of S1a–S5b):** a **serve-time presentation** change only.
It prerenders an existing read-only artifact and touches **no** scoring input — no `sim.ts`
/ `dsl.ts` / `types.ts` / `prng.ts` / `rules.ts` / `benchmark*.ts` / `gen-variety.ts`
change, **no `INPUT_HASH` flip, no `BENCHMARK_VERSION` bump**, `npm run fight`
byte-identical, `docs/variety.md` unchanged. The `web/` layer stays decoupled from
`src/engine` (like Arsenal/Gauntlet) — the only `src/` reach is `scripts/prerender.ts`
importing the already-pure `generateVariety()`.

## Acceptance Criteria

- [ ] **S5c-1 (page renders the board).** `<VarietyPage board={…}/>` renders the board's
      content as HTML: the H1 (carrying `BENCHMARK_VERSION`), the provenance line, the
      static §P7 note, and the fenced telemetry report as a `<pre><code>` block — with
      **no raw markdown leaking** (mirrors `SpecPage.test.tsx`'s no-leak assertions).
      Verified by a browser-mode `VarietyPage.test.tsx`.
- [ ] **S5c-2 (no client JS — static, crawlable).** The prerendered `/variety` output
      ships **no `<script>`** (like `/spec-guide`): `renderVarietyPage` runs `stripScripts`,
      so the page is fully static and server-visible to LLMs/crawlers. Verified by a node
      `prerender.ssr.test.tsx` case asserting body injected, the variety `<title>`, the
      canonical = `${CANONICAL_ORIGIN}/variety`, and no `<script>`.
- [ ] **S5c-3 (source = `generateVariety()` at build).** `scripts/prerender.ts` writes
      `dist/variety.html` = `renderVarietyPage(shell, generateVariety())`, calling
      `generateVariety()` **unbundled** (from `../src/cli/gen-variety.js`) — the same
      generate-at-build lineage as `generateSpec()` → `dist/spec-guide.html`. The render
      transform is pure over its `board` arg (identical input ⇒ identical output), so the
      page can't diverge from the generator.
- [ ] **S5c-4 (routing — path constant + rewrite).** `VARIETY_PATH = "/variety"` is added
      to `web/src/shared/lib/paths.ts`, and `vercel.json` rewrites `/variety` →
      `/variety.html` (mirroring the `/spec-guide` rewrite). The client Vite build is
      unaffected (the page is emitted by the post-build prerender step, not a Vite input).
- [ ] **S5c-5 (discoverable — sitemap + llms + one link, not nav).** `/variety` is listed
      in `web/public/sitemap.xml` and `web/public/llms.txt`, and a human link to
      `VARIETY_PATH` is added from the Arsenal section; it is **NOT** in the shared top
      `Nav`. Verified by browser-mode static-asset tests (`fetch('/sitemap.xml')` +
      `DOMParser`, per the ring-submit precedent) + an Arsenal render test for the link +
      a Nav test asserting `/variety` is absent.
- [ ] **S5c-6 (read-only / no-version invariant).** No scoring-input / engine / TCB file
      changes; `INPUT_HASH` and `BENCHMARK_VERSION` unchanged; `npm run fight`
      byte-identical; `generateVariety()` / `docs/variety.md` unchanged. Verified by
      `git diff --name-only` (only `web/**`, `scripts/prerender.ts`, `vercel.json`, + the
      plan/scoping docs) + the existing `INPUT_HASH` guard staying green.

## Slices

Every slice follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR. No production code without a
failing test. **Web `.tsx` is outside Stryker's scope** (`stryker.config.mjs` mutates
`src/**/*.ts` + `api/**/*.ts` only, node-only runner), as are `web/src/prerender/*` and
`scripts/*` — so per the `public-page-web-ui` precedent, the discipline is **exhaustive
exact-assertion tests + a mandatory manual mutator scan**, not an automated Stryker run,
for everything under `web/` and `scripts/`. Read `.claude/CLAUDE.md` + the testing rules
before writing code.

### Slice 1: the `/variety` page exists end-to-end

**Value**: a visitor (or a shared direct link) can open `/variety` and read the full
prerendered move-variety board — no JS, crawlable, byte-derived from the generator.
**Path**: `VARIETY_PATH` in `paths.ts` → presentational `VarietyPage.tsx` (renders the
board markdown via `marked`) → `renderVarietyPage(shell, board)` in `entry-server.tsx`
(inject body → set variety title → set canonical → `stripScripts`) → `scripts/prerender.ts`
calls `generateVariety()` unbundled and writes `dist/variety.html` → `/variety → /variety.html`
rewrite in `vercel.json`. Discoverability (sitemap/llms/link) is deferred to Slice 2.
**Required implementation skills**: before code, load `tdd`, `testing`, `mutation-testing`,
`refactoring`. Web tests are browser-mode (`.test.tsx`) + node prerender (`.ssr.test.tsx`);
consider `folder-structure` for where the new `web/src/pages/variety/` files live.
**Acceptance criteria**: S5c-1, S5c-2, S5c-3, S5c-4 (+ S5c-6 held throughout). **Present to
human and get confirmation before writing any code.**
**RED**:

- `VarietyPage.test.tsx` (browser) — renders `<VarietyPage board={sampleBoard}/>`, asserts
  the H1 text (with `BENCHMARK_VERSION`), the provenance + §P7 paragraphs, the fenced
  report present as a `<pre>`/`code` block, and **no raw ```/`#` markdown leaks** (mirror
  `SpecPage.test.tsx:60-66`).
- `prerender.ssr.test.tsx` (node) — a `renderVarietyPage(shell, board)` case: body injected
  into `#root`, `<title>` = the variety title, canonical = `${CANONICAL_ORIGIN}/variety`,
  and **no `<script>`** (stripScripts), mirroring the `renderSpecGuidePage` case at
  `prerender.ssr.test.tsx:240-268`.
- Mutator watch (manual): the marked-render call, the `stripScripts` call, the title/canonical
  string literals, and the transform-composition order.
  **GREEN**: add `VARIETY_PATH` to `paths.ts`; **extract the shared markdown renderer** from
  `SpecPage.tsx` into a shared module (e.g. `web/src/shared/lib/render-markdown.ts`) —
  behavior-preserving, `SpecPage.test.tsx` stays green — and reuse it in `VarietyPage.tsx`
  (legit DRY: both render trusted first-party markdown with slug-anchored headings; assess
  per `refactoring` — if extraction adds churn, `VarietyPage` uses `marked` inline and we
  re-assess); add `renderVarietyPage` to `entry-server.tsx`; wire `generateVariety()`
  unbundled + `writeFileSync(dist/variety.html)` in `scripts/prerender.ts`; add the
  `/variety` rewrite to `vercel.json`; run `npm run build` (web) and confirm `dist/variety.html`
  renders.
  **MUTATE**: manual mutator scan over `VarietyPage.tsx` + `renderVarietyPage` + the
  prerender wiring (Stryker doesn't reach `web/`/`scripts/`) — produce a written scan note.
  **KILL MUTANTS**: strengthen the exact-assertion tests for any gap (exact-name kills an
  aria/label leak, a paragraph-unique phrase kills empty copy — the `public-page-web-ui`
  scan lessons).
  **REFACTOR**: assess the `render-markdown` extraction (keep only if it removes real
  duplication) + the `renderVarietyPage`/`renderSpecGuidePage` shared shape.
  **Done when**: S5c-1…S5c-4 met, `npm run build` reproduces `dist/variety.html`, browser +
  ssr tests green, manual mutator scan noted, `git diff --name-only` shows no scoring-input
  touch, human approves the commit.

### Slice 2: the `/variety` page is discoverable

**Value**: crawlers, LLMs, and a human browsing the Arsenal can find `/variety` — the page
becomes reachable, not just direct-link.
**Path**: add `/variety` to `web/public/sitemap.xml` + `web/public/llms.txt`; add a human
link to `VARIETY_PATH` from the Arsenal section (near the existing `/spec-guide#frame-table`
hand-off); **do not** touch the shared top `Nav`.
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.
**Acceptance criteria**: S5c-5 (+ S5c-6 re-verified). **Present to human and get
confirmation before writing any code.**
**RED**:

- A browser-mode static-asset test — `fetch('/sitemap.xml')` + `DOMParser`, assert a
  `<loc>` for `/variety` (per the ring-submit `web-ring-submit` precedent that browser-mode
  `fetch` of `web/public/` static assets works); and an `llms.txt` fetch asserting a
  `/variety` line.
- An Arsenal render test asserting a link whose `href` is `VARIETY_PATH`.
- A `Nav` render test asserting **no** `/variety` link (the "not in nav" decision is a
  first-class assertion, not an omission).
  **GREEN**: add the `sitemap.xml` `<url>` entry (priority ~0.7, below `/spec-guide`'s 0.8),
  the `llms.txt` line, and the Arsenal link.
  **MUTATE**: manual mutator scan (static-content + the link `href`).
  **KILL MUTANTS**: exact-`href`/exact-loc assertions.
  **REFACTOR**: none expected (static additions).
  **Done when**: S5c-5 met, static-asset + Arsenal + Nav tests green, manual scan noted,
  read-only diff confirmed, human approves the commit.

## Pre-PR Quality Gate

Before each PR:

1. Mutation testing — **manual mutator scan** for the changed `web/` + `scripts/` surface
   (Stryker is node-only and does not mutate `web/**`/`scripts/**`); reach exact-assertion
   coverage of every changed presentation line + a written scan note (the `public-page-web-ui`
   precedent). Any `src/**/*.ts` touched (none expected beyond none) would run Stryker.
2. Refactoring assessment — run `refactoring` (the `render-markdown` extraction call).
3. `npm run typecheck` + `npm run lint` + `npm run format:check` pass. `npm run build`
   (web) reproduces `dist/variety.html`. Both `web` (browser) and `web-ssr` (node) vitest
   projects green.
4. Read-only proof: `git diff --name-only main` shows only `web/**`, `scripts/prerender.ts`,
   `vercel.json` (+ the plan/scoping-doc updates) — no `sim.ts`/`dsl.ts`/`types.ts`/`prng.ts`/
   `rules.ts`/`benchmark*.ts`/`gen-variety.ts`; grep confirms `INPUT_HASH` /
   `BENCHMARK_VERSION` untouched; `docs/variety.md` unchanged.

## Flow (mirrors the S5b precedent)

1. **This `docs(plan)` PR merges first** (the "no plan on main" lesson) — the plan + the
   scoping-doc updates (harness decision #12, stories §S5c resolution + the stale-S5b tidy
   already applied on this branch).
2. Then the **Slice-1 TDD PR** (`feat/variety-page`), then the **Slice-2 TDD PR**.
3. Then **archive this plan** to `docs/archive/variety-telemetry-s5c.md` (+ README entry)
   per `[[archive-plans-not-delete]]`, and update `docs/STATUS.md` (variety series → S5c
   shipped; S5a the only remainder).

---

_Archive (don't delete) when complete, per `docs/archive/README.md` + the
`archive-plans-not-delete` rule._
