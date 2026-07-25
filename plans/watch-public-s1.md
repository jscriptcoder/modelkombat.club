# Plan: S1 — A visitor can reach the fight viewer from anywhere on the site

**Branches**: one per slice, per repo convention — Slice 1 `feat/watch-season-note`,
Slice 2 `feat/watch-public-links`, Slice 3 `feat/watch-discovery`
**Status**: Active — Slice 1 in progress
**Story**: `plans/watch-public-stories.md` § S1 · **Decisions**: `plans/watch-public-decisions.md` D1–D10

## Goal

Promote `/watch` from its dark launch to a public destination — reachable from the nav and the
home page, discoverable by crawlers and reading LLMs, and honest about the season it covers.

## Scope guard

`web/` only. **No new fetch**, no `src/` change, no `api/` change, no engine or TCB contact.
The live fight cards are S2; the 👁 affordance is S3. All product decisions are resolved —
this plan sequences them, it does not re-open them.

## Acceptance Criteria

The story's eight ACs, mapped to slices:

- [ ] AC8 — `/watch` states the fights shown are the current season's, and that older seasons are archived and not currently browsable → **Slice 1**
- [ ] AC1 — the nav's **Fights** item navigates to `/watch` (a real `<a href>`, not a scroll anchor) → **Slice 2**
- [ ] AC2 — on `/watch`, the nav's **Fights** item carries `aria-current="page"` → **Slice 2**
- [ ] AC3 — the **prerendered** home HTML contains a link to `/watch` and no `aria-disabled` element → **Slice 2**
- [ ] AC4 — the home Fights section still carries `id="fights"`, so `/#fights` resolves → **Slice 2**
- [ ] AC5 — the string "in development" appears nowhere on the home page → **Slice 2**
- [ ] AC6 — `sitemap.xml` lists `https://modelkombat.club/watch`, and no `/watch/{id}` → **Slice 3**
- [ ] AC7 — `llms.txt` documents `GET /replay` (both public URL forms + size caveat) and `/watch` → **Slice 3**

## Testing regime (project constraint)

`web/` is **not Stryker-reachable**, so mutation testing is `N/A` for every slice here. The
substitute is mandatory and non-negotiable:

1. **Exhaustive exact-assertion tests.** Assert exact strings and exact `href` values, never
   loose `/season/i`-style regexes on the values that carry the behavior — a loose matcher
   survives the string mutant that a public-facing copy change exists to prevent.
2. **A manual mutator scan** before each PR: walk `mutation-testing`'s
   `resources/mutator-rules.md` over the diff by hand and record, per surviving-mutant class,
   which assertion kills it.

Three vitest projects are in play (`vitest.config.ts`): `node`, `web` (browser mode), and
`web-ssr` (Node prerender path). **`web-ssr` runs only from the repo root** — a known gotcha.

## Slices

Three PRs, ordered so no intermediate state is self-contradictory. Slice 2 deliberately
bundles the nav and the home section: shipping the nav pointing at `/watch` while the same
page still renders a "Replays — in development" disabled button would be an incoherent
intermediate state, which is exactly the case where splitting is wrong.

---

### Slice 1: `/watch` states which season's fights it is showing

**Value**: anyone who reaches `/watch` today — by direct URL, and after Slice 2 by any route —
sees a page that no longer implies a complete all-time history. Shipped first so the page is
honest _before_ we advertise it. If Slices 2 and 3 never happen, this still leaves the viewer
better than it is now.

**Path**: visitor loads `/watch` → `ReplayApp` → `ReplayPage` → `ReplayList` renders its
heading and season note → observable in the DOM in every load state.

**Class**: Behavior change.

**Required implementation skills**: `tdd`, `testing`. `mutation-testing` → **`N/A`** (`web/` is
outside Stryker's reach; substitute is the exact-assertion regime + manual mutator scan above).
`refactoring` → assess after GREEN; likely `N/A` for a copy change.

**Reduction program**: `N/A`.
**Transition/terminal evidence**: `N/A`.

**Acceptance criteria** (present and confirm before writing code):

1. Given `/watch` with fights present, the page states the fights shown are the **current
   season's**.
2. Given `/watch` with an **empty** archive, the same season note still renders — after a
   season wipe this is the sentence that explains _why_ the list is empty, so it must not be
   hidden behind the ready branch.
3. The note also renders in the **loading** and **error** states (achieved structurally: the
   note lives beside the `<h1>`, outside the `<Switch>`, so it cannot diverge per state).
4. The note states that older seasons are **archived and not currently browsable** — not
   "deleted", not "lost".
5. No version string (`v20`) is hardcoded in the copy — the page must not go stale on the next
   bump. (`web/src` never imports `src/`, so it cannot read `BENCHMARK_VERSION`; the copy stays
   version-agnostic by design.)

**RED**: extend `web/src/pages/replay/ReplayList.test.tsx` (browser project). Drive all four
load states through the existing injected `load` seam and assert the exact season sentence is
present in each. A separate case asserts no `v`-digit version token appears in the rendered
text.

**GREEN**: add the note beside the `<h1 class="replay-title">` in `ReplayList.tsx`, outside the
`<Switch>`. Update the heading text per D8. Minimal CSS in `replay.css` if the note needs its
own treatment.

**MUTATE or alternate evidence**: mutation testing **`N/A`** — record the rationale. Alternate
evidence: exact full-sentence assertions (so a string-literal mutant dies), the four-state
sweep (so a "move it inside the Switch" mutant dies), and the manual mutator scan.

**KILL MUTANTS**: `N/A` — apply the manual scan instead; record which assertion kills each
candidate mutant class.

**REFACTOR**: assess; expected `N/A`.

**Done when**: ACs 1–5 hold, `npm test` green, typecheck/lint/format clean, manual mutator scan
recorded, human approves the commit.

---

### Slice 2: A visitor reaches the fight viewer from the home page and the nav

**Value**: the headline of the whole story. The dead "Replays — in development" button becomes
a real link, and the nav's **Fights** item stops scrolling to a teaser and starts navigating to
the viewer. After this PR `/watch` is genuinely public for humans.

**Path**: visitor on `/` (or `/ring`, or `/watch`) → shared `Nav` → `/watch`; **and** visitor
on `/` → Fights section → `/watch`. The prerendered no-JS HTML carries the same link, so a
crawler or reading LLM sees it without executing anything.

**Class**: Behavior change.

**Required implementation skills**: `tdd`, `testing`. `mutation-testing` → **`N/A`** (see
regime). `refactoring` → assess after GREEN.

**Reduction program**: `N/A`.
**Transition/terminal evidence**: `N/A`.

**Acceptance criteria** (present and confirm before writing code):

1. The nav's **Fights** item is `<a href="/watch">` with no `target` — a same-tab primary
   destination, like `Ring` (AC1).
2. Rendered with `current="watch"`, the **Fights** item carries `aria-current="page"`; rendered
   with no `current`, it carries none (AC2).
3. `ReplayApp` renders `<Nav current="watch" />` so `/watch` actually marks itself.
4. The home Fights section renders a link whose `href` is `/watch` and whose accessible name
   names watching the fights; it contains **no** element with `aria-disabled="true"` and no
   natively `disabled` control (AC3).
5. The section is still a region named by its heading with `id="fights"` (AC4).
6. The rendered home page contains no occurrence of the string "in development" (AC5).
7. The **prerendered** home HTML (`renderToString`, no JS) satisfies 4, 5 and 6 — this is the
   crawler/LLM view and is asserted in the `web-ssr` project, not only in the browser one.
8. Both `Nav.tsx` and `Fights.tsx` reference `WATCH_PATH` from `shared/lib/paths.ts` rather
   than a hardcoded string — `paths.ts` is documented as the one place that names every URL.

**RED**:

- `web/src/shared/components/Nav.test.tsx` — the existing exact `hrefs` array assertion flips
  `/#fights` → `/watch` (it is already an exhaustive ordered assertion, so it catches an added,
  dropped, or reordered item for free). Add an `aria-current` case for `current="watch"` and a
  no-`current` case.
- `web/src/pages/home/Fights.test.tsx` — **the three existing cases assert the disabled-button
  behavior we are deliberately removing.** They are replaced, not repaired; note this in the PR
  description so it does not read as deleting inconvenient tests. New cases cover ACs 4–6.
- A new `web/src/pages/home/fights.ssr.test.tsx` in the `web-ssr` project, mirroring
  `arsenal-preview.ssr.test.tsx`: `renderToString` the home app and assert the `/watch` link is
  present and `aria-disabled` / "in development" are absent (AC7).
- `web/src/pages/replay/ReplayApp` coverage for AC3.

**GREEN**: repoint the nav item to `WATCH_PATH`; widen `NavProps["current"]` to
`"ring" | "watch"`; pass `current="watch"` in `ReplayApp`; rewrite `Fights.tsx` as the static
frame — heading + one honest sentence + `<a href={WATCH_PATH}>` — keeping `id="fights"` and the
`aria-labelledby` wiring. Retire the `.replay-play` disabled-button styling if nothing else uses
it.

**MUTATE or alternate evidence**: mutation testing **`N/A`**. Alternate evidence: the exhaustive
ordered `hrefs` array assertion, exact `href` equality (not `toContain`), explicit _absence_
assertions for `aria-disabled` and "in development", and the SSR-project assertion proving the
no-JS path — plus the manual mutator scan.

**KILL MUTANTS**: `N/A` — manual scan; pay specific attention to string-literal and
conditional-boundary mutants around the new `current === "watch"` branch (the `"ring"` branch
must be proven still live by its existing test).

**REFACTOR**: assess whether `Nav`'s two `current` branches want a small shared helper; only if
it adds value.

**Done when**: ACs 1–8 hold, `npm test` green (all three projects, run from the repo root),
typecheck/lint/format clean, manual mutator scan recorded, human approves the commit.

---

### Slice 3: Crawlers and reading LLMs can discover the fight archive

**Value**: `/watch` enters the sitemap so it can be indexed, and `llms.txt` names `GET /replay`
as a scouting tool — an LLM handed the site URL can now learn that a fight archive exists and
study the King's behavior without ever seeing its DSL. This is the half of D1 that serves the
"must be readable by an LLM" constraint.

**Path**: crawler fetches `/sitemap.xml` → finds `/watch`; reading LLM fetches `/llms.txt` →
finds `GET /replay` + `/watch`. Both are served static files, exercised through a real `fetch`
in the browser project.

**Class**: Behavior change (the observable behavior of two published machine-facing surfaces).

**Required implementation skills**: `tdd`, `testing`. `mutation-testing` → **`N/A`** (static
content assets; no mutable logic). `refactoring` → `N/A`.

**Reduction program**: `N/A`.
**Transition/terminal evidence**: `N/A`.

**Acceptance criteria** (present and confirm before writing code):

1. `sitemap.xml` parses as well-formed XML (no `<parsererror>`) and contains exactly one `<loc>`
   equal to `https://modelkombat.club/watch` (AC6).
2. `sitemap.xml` contains **no** `<loc>` matching `/watch/` + an id — permalinks are
   content-hashed and evictable and must not be indexed independently (AC6, and consistent with
   `replay.html`'s canonical already pointing at `/watch`).
3. `llms.txt` documents `GET /replay` under **API endpoints**, naming the list URL `/replay`
   **and** the item URL `/replay/{id}` — the public forms. The internal `?id=` form (a
   `vercel.json` rewrite target) must not appear (AC7).
4. The `/replay` entry states it returns behavior, never the DSL, and carries an explicit
   payload-size caveat for the item response (AC7, D5).
5. `llms.txt` lists `/watch` under **Optional** as the human viewer (AC7).

**RED**: a new `web/src/pages/replay/watch-discovery.test.tsx` in the browser project, mirroring
`web/src/pages/variety/variety-discovery.test.tsx` exactly — `fetch("/sitemap.xml")` parsed with
the real `DOMParser`, and `fetch("/llms.txt")` string assertions. Include the _negative_
assertions (no `/watch/{id}` loc, no `?id=` form) as their own cases.

**GREEN**: add the `/watch` `<url>` block to `web/public/sitemap.xml` (with `lastmod` and a
priority consistent with its siblings) and the two `llms.txt` entries per D5.

**MUTATE or alternate evidence**: mutation testing **`N/A`** — these are static assets, not
logic. Alternate evidence: exact-URL equality against a real XML parse, explicit negative
assertions, and the manual mutator scan over the diff.

**KILL MUTANTS**: `N/A` — manual scan.

**REFACTOR**: `N/A`.

**Done when**: ACs 1–5 hold, `npm test` green, typecheck/lint/format clean, manual mutator scan
recorded, human approves the commit.

---

## Pre-PR Quality Gate

Before **each** of the three PRs:

1. **Mutation evidence** — `mutation-testing` is `N/A` for every slice (`web/` is outside
   Stryker). Record the `N/A` rationale _and_ the completed manual mutator scan; a PR without
   the scan does not go out.
2. **Refactoring assessment** — run `refactoring`; record `N/A` when it adds no value.
3. **`npm test` from the repo root** — all three projects (`node`, `web`, `web-ssr`). `web-ssr`
   will not resolve if run from `web/`.
4. **`npm run typecheck`, `npm run lint`, `npm run format:check`** clean.
5. **DDD glossary check** — `N/A`, this project does not use a DDD glossary.

## Out of scope (confirmed, do not drift)

- Any home-page fetch or fight cards → **S2**.
- `/king` `replayId` or the 👁 affordance → **S3**.
- Cross-version replay, K tuning, `ReproRecord` timestamps, `/ring` board-row deep links →
  parked in `plans/watch-public-decisions.md`.
- SEO head work on `replay.html` — **already correct**: it ships title, description, canonical,
  OG tags and `robots: index, follow`, and `robots.txt` allows all. Only the sitemap entry is
  missing.

---

_Project convention: when this plan completes, **archive** it under `docs/archive/` with an
entry in that directory's `README.md`. Never delete it._
