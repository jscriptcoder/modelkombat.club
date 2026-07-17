# Plan: Replay viewer — S3 · Browse the King's fights

**Branch**: per-slice (each slice cut its own branch / PR).
**Status**: ✅ **Complete** — all 3 slices merged (#321, #322, #323). Being archived to `docs/archive/`.

## Progress / resume state (2026-07-17 — story complete)

- ✅ **Slice 1 — permalink player** — **MERGED** (PR #321, squashed to `main` @ `5c0fb12`).
  `/watch/{id}` plays a fight; a 404 → no-retry "no longer available" + "← All fights" back-link;
  a transient 5xx → retry. Shipped: `replay-route.ts` (`replayIdFromPath`), `loadById`
  (404→not-found, else throw), `ReplayFight.tsx`, `ReplayPage.tsx` dispatcher over
  `location.pathname`, the `/watch/(.*)` → `replay.html` rewrite, `.replay-back`/`.replay-fight` CSS.
- ✅ **Slice 2 — the browsable list at `/watch`** — **MERGED** (PR #322, squashed to `main` @
  `205d166`). `/watch` now renders the King's title fights as a newest-first card grid
  (`<a href="/watch/{id}">`), identity-only (name + model / name-only / truncate + `title`), with an
  honest empty state (→ `/ring`) and a retryable error. The autoplay bridge was retired: deleted
  `ReplayLatest.tsx` + the `loadReplay` two-step loader; rewrote their tests into list tests; added
  `loadList` + `ReplayList.tsx`; corrected `replay.html` head copy + the `ReplayApp` "until S4"
  comment. Verified end-to-end on the Vercel preview.
- ✅ **Slice 3 — repeat-challenge collision disambiguator** — **MERGED** (PR #323, squashed to
  `main` @ `c529630`). A pure `markCollisions(summaries)` (`collisions.ts`) flags exactly the entries
  whose challenger-`name` + King-`name` pair repeats — keyed by `JSON.stringify([challenger, king])`
  so distinct pairs never concatenate-conflate and names with quotes/specials escape; `> 1` = collides.
  `ReplayList.tsx` renders `id.slice(0, 6)` as a muted-mono `.replay-card-id` chip **after `vs` /
  before fighter[1]** (preserving fighter[1] as `:last-child` right-alignment) on flagged cards only.
  No `src/` / `api/` / TCB touch. Verified: full suite green, manual mutator scan documented, and both
  the negative (all-unique → 0 chips) and positive (synthetic collision via init-script fetch patch)
  cases smoke-tested on the Vercel preview.
- ▶️ **STORY COMPLETE — archiving.** All three slices merged; every whole-story AC met (below).
  This file is being moved to `docs/archive/replay-viewer-s3.md` (+ README index entry, never
  deleted). The only remaining viewer roadmap item is **S4 transport** (scrub / speed / frame-step —
  its own grill-me → planning story).

## Goal

A spectator can browse the King's title fights as a card list at `/watch` and open any
one — including via a shareable `/watch/{id}` permalink — to watch it play back.

## Context & scope (read before slicing)

- **Web-only story.** S1 already shipped the full `/replay` API in `src/http/handle-replay.ts`:
  `GET /replay` returns identities-only `ReplaySummary[]` (newest-first, bootstrap-filtered,
  `200 []` when empty, `public, max-age=30`); `GET /replay/{id}` returns `{ tape, fighters }`
  or **`404 /problems/replay-not-found`** on any miss (immutable cache). **No `src/` / `api/`
  change is needed** — every S3 decision is a `web/` concern.
- **Decisions:** `plans/replay-viewer-decisions.md` → _"S3 grill-me — resolved (2026-07-17)"_
  (route structure, nav mechanism, not-found, loader split, card disambiguator, dark launch).
- **Route model:** `/watch` = the browsable list (index); `/watch/{id}` = the permalink player.
  One `replay.html` SPA parses `location.pathname` at mount to choose the view. Cards are plain
  `<a href="/watch/{id}">` — full-page navigation, **no router**.

## Non-negotiable invariants (all preserved — this is a viewer-only change)

- **#1 determinism / no persisted tape** — untouched; the API reconstructs on demand (S1).
- **TCB / security / `INPUT_HASH` / `BENCHMARK_VERSION`** — untouched; no engine or DSL code runs.
- **`web/src` never imports from `src/`** — the viewer consumes `/replay` JSON via the
  local `replay-contract.ts` mirror only.

## Testing regime (inherited from S2 — `web/` is not Stryker-reachable)

`stryker.config.mjs` mutates only `src/**` + `api/**`, so every S3 slice records **Mutation:
N/A (Stryker)** and substitutes the S2 proportionate-evidence regime:

- **Exhaustive exact-assertion browser tests** (Vitest Browser Mode, `--project web`) over
  _every_ view state and branch — assert scene-graph / DOM state and hrefs, never pixels.
- **Pure helpers** (path parsing, collision detection) unit-tested directly with exact
  assertions across their input space.
- **Mandatory manual mutator scan** of each changed file (gate flips, off-by-one on the
  lookback/slice, dropped branches, swapped identities) — documented in the slice write-up.
- **`agent-browser` preview smoke** (out-of-band) for the permalink open, the not-found
  state, the list, and a card click-through.

## Acceptance Criteria (whole-story done bar)

- [x] A shared `/watch/{id}` permalink opens and deterministically plays that specific fight. _(Slice 1)_
- [x] A `/watch/{id}` whose id no longer resolves (evicted / version-rotted / garbage) shows a
      distinct **"this fight is no longer available"** state with a **"← all fights"** link back
      to `/watch` — **no retry**.
- [x] A transient failure fetching a fight (5xx / network) shows the **retryable** error state. _(Slice 1)_
- [x] `/watch` shows one card per watchable fight, **newest-first**, identity-only (challenger
      `name`/`model` vs King `name`/`model`); **name-only** when a `model` is absent; long names
      truncate with the full value in a `title` tooltip. _(Slice 2)_
- [x] Clicking a card navigates to that fight's `/watch/{id}` permalink and plays it. _(Slice 2)_
- [x] An empty archive shows the honest **empty state** — never an error. _(Slice 2)_
- [x] Two cards sharing an **identical** challenger-vs-King name pair each show a short
      content-hash id fragment; uniquely-named pairings stay clean. _(Slice 3)_
- [x] The route ships **dark** — no primary-Nav link; the "Fight replays — in development"
      teaser stays a non-link. _(held from Slice 1)_
- [x] No `src/` / `api/` / TCB / `INPUT_HASH` change; `web/src` does not import `src/`. _(held from Slice 1)_

## Slices

Player-first: the list's cards need a live `/watch/{id}` target to click into, so the permalink
player lands before the list. Each slice is a **behavior change** and leaves a coherent
deployable checkpoint. All three are `web/`-only.

---

### Slice 1: A `/watch/{id}` permalink opens and plays that specific fight (or says it's gone)

**Value**: A **spectator** handed a `/watch/{id}` link opens it and watches that exact fight;
a rotted/garbage permalink degrades gracefully instead of erroring. Establishes shareable
permalinks — the foundation the list clicks into. `/watch` (no id) keeps autoplaying the newest
fight in this slice (a coherent intermediate).
**Path**: `vercel.json` `/watch/(.*)` → `replay.html` rewrite → the SPA reads `location.pathname`
→ id present → the by-id fight view → `loadById(id)` → `GET /replay/{id}` → `200` `ReplayItem`
→ `ReplayPlayer`; `404` → not-found state; `5xx`/network → retry state.
**Class**: Behavior change.
**Required implementation skills**: `tdd`, `testing`, `front-end-testing`; `refactoring` assessed
(likely `N/A` — new components). `mutation-testing`: **N/A (Stryker)** — see Testing regime.
**Reduction program**: N/A.
**Transition/terminal evidence**: N/A.
**Acceptance criteria** (present for approval before code):

- Opening `/watch/{id}` for a resolvable id plays that fight (the player mounts with that fight's
  tape + identities; two figures animate; HUD shows the running score/tick).
- Opening `/watch/{id}` whose id returns `404` shows the **"this fight is no longer available"**
  state with a **"← all fights"** link to `/watch` and **no retry** control.
- A `5xx`/network failure on `/watch/{id}` shows the existing **retryable** error state (a Retry
  affordance), distinct from not-found.
- The happy-path player also carries a small **"← all fights"** link back to `/watch` (the dark
  route has no Nav).
- `/watch` with no id is unchanged (still autoplays the newest fight).
- A deployed `/watch/{id}` URL serves `replay.html` (the SPA), not the marketing `index.html`
  (rewrite ordering) — verified by preview smoke.
  **RED**: (a) a pure `replayIdFromPath(pathname)` returns the id for `/watch/{id}`, `null` for
  `/watch` and `/watch/` — exact assertions across the input space; (b) `loadById` with a fake
  `fetch` returns `{ kind: "found", item }` on `200`, `{ kind: "not-found" }` on `404`, and
  **throws** on `500`; (c) browser tests: the fight view, given an injected loader, renders the
  player (found), the not-found state + back-link (not-found), and the retry state (throw), and the
  dispatcher renders the fight view when an id path is injected.
  **GREEN**: add the `/watch/(.*)` rewrite (before the SPA catch-all); a pure `replayIdFromPath`;
  `loadById(id, fetchFn?)` mapping `404`→not-found / `200`→found / else throw; a `ReplayFight`
  view (`createResource(loadById)`, Switch: loading / error(retry) / not-found(back-link) /
  ready(`ReplayPlayer`)); make `ReplayPage` a dispatcher that reads an injected `path`
  (default `window.location.pathname`) and renders `ReplayFight` when an id is present, else the
  existing autoplay content.
  **MUTATE or alternate evidence**: N/A (Stryker) — exhaustive exact-assertion browser tests over
  all four states + the pure `replayIdFromPath`/`loadById` unit tests + manual mutator scan +
  preview smoke of a permalink and the not-found state.
  **KILL MUTANTS**: manual scan targets — the `404`-vs-other gate in `loadById`, the id-present
  gate in the dispatcher, the not-found `href` target, the presence/absence of the retry control
  per state.
  **REFACTOR**: assess extracting a shared status-view shell if the list slice will reuse it;
  otherwise `N/A`.
  **Done when**: all Slice-1 criteria pass; typecheck + lint + `npm test` green; manual scan
  documented; commit approved.

---

### Slice 2: `/watch` shows the browsable fight list; a card click plays that fight

**Value**: A **spectator** opens `/watch`, sees every watchable title fight as a card
(newest-first, identity-only), and clicks one to watch it — completing the browse+watch loop.
Retires the autoplay-at-`/watch` behavior.
**Path**: `/watch` → `replay.html` → dispatcher (no id) → the list view → `loadList()` →
`GET /replay` → `ReplaySummary[]` → a card grid of `<a href="/watch/{id}">`; empty → empty state;
`5xx` → retry.
**Class**: Behavior change.
**Required implementation skills**: `tdd`, `testing`, `front-end-testing`; `refactoring`
assessed. `mutation-testing`: **N/A (Stryker)**.
**Reduction program**: N/A.
**Transition/terminal evidence**: N/A.
**Acceptance criteria** (present for approval before code):

- `/watch` renders one card per watchable fight, **newest-first** (the API's order, preserved),
  each showing the challenger and King identities (`name`, and `model` when present).
- A card with a fighter missing a `model` renders **name-only** for that fighter (no empty
  brand chip).
- A very long `name` is CSS-truncated in the card with the **full value in a `title`** tooltip.
- Clicking a card navigates to that fight's `/watch/{id}` (a real `<a href>`), which plays it.
- An **empty** archive (`GET /replay` → `[]`) shows the honest empty state ("no fights yet" +
  the send-a-bot link), never an error.
- A `5xx`/network failure on the list shows the **retryable** error state.
- The old list→newest→tape autoplay loader is removed; `replay.html`'s head copy and
  `ReplayApp`'s stale "until S4" comment are corrected to describe the browsable list (dark).
  **RED**: (a) `loadList(fetchFn?)` returns `{ kind: "ready", items }` for a non-empty list,
  `{ kind: "empty" }` for `[]`, and **throws** on `500`; (b) browser tests: the list view renders
  one card per summary with the right identities + hrefs, name-only when `model` absent, a
  `title` attribute carrying the full name, the empty state on empty, and the retry state on throw;
  the dispatcher renders the list view when a no-id path is injected.
  **GREEN**: `loadList(fetchFn?)`; a `ReplayList` view (`createResource(loadList)`, Switch:
  loading / error(retry) / empty / ready(cards)); cards as `<a href={`${WATCH_PATH}/${id}`}>` with
  identity rendering + truncation `title`; point the dispatcher's no-id branch at `ReplayList` and
  delete the autoplay `loadReplay`; update `replay.html` head + `ReplayApp` comment.
  **MUTATE or alternate evidence**: N/A (Stryker) — exhaustive exact-assertion browser tests over
  list / empty / error + per-card identity/href/truncation assertions + `loadList` unit tests +
  manual mutator scan + preview smoke of the list and a click-through.
  **KILL MUTANTS**: manual scan targets — the empty-vs-ready gate, the newest-first order
  (assert two cards in order), the href construction (`/watch/{id}`), the name-only branch, the
  `title` value.
  **REFACTOR**: assess sharing the loading/error shell with Slice 1; only if it adds value.
  **Done when**: all Slice-2 criteria pass; typecheck + lint + `npm test` green; manual scan
  documented; commit approved.

---

### Slice 3: Repeat-challenge cards disambiguate with a short id fragment

**Value**: A **spectator** looking at two fights between the same-named challenger and King can
tell them apart — each colliding card shows a short content-hash id fragment; uniquely-named
pairings stay clean. (Foldable into Slice 2 if fewer PRs are preferred — kept separate to keep
Slice 2 focused on "list + click" and this on the disambiguation edge case.)
**Path**: the list view derives, via a pure pass over the summaries, which cards share an
identical challenger-name + King-name pair, and shows a 6-char `id`-prefix chip on exactly those.
**Class**: Behavior change.
**Required implementation skills**: `tdd`, `testing`, `front-end-testing`. `mutation-testing`:
**N/A (Stryker)**.
**Reduction program**: N/A.
**Transition/terminal evidence**: N/A.
**Acceptance criteria** (present for approval before code):

- When two (or more) cards share the identical challenger-`name` + King-`name` pair, **each**
  colliding card shows a short **6-char prefix of its content-hash `id`** (`id.slice(0, 6)`,
  git-style short hash), rendered as a **muted monospaced chip** near the `vs` (styled like the
  existing muted `.replay-card-vs` / `.replay-card-model` treatment, not appended to a name).
- Cards with a unique name pair show **no** fragment.
- The fragment is derived from the card's own `id` (stable across reloads; distinct per fight).
  **RED**: a pure `markCollisions(summaries)` (or equivalent) flags exactly the entries whose
  name-pair repeats — exact assertions for: no collision (none flagged), a 2-way collision (both
  flagged), a 3-way collision (all three), and a non-colliding entry mixed in (untouched); a
  browser test asserts the 6-char id-prefix chip appears only on colliding cards.
  **GREEN**: the pure collision-detection pass + rendering the `id.slice(0, 6)` chip (a muted mono
  `.replay-card-id`-style element) on flagged cards only.
  **MUTATE or alternate evidence**: N/A (Stryker) — exhaustive exact-assertion unit tests over the
  collision pass (0/2/3-way + mixed) + a browser assertion + manual mutator scan.
  **KILL MUTANTS**: manual scan targets — the collision predicate (name-pair equality, not just
  one name), the "only colliding" gate (kills an "always show" / "never show" mutant), the
  fragment length/source.
  **REFACTOR**: `N/A` unless the pass duplicates knowledge worth sharing.
  **Done when**: all Slice-3 criteria pass; typecheck + lint + `npm test` green; manual scan
  documented; commit approved.

## Pre-PR Quality Gate (each slice)

1. **Mutation**: N/A (Stryker) — record the proportionate-evidence substitute (exact-assertion
   browser/unit tests + documented manual mutator scan + preview smoke).
2. **Refactoring**: assess per slice; record `N/A` when nothing adds value.
3. **Typecheck + lint + full `npm test`** green (run `eslint --fix` then `prettier --write`,
   then verify both clean — the recurring reconciliation order).
4. DDD glossary: N/A (no domain-model change).

## Dark-launch guard (applies to every slice)

Add **no** primary-Nav link and keep the "Fight replays — in development" teaser a **non-link**.
The route is reachable only by direct URL / permalink. Surfacing it in the Nav + teaser is the
parked follow-up (`replay-viewer-decisions.md` → _Nav visibility — dark launch_).

---

_Archive this file to `docs/archive/` (do not delete) when S3 is complete — see
`docs/archive/README.md`._
