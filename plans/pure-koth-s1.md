# Plan: Pure KotH S1 — Fresh seeded v20 season

**Branch**: feat/pure-koth-s1-bump-v20 (Slice 3; Slices 1–2 shipped on their own branches)
**Status**: Active — Slice 1 ✅ shipped (PR #397, `main`@`1425ab7`); Slice 2 ✅ shipped (PR #398,
`main`@`d93b056`); Slice 3 ✅ complete (pending commit — the v20 activation)

Child story S1 of the `pure-koth-stories.md` split. Decisions: `pure-koth-decisions.md`
(D1–D15). Engine + TCB untouched — all work in `src/http/`, `src/engine/benchmark-config.ts`
(version string only), and the `api/` wrappers.

## Goal

Start a fresh v20 season whose arena is born seeded with the three strongest House bots —
visible on `/king` and contestable through `/fight` — with the gauntlet gate still in place.

## Context the slices lean on

- **Seed default.** An empty store must resolve to `SEED_ARENA` for BOTH the read path
  (`handle-king`) and the compete path (`handle-fight`). `handle-replay` reads the _archive_
  (empty → `[]`), so it needs no seed default — the seed bots have no archived bouts.
- **CAS correctness (find-gaps).** On a physically empty store the first compete must commit
  with `expected = null`; passing `SEED_ARENA`'s nominal generation would 409 forever. The
  shared resolver therefore returns both the effective arena AND the CAS `expected`
  (`null` when physically empty, else `arena.generation`).
- **No runtime fights (D5).** `SEED_ARENA`'s membership + order are a pinned constant; a test
  asserts it equals the round-robin computation. The handler never recomputes at cold start.
- **Bump is last (dark-launch).** Slices 1–2 wire + test the seed default via the injectable
  store seam while the live v19 store stays non-empty, so prod behavior is unchanged and
  coherent until Slice 3 flips the version — a one-line, independently revertible activation.

## Acceptance Criteria

- [x] On an empty arena, `GET /king` returns the three strongest House bots ranked King/#2/#3 by
      a deterministic build-time round-robin, each showing `handle: "Gauntlet"` + `model: "House"`
      (the unknown/generic brand glyph — no web change; `modelToBrand` already falls back to
      `generic`). The `api/king.ts` wrapper + `vercel.json` `includeFiles` are wired in this slice,
      dark-launched (inert while v19 is non-empty). — **Slice 1, PR #397**
- [x] `SEED_ARENA` (members, order, seniorities 1/2/3, `generation: 1`, `nextSeniority: 4`) is a
      pinned constant, asserted by a test to equal the round-robin computation over the three
      strongest bots — selected as the top 3 by `winRateVsRoster` on the frozen roster/seeds,
      ties broken by `GAUNTLET_NAMES` order. The handler never recomputes it at runtime.
      **Computed (v19 roster, frozen seeds):** strongest 3 = grappler 64% · sweeper 60% · rekka 59%
      (next is zoner 40% — unambiguous). Their 3-way round-robin is a strict order → **King:
      grappler** (wins 2, net +334) · **#2: sweeper** (wins 1) · **#3: rekka** (wins 0); seniority
      1/2/3 = grappler/sweeper/rekka (never needed as a tiebreak — grappler beats both 100%).
- [x] On an empty arena, a gauntlet-clearer that competes round-robins the three House bots
      (not a solo bootstrap crown) and is placed crowned/entered/unplaced; the arena materializes
      via a CAS commit with `expected = null`. The old empty-arena bootstrap branch is gone.
      — **Slice 2, this branch**
- [x] After the bump to v20, the live `/king` shows the House board and the first clearer contests
      it; v19 data is orphaned and restorable by reverting the bump. `INPUT_HASH` is unchanged
      (the version string is not a scoring input). — **Slice 3, this branch**
- [x] The gauntlet gate is unchanged; the engine and its TCB are untouched. — **Slice 3**

## Slices

Classified per the planning contract. All three are **behavior changes** (RED-GREEN + mutation).
Read the project CLAUDE.md + `mutation-testing` notes before each: `src/http/` is in Stryker
scope (node), so mutants are meaningful here.

### Slice 1: `GET /king` on an empty arena returns the three House champions — ✅ SHIPPED (PR #397)

**Shipped as**: `src/http/seed-arena.ts` (`SEED_ORDER` pinned constant + pure `buildSeedArena` +
`readArenaOrSeed`); `handle-king.ts` reads through `readArenaOrSeed(store, version, seed)` with an
optional `seed` on `KingDeps`; `api/king.ts` injects `buildSeedArena(loadGauntlet())`; `vercel.json`
adds `api/king.ts` → `includeFiles: "bots/*.json"`. 100% mutation score (47/47) on the seed module.

**Value**: Site visitor / API client — an empty season shows a live board of three ranked House
champions instead of "no King yet." Establishes `SEED_ARENA` + the shared seed resolver.
**Path**: `GET /king` → `handleKing` → `readArenaOrSeed(store, version)` (empty → `SEED_ARENA`)
→ `memberIdentity` rows → JSON. Verified through the injectable store seam (an injected empty
store), the same pattern the existing handler tests use. The production wrapper `api/king.ts` is
also wired to load the seed docs (`loadGauntlet`) and pass `SEED_ARENA` in, with `api/king.ts`
added to `vercel.json` `functions.includeFiles` — dark-launched: v19 is non-empty, so the seed
never surfaces until Slice 3 bumps the version.
**Class**: Behavior change.
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`; `refactoring` if the
resolver extraction warrants it.
**Reduction program**: N/A.
**Acceptance criteria** (confirm before coding):

- Given an empty store, `GET /king` returns exactly three entries, ranked King/#2/#3 in the
  deterministic seed order, each with `handle: "Gauntlet"`, `model: "House"`, and identity-only
  fields (never a doc — no `rules`/`version`/`default`/`generation`).
- `SEED_ARENA` is a constant with seniorities 1/2/3, `generation: 1`, `nextSeniority: 4`; a test
  asserts its membership+order equals the top-3-by-`winRateVsRoster` bots round-robined by the
  arena's `byRank` total order. Selection ties break by `GAUNTLET_NAMES` order.
- Given a non-empty store, `GET /king` is byte-unchanged (the resolver passes the real arena
  through) — no regression to the current `/king` (every existing `handle-king.test.ts` case
  stays green).
- `api/king.ts` loads the seed docs and injects `SEED_ARENA`; `api/king.ts` is added to
  `vercel.json` `functions.includeFiles: "bots/*.json"`. Inert on v19 (non-empty).
  **RED**: A `handle-king` test with an injected empty store expecting the three ranked House
  rows (`handle: "Gauntlet"`, `model: "House"`); and a `seed-arena` test pinning the constant
  against the recomputed round-robin ordering (reusing `winRateVsRoster` from
  `gauntlet-calibration.test.ts`).
  **GREEN**: Add `SEED_ARENA` (+ a `buildSeedArena(bots)` hydrator from the loaded gauntlet docs,
  overriding each member's `model` → `"House"` and `handle` → `"Gauntlet"`) and `readArenaOrSeed`;
  wire `handleKing` to it; wire `api/king.ts` + `vercel.json`.
  **MUTATE**: Stryker on the new `src/http` seed module + the resolver — kill mutants on the top-3
  slice boundary, the `byRank` comparator wiring, the seniority assignment, and the empty-vs-real
  branch.
  **KILL MUTANTS**: Strengthen the pin/selection tests for survivors (ask if a survivor's value is
  ambiguous).
  **REFACTOR**: Assess only if the resolver/hydrator seams add clarity.
  **Done when**: ACs met, mutation report clean/justified, typecheck+lint green, commit approved.

### Slice 2: A challenger competing on an empty arena fights the three House champions — ✅ complete (pending commit)

**Shipped as**: `readArenaOrSeed` now returns `{ arena, expected }` (overloaded — a required seed yields
a defined arena, so the compete path needs no empty-arena special case); `handle-fight.ts` resolves the
effective arena + CAS `expected` up front, mirror-checks unconditionally, and both commit sites use
`expected` (null when physically empty) — the `arena === undefined` bootstrap branch is deleted;
`FightDeps.seed` is required and `api/fight.ts` injects `buildSeedArena(loadGauntlet())`. 100% mutation
score (181/181) across the four changed files.

**Value**: Bot author — the first compete of a season contests the seeded board (must beat House
bots to place), instead of a free solo bootstrap crown. Wires the seed default into the compete
path and fixes the CAS-empty commit.
**Path**: `POST /fight` (compete) → `handleFight` → `readArenaOrSeed` (empty → `SEED_ARENA`,
`expected = null`) → round-robin vs the three House bots → `rankArena` → CAS `commitArena(version,
null, next, record)` → materialized arena. Verified via injected empty store.
**Class**: Behavior change.
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.
**Reduction program**: N/A.
**Acceptance criteria** (confirm before coding):

- Given an empty store, a gauntlet-clearer competing round-robins the three House bots and is
  placed crowned/entered/unplaced by `rankArena`; `board` carries all three House defenders.
- The materializing commit uses CAS `expected = null`; a concurrent second first-compete loses
  the race and gets `409 throne-moved` (existing behavior, now over the seed).
- An unplaced first-clearer still commits (archives its record) and leaves the arena = `SEED_ARENA`
  (three House bots), byte-consistent with the `/king` seed.
- The `arena === undefined` bootstrap branch (solo first crown) is removed — no dead code.
- Practice (`X-Compete` ≠ true) on an empty store projects the same placement without writing.
  **RED**: `handle-fight` tests with an injected empty store: a clearer crowns over the House board
  (board has 3 rows), an unplaced clearer leaves `SEED_ARENA` intact, and the commit is asserted to
  use `expected = null` (a store double recording the CAS arg).
  **GREEN**: Route `handleFight`'s arena read through `readArenaOrSeed`; use its `expected`; delete
  the bootstrap branch.
  **MUTATE**: Stryker on the changed `handle-fight` paths — kill mutants on the `expected` selection
  (null vs generation), the empty-vs-real branch, and the unplaced-still-commits path.
  **KILL MUTANTS**: Strengthen tests for survivors.
  **REFACTOR**: Assess resolver reuse between `handle-king` and `handle-fight`.
  **Done when**: ACs met, mutation report clean/justified, typecheck+lint green, commit approved.

### Slice 3: Open the v20 season — bump the benchmark version, activating the seeded board — ✅ complete (pending commit)

**Shipped as**: `BENCHMARK_VERSION` `"v19"` → `"v20"` (one constant in `src/engine/benchmark-config.ts`,
its trailing + header Policy comments reworded to the season-wipe rationale); the version pin test
(`benchmark-config.test.ts`) asserts `"v20"`; `docs/spec.md` + `docs/variety.md` regenerated (both
committed-artifact drift guards green — the only diff in each is the version-string header, bodies
byte-identical). `INPUT_HASH` unchanged (version is not a scoring input → no accidental ladder reset).
Preview smoke (real `api/king.ts` + `api/fight.ts` on an empty v20 store): `/king` → grappler/sweeper/
rekka House board; compete → `version: v20`. MUTATE N/A (string-literal flip) — killed by the version
pin + the two drift guards; alternate evidence recorded.

**Value**: Everyone — production flips to a fresh, House-seeded v20 arena (the wipe). The prod-
visible outcome of S1; a one-line, revertible activation of the already-tested seed default.
**Path**: `BENCHMARK_VERSION` v19 → v20 → the live store's v20 keys are empty → `readArenaOrSeed`
(shipped in Slices 1–2) resolves the seed everywhere → `/king` shows House, `/fight` contests it.
**Class**: Behavior change (config flip that activates prod behavior).
**Required implementation skills**: `tdd`, `testing`; `mutation-testing` N/A for the constant flip
(the seed behavior's mutants were covered in Slices 1–2) — record the alternate evidence (the
spec-drift + version tests + a preview smoke).
**Reduction program**: N/A.
**Acceptance criteria** (confirm before coding):

- `BENCHMARK_VERSION === "v20"`; `npm run gen:spec` regenerated `docs/spec.md`; any version-pinned
  test updated; the `INPUT_HASH` guard still passes unchanged (version is not a scoring input).
- Preview smoke: a fresh `/king` on the v20 store returns the three House champions; the first
  compete contests them.
- Reverting this slice restores v19 (its orphaned arena/archive keys are intact) with no recovery
  step.
  **RED / preservation baseline**: Update/observe the version-string + spec-drift tests to expect
  v20; the empty-store→seed behavior is already proven by Slices 1–2 (no new behavior test needed).
  **GREEN**: Change the constant; regenerate the spec; update pinned assertions.
  **MUTATE**: N/A (constant flip) — alternate evidence: spec-drift test + version assertions + the
  preview smoke.
  **KILL MUTANTS**: N/A.
  **REFACTOR**: N/A.
  **Done when**: ACs met, all tests green, spec regenerated, preview smoke passes, commit approved.

## Pre-PR Quality Gate

1. Mutation (Slices 1–2) run on the changed `src/http` files; Slice 3 records the `N/A` +
   alternate evidence rationale.
2. Refactoring assessment (resolver/hydrator seams) — `N/A` if no value.
3. `npm run typecheck` + `npm run lint` green; format only touched files (repo has pre-existing
   `format:check` drift — never `prettier --write .`).
4. No DDD glossary in this project — N/A.

## Notes / open facts for implementation

- **The three strongest bots** are grappler / sweeper / rekka (computed above); Slice 1's pin test
  re-derives and locks this via `winRateVsRoster` + the 3-way round-robin (so a future roster/rules
  change that reorders them fails the build). Note rekka's tobi-geri jump-in makes #3 visually
  distinct from grappler's clinch-throws and sweeper's foot-sweep — good watchability, per D4.
- **House identity (revised D15)**: seeds show `handle: "Gauntlet"` + an overridden `model:
"House"`. The docs actually carry `model: "gauntlet"`, so `buildSeedArena` overrides it to
  `"House"` (inert — the engine never reads `model`, `INPUT_HASH` excludes it). `modelToBrand("House")`
  → `generic`, so the web renders the neutral **unknown glyph** + a "House" label + a `[Gauntlet]`
  credit with **zero web change** (the `generic` fallback already exists in `web/src/shared/lib/brand.ts`).
- **Web**: no `/king` or `/ring` layout change is needed in S1 — the existing board renders the
  seeded members (`handle: "Gauntlet"`, `model: "House"` → generic glyph) as ordinary champion rows.
  (The generic mark's accessible label is currently "Mystery challenger"; a House-specific label is
  an optional cosmetic follow-up, not required for S1.)

---

_Delete this file when the plan is complete. If `plans/` is empty, delete the directory._
