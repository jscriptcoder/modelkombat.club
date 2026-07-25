# Plan: The home page has one champions section, with the King at its centre

**Branch**: `feat/home-arena-only` (one slice, one PR)
**Status**: Complete — AC1–AC11 met, all gates green (awaiting PR)
**Story**: none — a direct user request (three home-page presentation changes, deliberately batched)

## Goal

The landing page stops saying the same thing twice. The standalone **Current King** section is
removed, because The Arena already renders the reigning champion as its gold step with a `King`
badge. The Arena then reads like a real podium — **silver left, gold centre, bronze right** — and
each step's 👁 road-to-the-throne link moves out of the card body into the card's **top-right
corner**.

## Scope guard

`web/` only. **No `src/` change, no `api/` change**, no engine or TCB contact, no `INPUT_HASH` /
`BENCHMARK_VERSION` (`v20`) movement. The `GET /king` contract is untouched — this slice changes
only how its payload is rendered. No new champion data, no new fetch, no ranking change.

## Acceptance Criteria

- [x] AC1 — the home page renders **no** `Current King` region; the champions heading appears
      exactly once
- [x] AC2 — the reigning champion is still visible on the home page: The Arena's gold step shows
      the name, model logo, handle, `King` badge and 👁 link, exactly as before
- [x] AC3 — the single `GET /king` fetch still feeds The Arena (`current` → gold,
      `recent` → silver/bronze), and its loading / empty / error states are unchanged
- [x] AC4 — the error state's Retry still re-runs that one fetch
- [x] AC5 — **at desktop width the three steps sit silver → gold → bronze left-to-right**, on one
      row
- [x] AC6 — the DOM order of the `<ol>` stays gold → silver → bronze, so rank order is what a
      screen reader, a no-CSS reader and the prerendered HTML all see
- [x] AC7 — **below the 480px breakpoint the steps stack with gold first** (no ordering trick
      leaks into the stacked layout)
- [x] AC8 — each step's 👁 link sits in the **top-right quadrant** of its own step, and inside
      that step's bounds
- [x] AC9 — the 👁 link keeps its accessible name (`Watch {name}'s road to the throne`) and its
      `/watch/{replayId}` href, and is still omitted entirely on steps whose fight is unreachable
- [x] AC10 — no link anywhere in the site points at the now-dead `/#king` anchor
- [x] AC11 — the prerendered no-JS home HTML carries the empty-arena state and **exactly one**
      `href="/king"` pointer (it carried two — one per empty section)

## Facts established by reading the code (not assumptions)

- **`Podium.tsx` already composes `[current, ...recent]`** and badges index 0 as `King`
  (`Podium.tsx:31-35, 92-95`). Everything the standalone King card shows — logo, name, model,
  handle, 👁 — the gold step already shows. The card's only unique contribution is a larger brand
  mark (`.king-head .brand-mark` is `3rem`, `.podium-head .brand-mark` is `2.25rem`). **AC2 is
  therefore satisfied by existing code, not new code.**
- **`Champion` is exported from `King.tsx`** (`King.tsx:11-16`) and imported by `App.tsx`,
  `Podium.tsx` and `Podium.test.tsx`. Deleting that file orphans the type — see P1.
- **Two links point at `/#king`** and both become dead anchors: `Nav.tsx:64`
  (`<a href="/#king">King</a>`) and `RingPage.tsx:610` (`<a class="ring-throne-link"
href="/#king">See the throne</a>`). Asserted in `Nav.test.tsx:80-81`,
  `App.test.tsx:136-137`, `RingPage.test.tsx:491, 914`.
- **`prerender.ssr.test.tsx:117-122` counts `href="/king"` occurrences and expects 2** — one per
  empty section. Removing King makes it 1. This is a real assertion change, not a formality.
- **The browser test project's default viewport is 414×896** (Vitest's documented default; this
  config sets none). 414 is **below** the podium's `max-width: 480px` breakpoint, so _the podium
  renders as a single column in every existing browser test_. AC5 is unobservable without
  widening the viewport first — see P3.
- **`.retry` is shared** by the King and Podium error states (`app.css:466`). It stays.
- **`RoadToThroneLink` will have exactly one consumer** after this slice (`Podium`). It stays a
  component — see P2.
- **`road-to-throne.css` sets `margin-top: 0.5rem`** for the in-flow position it has today; the
  new corner placement must neutralise it, not fight it.

## Planning decisions

### P1 — `Champion` moves to its own module, not into `Podium.tsx`

The type mirrors the `GET /king` contract and has two consumers (`App` owns the fetch, `Podium`
renders it). Putting it in `Podium.tsx` would make the presentational component the owner of a
transport contract and force `App` to import from a sibling view. It moves to
`web/src/pages/home/champion.ts` — a contract module with no JSX, next to the page that reads it.

_Rejected:_ leaving a `King.tsx` that exports only a type (a file named after a deleted section),
and `shared/lib/` (nothing outside the home page uses it).

### P2 — the card owns the 👁 _placement_; the component keeps its _appearance_

`road-to-throne.css` keeps what the glyph looks like (quiet opacity, hover brighten, `em` sizing,
reduced-motion opt-out). Where it sits is a property of the card it is pinned to, so
`position: relative` on `.podium-step` and the absolute offsets live with the podium rules in
`app.css`.

This keeps the component reusable: a future consumer positions it its own way instead of
inheriting an absolute placement that silently depends on having a positioned ancestor.

_Rejected:_ making the component itself absolutely positioned (a hidden requirement on every
future parent), and dropping the component to inline the anchor in `Podium` (loses the one place
the accessible-naming rule is written down).

### P3 — the ordering is CSS `order` inside a `min-width` query, not a DOM reorder

The podium is an `<ol>`: source order **is** rank. Reordering the DOM to put gold second would
make rank 2 the first list item for every screen reader, every no-CSS reader and the prerendered
HTML — a real regression to buy a purely visual arrangement (AC6).

So the three-across arrangement gets `order: 1 / 2 / 3` on silver / gold / bronze, declared inside
`@media (min-width: 481px)` — the exact complement of the existing `max-width: 480px` stack rule.
Scoping it to the wide layout means the stacked layout needs no override at all, so AC7 holds
without a specificity fight between `.podium-step.gold` and `.podium-step`.

**Testing consequence:** the AC5 test must call `page.viewport(1280, 800)` (from `vitest/browser`
— note `@vitest/browser/context` still resolves but warns as deprecated on this version) before
asserting geometry, and the AC7 test must assert at a narrow width. The viewport is per-iframe and
persists between tests in a file, so whichever tests change it must restore 414×896 afterwards or
every later test in the file inherits the wide layout.

## Testing regime (project constraint)

`web/` is **not Stryker-reachable**, so mutation testing is `N/A`. The mandatory substitutes:

1. **Exact-assertion tests** — exact hrefs, exact counts, exact class order, and _relational_
   geometry (which step is left of which; which quadrant the glyph is in) rather than pixel
   values, which would pin the design instead of the behaviour.
2. **A manual mutator scan** over the diff before the PR, recording per surviving-mutant class
   which assertion kills it. This diff's real surface is the `order` values and the breakpoint
   boundary (`481` vs `480`), so those get specific attention.

Three vitest projects: `node`, `web` (browser), `web-ssr`. **`web-ssr` resolves only from the
repo root.**

---

## Slices

One slice, one PR — the user asked for these three changes together. Internally it is three
ordered TDD increments; the removal goes first because it settles where `Champion` lives before
the other two touch `Podium`.

### Slice 1: one champions section, King at the centre, 👁 in the corner

**Value**: a visitor scanning the landing page sees the champions once, arranged the way a podium
is actually arranged, with each champion's fight one glance away instead of buried in the card.

**Class**: Behavior change (presentation), plus one behavior-preserving type move (P1).

**Required implementation skills**: `tdd`, `testing`. `mutation-testing` → **`N/A`** (`web/` is
outside Stryker; substitute is the regime above). `refactoring` → applies to P1's move, with the
untouched `Podium`/`App` suites as preservation evidence.

**Reduction program**: `N/A`. **Transition/terminal evidence**: `N/A`.

#### Increment A — the Current King section is gone (AC1–AC4, AC10, AC11)

**RED**

- `App.test.tsx` — no region named `Current King`; the reigning champion is still reachable
  through The Arena's gold step (name + 👁 href); one `/king` fetch still populates gold and the
  defenders; Retry from the error state re-runs it; a `/king` failure still leaves the fight cards
  rendering. Delete the "same road to the throne in **both** sections" test — there is one section
  now — and retarget the "Arsenal sits between How it works and …" ordering test at The Arena.
- `Nav.test.tsx` — the nav link list no longer contains `/#king`.
- `RingPage.test.tsx` — "See the throne" points at `/#champions`.
- `prerender.ssr.test.tsx` — the prerendered home has no King section and **exactly one**
  `href="/king"`; drop the two King-specific prerender cases.

**GREEN** — move `Champion` to `champion.ts` (P1) and repoint importers; delete `King.tsx`,
`King.test.tsx`, its screenshot directory and the `.king-*` rules in `app.css` (keeping the shared
`.retry`); drop the nav entry; repoint `/ring`'s throne link.

#### Increment B — silver, gold, bronze read left to right (AC5–AC7)

**RED** — `Podium.test.tsx`, importing `shared/app.css` (it does not today, so it currently has no
real styling): at 1280×800 the gold step's left edge sits between silver's and bronze's and all
three share a row; the `<ol>`'s DOM order is still gold, silver, bronze; at 414px the steps stack
with gold's top above silver's above bronze's.

**GREEN** — `@media (min-width: 481px)` block in `app.css` giving silver/gold/bronze
`order: 1 / 2 / 3`.

#### Increment C — the 👁 sits in the card's top-right corner (AC8, AC9)

**RED** — `Podium.test.tsx`: each step's 👁 centre is in the right half **and** top half of that
step's box, and its rect is contained by the step's rect. The existing href / accessible-name /
omitted-when-unreachable tests must pass **unedited** — they are the evidence the move is
placement-only.

**GREEN** — `position: relative` on `.podium-step`; absolute top-right offsets for
`.podium-step .road-to-throne`, neutralising its `margin-top` (P2).

**MUTATE or alternate evidence**: `N/A` — record the rationale plus the manual scan. Specific
mutants to kill: each `order` value swapped or dropped (the left-to-right geometry assertion),
`481` → `480` / `min-width` → `max-width` (the paired wide + narrow tests), the corner offsets
flipped to `left` / `bottom` (the quadrant assertion), and the `.retry` rule deleted along with
the King block (the Retry tests).

**REFACTOR**: assess whether `Podium`'s step body wants extracting once the King card is no longer
its near-duplicate. Only if it adds value.

**Done when**: AC1–AC11 hold, `npm test` green from the repo root (all three projects),
typecheck / lint / format clean, manual mutator scan recorded, a real browser look at both widths,
human approves each commit.

---

## Pre-PR Quality Gate

1. **Mutation evidence** — `N/A` (`web/` outside Stryker). Record the rationale _and_ the
   completed manual scan.
2. **Refactoring assessment** — over P1's move; record the outcome.
3. **`npm test` from the repo root** — `node`, `web`, `web-ssr`.
4. **`npm run typecheck`, `npm run lint`, `npm run format:check`** clean.
5. **Visual sign-off at two widths** — desktop (three across, gold centred, glyph clear of the
   rank label) and ≤480px (stacked, gold first, glyph not colliding with the rank text on a
   narrow card).
6. **Dead-anchor sweep** — no `/#king` left anywhere in `web/`, `docs/` or `public/`.
7. **DDD glossary check** — `N/A`.

## Out of scope (confirmed, do not drift)

- Any podium _elevation_ effect (a taller centre step, raised gold card) — not requested.
- Renaming The Arena, or changing the nav's `Champions` label.
- Changing `GET /king`, ranking, `replayId` resolution, or how many steps the podium has.
- Any change to `/watch`, `/ring`'s behaviour beyond the one repointed href, or the Fights section.
- Enlarging the gold step's brand mark to match the deleted King card's `3rem`.

---

## Evidence record (completed)

**Mutation testing**: `N/A` — `web/` is outside Stryker's reach (Stryker runs the node project
only). Substitute evidence below, per the regime above.

**Manual mutator scan** — walked over the diff; every class below was **injected and confirmed to
fail a test**, not reasoned about:

| Mutant                                                           | Killed by                                                       |
| ---------------------------------------------------------------- | --------------------------------------------------------------- |
| `order` values swapped (gold ↔ silver)                           | "stands the King between the two defenders" (left-to-right)     |
| `@media (min-width: 481px)` → `480px` (off-by-one)               | "stacks the steps gold-first at the widest stacking width"      |
| `min-width` → always-on (centring leaks into the stacked column) | same stacking test                                              |
| `top: 0.5rem` → `bottom`                                         | "pins each step's link to the top-right corner" (top half)      |
| `right: 0.5rem` → `left`                                         | same corner test (right half)                                   |
| `position: relative` removed from `.podium-step`                 | same corner test (glyph escapes the card's bounds)              |
| `<King />` restored in `App`                                     | "says the champions once"; the exactly-one loading/error counts |
| `/#champions` reverted to `/#king` in `Nav` / `RingPage`         | the exact nav-href array; the two `/ring` throne-link tests     |

**Two survivors found and fixed rather than accepted:**

1. `min-width: 481px` → `480px` originally survived because the stacking test ran at 360px — a
   width where both readings behave identically. The test now asserts at **exactly 480px**, the
   last width that stacks, which is strictly stronger.
2. `margin-top: 0` on the pinned glyph survived (removing it shifts the glyph 8px inside the same
   quadrant). Rather than pin a pixel value to kill an equivalent mutant, the **cause** was
   removed: `road-to-throne.css` no longer carries the `margin-top: 0.5rem` it needed for the
   in-flow placement no consumer uses any more, so the override it existed to cancel is gone too.
   Same computed result, one fewer declaration, no equivalent mutant.

**Refactoring assessment**: P1's `Champion` move is behavior-preserving; the untouched `Podium`
content/href/accessible-name tests are the preservation evidence (they pass with no edits, which
is also what proves the 👁 move is placement-only). No further refactor added value — the King
card's deletion left no duplication behind to consolidate.

**Gates**: `npm test` 2403 passed / 14 skipped (81 files, all three projects) · `typecheck` clean ·
`lint` clean · `prettier --check` clean over the changed files. Visual sign-off done at 1280px and
380px against the real built bundle with a stubbed `/king` (three champions).

**Pre-existing condition, untouched**: `web/src/shared/components/Footer.tsx` fails
`prettier --check` on `main` too. Fixing it is unrelated churn, so it is left alone — note that
`npm run format` rewrites the whole repo, so run `prettier --check` scoped to changed files.

---

_Project convention: when this plan completes, **archive** it under `docs/archive/` with an entry
in that directory's `README.md`. Never delete it._
