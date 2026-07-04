# Plan: Roster-wide no-Pareto-dominance property test

**Branch**: test/no-pareto-dominance
**Status**: Active

## Goal

A pure-data property in `rules.test.ts` that fails CI whenever any move in the full 12-move
roster Pareto-dominates another (or duplicates another) on the balance-law axes — a forward-guard
that auto-enrolls future moves.

## Context & source of truth

Resolved spec: `docs/move-roster.md` §"Balance law" → **"Verification hook — resolved spec
(grill-me, 2026-07-04)"**. This plan implements that spec verbatim. The balance law is rules 1–4
in the same section; this property mechanically guards **rule 2** (no Pareto-dominance) and **rule
4** (distinctness). Rules 1 (invariant floor) and 3 (at most a dual specialist) stay design-review
judgment calls / are covered by the existing per-move behavioral tests.

**Pattern to mirror:** `src/cli/gauntlet-calibration.test.ts` — its "guard bites" tests fabricate a
violator (a pushover bot; a roster missing a move) to prove the guard actually fails when it
should. We do the same with fabricated dominant/duplicate rosters.

### Resolved decisions (from grill-me)

- **Roster (12, dynamic):** iterate `Object.entries(CANONICAL_RULES.moves)` (10 named `attack`
  moves + `sweep`) and append `CANONICAL_RULES.throw`. Future Batch-2 moves auto-enroll. `throw`'s
  presence is **asserted** (mirroring the existing `armed()` helper — a clear `throw new Error` if
  `CANONICAL_RULES.throw` is ever absent), never silently skipped, so its accidental removal
  surfaces loudly rather than shrinking the roster to 11.
- **Axis vector (minimal 7):** `reach` ↑, effective `score` ↑ (`max(score, …scoreByBand)`),
  `startup` ↓, `recovery` ↓, `staminaCost` ↓, `bands` by set-inclusion (⊇) over `{high, mid, low,
  grab}`, `knockdown` (true = strength). Excluded on purpose: `active`, `cancelInto` (each extra
  axis is an escape hatch that weakens the guard). **Score-axis for knockdown moves:** `sweep` and
  `hiza-geri` take their own hit score (`0`); the okizeme `finishScore` is **not** folded in — those
  points belong to the separate `cancelInto` finisher, and the knockdown itself is credited on the
  `knockdown` axis (double-counting it as score would inflate them off the score axis).
- **Heterogeneous adapter (test-local):** named moves take `bands`/`knockdown` from fields; `sweep`
  → `bands = {low}` (its low-ness is mechanical, absent from the field), `knockdown = true`, score
  0; `throw` (a `ThrowSpec`) → `bands = {grab}` (own category, incomparable to every strike —
  this is what stops `throw` dominating `hiza-geri` without a `cancelInto` axis), `knockdown =
  true` (implicit), score 3. Absent-`bands` + not-`sweep` ⇒ `{high, mid, low}` (a genuinely
  unrestricted future move). Bands are modeled test-locally as a `Set<Band | "grab">` (a test-only
  union, **not** the engine `Band` type) so the synthetic `grab` token is representable without a
  type assertion or reusing a real band.
- **Two properties:** (rule 2) no strict Pareto-dominance — for every ordered pair NOT (`A ≥ B` on
  all 7 ∧ `A > B` on ≥1); (rule 4) distinctness — no two moves identical on all 7 axes.
  Distinctness uses the **same 7 axes** as dominance (intended): a future move distinguishable only
  by `cancelInto`/`active` (the excluded axes) is deemed **non-distinct and rejected** — the signal
  to give it a real strength-axis niche, or to *deliberately* revisit the axis set via a new
  grill-me. Never a silent override.

### Reconciliation with the "MUTATE-driven fixtures" grill-me decision

Stryker config (`stryker.config.mjs`) is `mutate: ["src/**/*.ts", "!src/**/*.test.ts"]` — **test
files are never mutated.** The detector/adapter is test-local, so Stryker will not mutate its
comparison logic; there are no "surviving detector mutants" to drive fixtures. Therefore the
per-axis **directional fixture matrix is written upfront by design** (grill-me's Q5 option B,
forced by the test-local choice), and each detector branch is proven by a dedicated fixture
asserting a specific verdict. Stryker's role for this PR is limited to confirming **no `rules.ts`
regression** (and it may pick up incidental kills on `CANONICAL_RULES` literals the property now
constrains). The detector's correctness is guaranteed by the positive-control fixtures, not by a
mutation score.

### Contingency — if GREEN fails

The plan assumes the canonical roster is dominance-free and duplicate-free under the chosen 7 axes
(hand-verified pairwise in grill-me). If the canonical-empty assertion in Slice 1 or Slice 2 comes
back **RED**, that is a genuine **balance finding, not a test bug**: **STOP.** Do NOT (a) add or
drop an axis to make it pass — that weakens the guard to fit the data, exactly backwards — nor (b)
rebalance `CANONICAL_RULES` inside this PR — that flips `INPUT_HASH` → a `BENCHMARK_VERSION` bump +
gauntlet re-characterization, contradicting this plan's no-engine-change premise. Instead, surface
the offending pair as a new rebalance / axis-review story (route through `grill-me`), and pause this
plan until it's resolved.

## Acceptance Criteria

- [ ] The full 12-move roster is enumerated **dynamically** (`Object.entries(CANONICAL_RULES.moves)`
      + appended `throw`); adding a move to `CANONICAL_RULES` auto-includes it with no test edit.
- [ ] **Rule 2 (no strict Pareto-dominance):** no move in the roster `≥` another on all 7 axes and
      `>` on at least one — GREEN on the current `CANONICAL_RULES`.
- [ ] **Rule 4 (distinctness):** no two moves are identical on all 7 axes — GREEN on the current
      `CANONICAL_RULES`.
- [ ] **Pairing semantics:** Pareto-dominance is checked over **ordered** pairs (`i ≠ j`, both
      directions, since dominance is asymmetric); distinctness over **unordered** pairs (`i < j`).
      **Self-pairs (`i == j`) are excluded in both** — a move is trivially identical to itself, so a
      missing self-exclusion would flag every move as its own duplicate (and is redundant work for
      dominance).
- [ ] The detector provably **flags** a fabricated dominant pair/roster and provably **does not
      flag** a one-axis-worse pair (the "all axes" AND) nor an all-equal pair (the strict `>`).
- [ ] Each axis's direction (`reach`↑, `score`↑, `startup`↓, `recovery`↓, `staminaCost`↓,
      `bands`⊇, `knockdown`↑) is pinned by its own directional fixture; incomparable `bands` sets
      (e.g. `{low}` vs `{mid}`) yield no dominance either way.
- [ ] `throw` modeled as grab-band + knockdown + score 3; `sweep` as `{low}`; effective score folds
      `scoreByBand` (so `mawashi`/`ushiro` read as their jodan ceiling 3).
- [ ] **Adapter coverage (two-level fixtures):** directional dominance/distinctness fixtures run at
      the **axis-vector level** (pure `dominates()`/`axesEqual()`, no adapter noise); a **separate
      set of adapter-level assertions** pins each `moveToAxes` special case on real/synthetic inputs
      — `sweep` → `bands {low}`, `throw` → `{grab}` + `knockdown` true + score 3, `mawashi`/`ushiro`
      effective score = 3, and an absent-`bands` synthetic `MoveSpec` → `{high, mid, low}`. (The
      adapter is the subtlest code and Stryker won't mutate this test file, so it gets targeted
      assertions rather than relying on the fixed canonical roster.)
- [ ] **No change to `CANONICAL_RULES`/engine** ⇒ `INPUT_HASH` and `BENCHMARK_VERSION` unchanged,
      `npm run fight` byte-identical, the `INPUT_HASH` guard test stays green.
- [ ] Full suite + `npm run typecheck` + `npm run lint` green; no `any`, no non-null-assertion
      hacks; the adapter/detector are pure functions.

## Slices

Every slice follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR. No production code without a failing
test. (Here "production code" is the test-local detector/adapter; the only source file touched is
`src/engine/rules.test.ts`.) Read `.claude/CLAUDE.md` + the `testing` rules before writing slices.

### Slice 1: No move strictly Pareto-dominates another across the 12-move roster (rule 2)

**Value**: Maintainer / CI — a future move that is strictly better than an existing one on every
axis (variety-collapsing) turns CI red; the current roster is certified dominance-free.
**Path**: `rules.test.ts` (new `describe`) → test-local `moveToAxes` adapter (reads
`CANONICAL_RULES.moves` + `.throw`) → `dominates(a, b)` predicate over the 7 axes →
`findDominatedPairs(roster)` scan → assert empty on the canonical roster; assert non-empty on
fabricated fixtures. No engine surface; no `CANONICAL_RULES` change. Intentionally skipped: rules 1
& 3 of the balance law (floor / dual-specialist) — covered elsewhere / judgment calls.
**Required implementation skills**: Before code, load `tdd`, `testing`, `mutation-testing`,
`refactoring`.
**Acceptance criteria** (present to human, confirm before coding):
  - `findDominatedPairs` over the dynamically-built canonical roster is **empty**.
  - A fabricated "guard bites" roster containing a clone strictly worse than `gyaku-zuki` on
    `reach` (equal elsewhere) is **flagged** (mirrors the calibration-lock precedent).
  - `dominates(A, B)` is pinned per axis by directional fixtures: for each of the 7 axes, a pair
    differing only on that axis asserts the correct dominator (and the flipped direction would
    fail).
  - Incomparable `bands` (`{low}` vs `{mid}`) ⇒ `dominates` false both ways.
  - A one-axis-worse pair (better on 6, worse on 1) ⇒ `dominates` false (the "all axes" AND).
  - An all-equal pair ⇒ `dominates` false (the strict-`>` existential).
  - `throw` (grab band, kd true, score 3), `sweep` (`{low}`, kd true, score 0), and effective
    score (`mawashi`/`ushiro` = 3) are exercised via the canonical roster.
**RED**: Write the directional + guard-bites + canonical-empty tests first; they fail because
`moveToAxes`/`dominates`/`findDominatedPairs` don't exist. Mutator-awareness (from
`mutation-testing` `resources/mutator-rules.md`) — the fixtures must pre-empt: ConditionalExpression
& EqualityOperator on each `≥`/`>` comparator, LogicalOperator on the "all axes" ∧ / "≥1" ∨,
ArrayDeclaration / block-statement on the axis list, the `??` defaults (`staminaCost ?? 0`,
`bands ?? [...]`), and `max(...scoreByBand)` (effective-score) — each gets a fixture whose verdict
flips if that operator is mutated. (These fixtures stand in for Stryker, which won't mutate this
test file.)
**GREEN**: Implement `moveToAxes` (with the `sweep`→`{low}` and `throw`→`{grab}` special cases + a
`bandSuperset`/`bandEqual` set helper), `dominates(a, b)`, `findDominatedPairs(roster)`, and a
`buildCanonicalRoster()` that enumerates `Object.entries(CANONICAL_RULES.moves)` + `throw`.
**MUTATE**: Run `npm run mutation` (`mutation-testing` skill). Confirm **no `rules.ts` regression**
and note any incidental `CANONICAL_RULES`-literal kills. The detector itself is test-local ⇒ not
mutated ⇒ its coverage is proven by the directional fixtures above (see Reconciliation note).
**KILL MUTANTS**: Address any newly-surviving `rules.ts` mutants (ask human if a survivor's value
is ambiguous). Re-inspect the directional fixtures for any axis/operator not yet pinned.
**REFACTOR**: Assess only if it adds value — e.g. extract a shared `Band` universe constant,
collapse the directional fixtures into a table-driven `it.each`. Keep the adapter pure.
**Done when**: All acceptance criteria met, mutation report reviewed (no regression), typecheck +
lint green, human approves commit.

### Slice 2: No two moves are identical on all 7 axes (rule 4, distinctness)

**Value**: Maintainer / CI — a future near-duplicate (identical strengths, no distinct niche) turns
CI red, closing the gap Pareto alone leaves (an all-axes tie strictly-dominates nothing).
**Path**: `rules.test.ts` (same `describe`) → reuse Slice 1's `moveToAxes` + `bandEqual` → an
`axesEqual(a, b)` predicate → `findDuplicatePairs(roster)` → assert empty on the canonical roster;
non-empty on a fabricated duplicate. Additive; no change to Slice 1's Pareto property.
**Required implementation skills**: load `tdd`, `testing`, `mutation-testing`, `refactoring`.
**Acceptance criteria** (present to human, confirm before coding):
  - `findDuplicatePairs` over the canonical roster is **empty**.
  - A fabricated roster with two moves identical on all 7 axes (but differing in an excluded
    dimension, e.g. `active` or `cancelInto`) is **flagged** — proving distinctness catches what
    Pareto does not.
  - A pair differing on exactly one axis is **not** flagged (proves `axesEqual` requires all-7
    equality, incl. `bandEqual`).
**RED**: Write the duplicate-flagged, one-axis-different-not-flagged, and canonical-empty tests
first; they fail until `axesEqual`/`findDuplicatePairs` exist. Mutator-awareness: the all-7 ∧ in
`axesEqual` (LogicalOperator), each `===` (EqualityOperator), and `bandEqual` (set-equality vs
subset) each get a flipping fixture.
**GREEN**: Implement `axesEqual(a, b)` (7 equalities incl. `bandEqual`) + `findDuplicatePairs`.
**MUTATE**: Run `npm run mutation`; confirm no `rules.ts` regression. `axesEqual` is test-local ⇒
proven by its fixtures.
**KILL MUTANTS**: Address any `rules.ts` survivors; re-check fixtures pin every equality.
**REFACTOR**: Fold `bandEqual` into the shared set helper from Slice 1 if not already; assess
table-driven fixtures. Only if it adds value.
**Done when**: All acceptance criteria met, mutation report reviewed, typecheck + lint green, human
approves commit.

## Pre-PR Quality Gate

Before the PR:
1. Mutation testing — `npm run mutation`; confirm **no `rules.ts` regression** (the detector is
   test-local by design; its coverage is the directional fixtures, per the Reconciliation note).
2. Refactoring assessment — run `refactoring` skill on the new test code.
3. `npm run typecheck` + `npm run lint` pass; full `npm test` green.
4. Confirm `INPUT_HASH` guard test is green and `BENCHMARK_VERSION` is unchanged (this PR touches
   no scoring input), and `npm run fight` is byte-identical (no `CANONICAL_RULES`/engine change).
5. `npm run gen:spec` produces no diff (no spec-affecting change).

## Gaps closed — find-gaps session, 2026-07-04

Resolved (7):

```
[Blocker → §Contingency]       Real dominance/duplicate at GREEN = a balance FINDING → escalate; no axis/rules patch here
[Blocker → AC "Pairing"]       Self-pair exclusion + ordered(dominance) / unordered i<j (distinctness) semantics
[Should  → AC "Adapter cov."]  Two-level fixtures: axis-vector directional + adapter-level special-case assertions
[Should  → §Axis vector]       Score axis excludes finishScore for knockdown moves (sweep / hiza-geri = 0)
[Should  → §Adapter]           Bands modeled test-locally as Set<Band | "grab">, not the engine Band type
[Should  → §Two properties]    Distinctness uses the SAME 7 axes (rejects a cancelInto/active-only future move — intended)
[Nice    → §Roster]            throw presence ASSERTED (mirrors armed()), never silently skipped
```

Parked (0): none. Vacuous-pass (Nice) folded into the two-level-fixture resolution.

---
*Delete this file when the plan is complete. If `plans/` is empty, delete the directory.*
