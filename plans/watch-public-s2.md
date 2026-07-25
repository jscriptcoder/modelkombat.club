# Plan: S2 — A visitor sees the three most recent fights without leaving the home page

**Branch**: `feat/home-fight-cards` (one slice, one PR)
**Status**: Active — not started
**Story**: `plans/watch-public-stories.md` § S2 · **Decisions**: `plans/watch-public-decisions.md` D1, D2, D4
**Depends on**: S1 (shipped — #423–#425, plan archived at `docs/archive/watch-public-s1.md`)

## Goal

The home page's Fights section stops being a signpost and starts showing the three most recent
title fights as named, clickable fighters — degrading back to exactly the signpost S1 built
whenever there is nothing to show.

## Scope guard

`web/` only. **No `src/` change, no `api/` change**, no engine or TCB contact, no
`INPUT_HASH` / `BENCHMARK_VERSION` (`v20`) movement. The 👁 road-to-the-throne affordance is
S3. All product decisions are resolved — this plan sequences them, it does not re-open them.

## Acceptance Criteria

The story's eight acceptance examples, all in this one slice:

- [ ] AC1 — given `/replay` returns ≥3 fights, the section renders **exactly 3** cards, in the
      order `/replay` returned them, each an `<a href="/watch/{id}">`
- [ ] AC2 — given `/replay` returns 1 or 2 fights, exactly that many cards render — no
      placeholder slots
- [ ] AC3 — given `/replay` returns `[]`, the section renders exactly S1's static frame
- [ ] AC4 — given `/replay` rejects, the section renders exactly S1's static frame — no
      `role="alert"`, no Retry button
- [ ] AC5 — while `/replay` is in flight, the section renders exactly S1's static frame
- [ ] AC6 — a rendered card shows both fighters' names and both model logos, and no date and
      no ordinal
- [ ] AC7 — with cards rendered, "Watch all fights →" links to `/watch`
- [ ] AC8 — `/king` failing does not stop the fight cards rendering, and `/replay` failing does
      not stop the King and Arena sections rendering

## Facts established by reading the code (not assumptions)

- **`Fights.tsx` is currently a pure static frame** — `<section id="fights">`, heading, one
  sentence, `<a class="fights-cta" href={WATCH_PATH}>`. Exactly what ACs 3–5 must degrade to.
- **`createClientResource`** (`web/src/shared/lib/client-resource.ts`) holds its source signal
  `false` through SSR *and* the first hydrated paint, flipping true in `onMount`. So the
  prerender renders the **fallback** branch — S1's frame — with no hydration mismatch. **S1's
  `web-ssr` assertions (`href="/watch"` present, no `aria-disabled`, no "in development")
  therefore keep passing unchanged, and that is a guard, not a coincidence.**
- **`loadList`** (`web/src/pages/replay/replay-loader.ts`) already returns exactly the shape
  this needs: `{kind:"empty"}` for `[]`, `{kind:"ready", items}` otherwise, throwing on non-2xx.
  It takes an injectable `fetchFn`. **Reuse it verbatim — do not write a second loader.**
- **`App.tsx` owns the `/king` fetch** and injects it via a `fetchKing?` prop so tests stay
  deterministic. A `Fights` that fetched on its own would fire a real `/replay` inside every
  existing `App` browser test (the vitest dev server has no such route) — so the same injection
  pattern is required, not optional.
- **`replay.css` is imported by `ReplayPage.tsx` only.** The home page loads `shared/app.css`
  and has **no** `.replay-card*` rules. "Reuse the `/watch` card look" is a real code decision,
  resolved as P1 below.
- **`markCollisions`** (`web/src/pages/replay/collisions.ts`) flags cards whose challenger↔King
  name pair repeats, so only those show a 6-char id fragment. Scope on the home page is P2.

## Planning decisions

Two calls the story and D1–D10 do not settle. Both are recorded here rather than made silently
mid-implementation.

### P1 — The card becomes a shared component; `/watch` keeps rendering it unchanged

The fight card is **one piece of knowledge** ("what a fight looks like as a clickable
identity pair") about to have two consumers. Re-implementing it on the home page is the
textbook DRY violation the `refactoring` skill names: the two would drift, and the drift would
be invisible because nothing compares them.

So `FighterIdentity` + the `.replay-card` anchor move out of `ReplayList.tsx` into
`web/src/shared/components/FightCard.tsx`, with the `.replay-card*` rules moved out of
`replay.css` into a `fight-card.css` the component imports itself — styles travel with the
component, so any consumer gets them without importing a page's whole stylesheet.

**Class names are not renamed.** They are stable, `/watch`'s tests reference them, and renaming
would be churn with no behavioral payoff.

This extraction is **not a separate slice**. Extracting first and consuming later would be a
horizontal PR with no observable outcome — the exact anti-pattern `planning` warns about. It
happens inside this slice's GREEN, and `/watch`'s existing `ReplayList` tests are the
preservation evidence that it changed nothing there.

_Rejected:_ a home-local card (drift), and importing `replay.css` on the home page (drags the
title, status, error, empty and player rules into the marketing bundle for three cards).

### P2 — Collision short-ids are computed over the three cards actually shown

`markCollisions` exists so a visitor can tell two otherwise-identical cards apart. That is a
property of what is **on screen**, so the home page runs it over its own three, not over the
full list. A card can therefore show a short id on `/watch` and not on the home page, or the
reverse. That is correct, not a bug: on the home page there is nothing to confuse it with.

_Rejected:_ dropping the marker on home (two indistinguishable cards, which is the exact
problem it was built for), and marking over the full list before slicing (a lone card showing a
mystery id fragment that disambiguates nothing visible).

## Testing regime (project constraint)

`web/` is **not Stryker-reachable**, so mutation testing is `N/A`. The substitute is mandatory:

1. **Exhaustive exact-assertion tests** — exact `href` values, exact card counts, exact ordering.
   A `toContain`-style assertion on an ordered, count-bounded render survives the slice-boundary
   and ordering mutants this slice exists to prevent.
2. **A manual mutator scan** before the PR — walk `mutation-testing`'s `resources/mutator-rules.md`
   over the diff by hand and record, per surviving-mutant class, which assertion kills it. This
   slice has **real arithmetic and boundary surface** for the first time in the arc (`slice(0, 3)`,
   `length === 0`), so the scan is not a formality: `slice(0, 3)` → `slice(0, 2)` / `slice(1, 3)`
   / `slice(0, 4)` must each die.

Three vitest projects (`vitest.config.ts`): `node`, `web` (browser mode), `web-ssr`.
**`web-ssr` resolves only from the repo root.**

---

## Slices

One slice, one PR. Splitting further would produce a horizontal first half — "extract the card"
or "add the loader" — with no observable outcome for anyone. The story is already the smallest
end-to-end version of itself.

### Slice 1: The home page shows the three most recent fights

**Value**: a first-time visitor sees *named LLM models that actually fought each other* above
the fold-ish, on the page they land on — the "spectacle for newcomers" job (D1). Three rather
than one, because one reads as a demo and three imply a running ladder (D2).

**Path**: visitor loads `/` → `App` → `Fights` → `createClientResource(loadList)` → `GET /replay`
→ newest 3 rendered as `FightCard`s linking to `/watch/{id}` → observable in the DOM, and
degrading to the prerendered static frame in every other state.

**Class**: Behavior change.

**Required implementation skills**: `tdd`, `testing`. `mutation-testing` → **`N/A`** (`web/` is
outside Stryker's reach; substitute is the exact-assertion regime + manual mutator scan above).
`refactoring` → **applies** — P1's extraction is assessed as part of this slice, with `/watch`'s
existing tests as the preservation evidence.

**Reduction program**: `N/A`.
**Transition/terminal evidence**: `N/A`.

**Acceptance criteria** (present and confirm before writing code): ACs 1–8 above, plus:

9. `Fights` takes an injectable `load?: () => Promise<ReplayListLoad>` seam mirroring
   `ReplayList`'s, and `App` threads it through as `loadFights?` mirroring `fetchKing` — so no
   existing `App` browser test fires a real `/replay`.
10. The prerendered home HTML is **unchanged** by this slice: it still contains `href="/watch"`,
    still contains no `aria-disabled` and no "in development". S1's `web-ssr` assertions must
    pass untouched — if they need editing, the fetch is not properly client-deferred.
11. `/watch`'s own rendering is unchanged by P1's extraction — `ReplayList.test.tsx` passes with
    no edits.

**RED**:

- `web/src/pages/home/Fights.test.tsx` — the state matrix, driven through the injected `load`:
  ready-with-5 (exactly 3 cards, exact `href`s, exact order), ready-with-1 and ready-with-2
  (exactly that many, no placeholders), `empty`, rejected, and never-settling. The three
  degraded states assert **the same** thing: the CTA link is present and no card list rendered
  — plus explicit absence of `role="alert"` and of any Retry control (AC4 is a *negative*
  requirement and needs its own assertion, not an inference from "looks like the frame").
- Card content (AC6): both names, both model logos present; no date, no ordinal. Assert the
  absence of a digit-bearing ordinal/date node rather than eyeballing the markup.
- `web/src/pages/home/App.test.tsx` — AC8 both ways: a rejecting `fetchKing` with a resolving
  `loadFights` still renders cards; a rejecting `loadFights` with a resolving `fetchKing` still
  renders the King and Arena sections.
- `web/src/pages/replay/ReplayList.test.tsx` — **no new tests**. Its existing suite is the
  preservation evidence for P1. If it needs an edit, the extraction changed behavior.

**GREEN**:

1. Move `FighterIdentity` + the card anchor into `web/src/shared/components/FightCard.tsx`;
   move the `.replay-card*` rules into `fight-card.css` imported by that component; point
   `ReplayList` at it. `/watch` stays green throughout.
2. `Fights.tsx` gains `createClientResource(props.load ?? loadList)`, renders
   `markCollisions(items.slice(0, 3))` as `FightCard`s plus "Watch all fights →" when ready,
   and returns the existing static frame otherwise.
3. `App.tsx` threads `loadFights` down.

**MUTATE or alternate evidence**: mutation testing **`N/A`** — record the rationale. Alternate
evidence: exact card-count and ordered-`href` assertions (killing `slice` boundary and ordering
mutants), explicit negative assertions for `role="alert"` and Retry, `ReplayList`'s untouched
suite as extraction-preservation evidence, and the manual mutator scan.

**KILL MUTANTS**: `N/A` — manual scan. Pay specific attention to: `slice(0, 3)` boundary
mutants, `items.length === 0` → `!==` / `< 0`, the `??` in `props.load ?? loadList`, and
conditional-negation on the ready branch.

**REFACTOR**: P1's extraction is itself the refactor; assess afterwards whether `Fights` wants
its ready-branch card list pulled out, only if it adds value.

**Done when**: ACs 1–11 hold, `npm test` green from the repo root (all three projects),
typecheck/lint/format clean, manual mutator scan recorded, human approves the commit.

---

## Pre-PR Quality Gate

1. **Mutation evidence** — `N/A` (`web/` is outside Stryker). Record the rationale *and* the
   completed manual mutator scan; a PR without the scan does not go out.
2. **Refactoring assessment** — run `refactoring` over P1's extraction; record the outcome.
3. **`npm test` from the repo root** — `node`, `web`, `web-ssr`. `web-ssr` will not resolve from
   `web/`.
4. **`npm run typecheck`, `npm run lint`, `npm run format:check`** clean.
5. **Visual sign-off** — this slice changes what the landing page looks like. Check the three
   cards on a narrow viewport before the PR: three `/watch` cards were designed for a full-width
   list page, not a home-page section.
6. **DDD glossary check** — `N/A`, this project does not use a DDD glossary.

## Out of scope (confirmed, do not drift)

- 👁 road-to-the-throne, `/king` `replayId` → **S3**.
- Dates, ordinals, thumbnails, animated previews, pagination → deferred by D2.
- Cross-version replay, K tuning, `ReproRecord` timestamps, `/ring` board-row deep links →
  parked in `plans/watch-public-decisions.md`.
- Any change to `/watch`'s own rendering — P1 is a behavior-preserving move, nothing more.

---

_Project convention: when this plan completes, **archive** it under `docs/archive/` with an
entry in that directory's `README.md`. Never delete it._
