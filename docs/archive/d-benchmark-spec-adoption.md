# Plan: Capability D — benchmark + spec adoption of senshu tie-resolution

**Branches**: `feat/benchmark-senshu` (D1) → `feat/spec-senshu` (D2, cut after D1 merges)
**Status**: Active

> Authoritative decisions + AC-1..AC-9 + AC→slice map live in
> `plans/s7-match-remainder-stories.md` → "Capability D — resolved decisions (grill 2026-07-03)" and
> "Capability D — Acceptance criteria (find-gaps 2026-07-03)". This plan is the delivery sequencing.

## Goal

The LLM benchmark scores under WKF **senshu** first-blood tie-resolution (a level-at-cap bout resolves
to a winner instead of a draw), and `docs/spec.md` teaches that win/draw cascade — wiring the built §7
senshu mechanic into the platform's measuring instrument and its authoring instrument.

## Scope (resolved — do NOT re-open)

- **Tie-resolution only, senshu only.** `MATCH = { winGap: 8, senshu: true }`. jogai / passivity /
  overtime adoption + prose are DEFERRED (they'd force a gauntlet rebalance / mislead authors with
  fields that read `0` all match). Spec teaches senshu + the corrected win/draw cascade only.
- **Two slices, D1 (benchmark) → D2 (spec).** Hard dependency: `generateSpec` defaults `match = MATCH`
  (imported from `benchmark-config.ts`), so senshu must be frozen into `MATCH` (D1) before the spec can
  teach it (D2). Spec-first would teach a tie-break the config doesn't enable → breaks taught==scored +
  the drift test. Mirrors §7 S3 (adopt) → S5 (teach).
- **Report-only re-characterization.** senshu is WKF-correct; adopt it, re-pin the characterization,
  refresh the doc with honest numbers — but NO rebalance. Any out-of-band shift feeds the deferred
  `vulture` parry→counter story, not this plan.

## Non-negotiable invariants (hold throughout)

- **ENGINE untouched.** senshu shipped in C1/C3; D adds NO engine change, NO DSL/TCB surface, NO new
  `FIELD_READERS` / `ALLOWED_FIELDS` bullets. `runFight`'s "byte-identical when `match` absent" is
  INHERITED, not re-proven. Determinism / integer-only outcome math / DSL-as-data TCB boundary / same
  pre-tick snapshot are all untouched (no code in `sim.ts` / `dsl.ts` changes).
- **D1 DELIBERATELY changes benchmark scoring** (v3→v4) — that is the point, guarded by the version
  bump. It is NOT a byte-identical change. `npm run fight` is unaffected (match is benchmark-only, not
  in `Rules`/`CANONICAL_RULES`).
- **Benchmark determinism / replay-stability + swap-symmetry** are inherited (`benchmark()` is pure;
  both sides A/B played; senshu is swap-consistent per C1).
- **D2 is VERSION-NEUTRAL** — touches no scoring input ⇒ no `BENCHMARK_VERSION` / `INPUT_HASH` change.

## Acceptance Criteria (from the find-gaps AC set)

**D1 (benchmark):**

- [ ] **AC-1** — a synthetic level-at-cap SOLO-first-blood matchup, run through `benchmark()` with
      `match.senshu` true, tallies as a WIN for the first-blood holder (`wins` +1, `draws` +0); the SAME
      matchup senshu-absent tallies as a DRAW. Dedicated test in `benchmark.test.ts` on `MOCK_RULES`.
- [ ] **AC-2** — `MATCH`/version/hash freeze: forced RED (`computeInputHash() !== INPUT_HASH` +
      `MATCH` mismatch while still v3, proving the digest captured senshu) → final GREEN (`MATCH`
      `toEqual({ winGap: 8, senshu: true })`, `BENCHMARK_VERSION` `toBe("v4")` with a senshu reason-label,
      `INPUT_HASH` re-pinned).
- [ ] **AC-3** — net-tiebreak invariance: identical `netPoints` with vs without senshu on the AC-1
      scenario, WHILE `wins`/`draws` diverge.
- [ ] **AC-4** — dogfood re-pin: method + invariants (`totalFights == 120`; `wins + losses + draws ==
120`; `draws ≤ 1`; replay-stable); exact W/L/D pinned at GREEN; v3→v4 titles/comments.
- [ ] **AC-5** — ADD `docs/benchmark-gauntlet-v4.md` (senshu re-characterization: round-robin under
      senshu + the AC-4 dogfood record); KEEP `benchmark-gauntlet-v3.md` intact; no dangling refs.

**D2 (spec):**

- [ ] **AC-6** — `benchmarkSection` win-condition prose teaches the winGap → senshu → residual-draw
      cascade; a new `gen-spec.test.ts` assertion locks the line names "senshu"; the existing "draw"
      assertion still holds; interpolated from `MATCH`; byte-drift test re-pins `docs/spec.md`.
- [ ] **AC-7** — the primer "play the match" bullet is AUGMENTED with an actionable senshu clause naming
      `self.senshu` / `opponent.senshu`; existing "match win-rate" primer assertions still hold.

**Both:**

- [ ] **AC-8** — invariants: engine byte-identical (inherited) vs deliberate v3→v4 scoring change;
      benchmark determinism/replay/swap.
- [ ] **AC-9** — non-goals honored: no new DSL/TCB surface; no `endReason` surfacing; no rebalance; no
      jogai/passivity/overtime.

## Slices

Every slice follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR. No production code without a failing test.
Before code changes on each slice, load `tdd`, `testing`, `mutation-testing`, `refactoring`. Read
`.claude/CLAUDE.md` + the C1/C3 senshu machinery first.

---

### Slice D1: The benchmark scores a level-at-cap bout to a senshu winner instead of a draw

**Value**: A bot author (and the platform ranking) — a level-at-cap benchmark bout is now decided by
first blood, so win-rate discriminates the close, low-scoring matchups that previously drew.
**Path**: `MATCH` (the frozen manifest) → `benchmark()` threads `match` into `runFight` → senshu rewrites
`winner` for a level bout → the aggregator's `botWin`/`draw` (keyed off `winner`) tallies a
win/loss → `Submission`. Observability: the synthetic `benchmark.test.ts` tally (AC-1/AC-3), the
`benchmark-config.test.ts` guard (AC-2), the `dogfood.test.ts` characterization (AC-4), and
`docs/benchmark-gauntlet-v4.md` (AC-5). No engine surface touched.
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.
**Acceptance criteria**: AC-1, AC-2, AC-3, AC-4, AC-5 + AC-8/AC-9 (D1 half). **Present these to the
human and get confirmation before writing any code.**

**RED** (in order):

1. **AC-1 mechanism** (`src/engine/benchmark.test.ts`): a synthetic matchup that ends LEVEL at the cap
   with a SOLO first blood — one fighter scores first (latches senshu), the other catches up to level,
   neither reaches `winGap`. Assert: with `match: { winGap, senshu: true }` the `perOpponent` entry is
   `wins`+1 / `draws`+0; with `match` senshu-absent it is `wins`+0 / `draws`+1. Build the pair on the
   existing seed-independent `MOCK_RULES` (no perception ⇒ deterministic). Likely mutants to pre-empt:
   the `winner === "draw"` / `winner === "A"` equality checks (already in `benchmark.ts:77-83` — this
   test gives them a senshu-flipping case), and the `senshu: true` boolean literal.
2. **AC-3 net-invariance** (same file, same scenario): assert `benchmark(...).netPoints` is EQUAL with
   `senshu: true` vs senshu-absent, WHILE `wins`/`draws` differ. Kills a mutant that would let senshu
   leak into the score path.
3. **AC-2 forced-RED** (`src/engine/benchmark-config.test.ts`): set `MATCH = { winGap: 8, senshu: true }`
   in the source FIRST (source edit, not test) — the existing `MATCH` `toEqual({ winGap: 8 })` and
   `computeInputHash() === INPUT_HASH` assertions go RED for the RIGHT reason (the digest changed because
   senshu entered the hashed `match` payload). Capture the printed expected hash.
4. **AC-4 dogfood** (`src/cli/dogfood.test.ts`): the pinned `15W 104L 1D` characterization goes RED under
   the new `MATCH`. Re-pin to the exact deterministic W/L/D produced at GREEN, asserting the invariants
   (`totalFights == 120`, sum-check, `draws ≤ 1`, replay-stable via a same-config twice `toEqual`).

**GREEN** (minimum code):

- `src/engine/benchmark.ts`: widen `BenchmarkConfig["match"]` from `{ winGap: number }` to the shared
  `FightConfig["match"]` (import from `sim.ts`/`types.ts`) so `senshu` is carried typed through
  `playBothSides` → `runFight`. No aggregator logic change (it already keys off `winner`).
- `src/engine/benchmark-config.ts`: `MATCH = { winGap: 8, senshu: true } as const`; `BENCHMARK_VERSION`
  → `"v4"`; `INPUT_HASH` → the recomputed digest; refresh the `MATCH` doc-comment.
- `src/engine/benchmark-config.test.ts`: update `MATCH` `toEqual`, the version `toBe("v4")` + its
  reason-label title (e.g. "senshu tie-resolution adoption"), and let the hash test re-pin.
- `src/cli/dogfood.test.ts`: re-pin the exact W/L/D; v3→v4 titles/comments.
- ADD `docs/benchmark-gauntlet-v4.md` (AC-5): title it for the senshu re-characterization; carry the v4
  round-robin (each gauntlet member re-run under senshu — reproduced via `benchmark()`) + the re-pinned
  dogfood record; note "report-only, no rebalance". Leave `benchmark-gauntlet-v3.md` untouched.

**MUTATE**: scoped Stryker on the changed `benchmark-config.ts` (the `MATCH`/version/hash constants) +
the `benchmark.ts` `match` type region. `rm -rf .stryker-tmp reports` first (pollution artifact). Expect
the `MATCH` `toEqual` shape assertion to kill the `ObjectLiteral`/`BooleanLiteral` `senshu` mutants; the
AC-1 scenario to kill the `winner ===` equality mutants; the hash test to kill any digest tampering.
**KILL MUTANTS**: add assertions for any survivor; ask the human if a survivor's value is ambiguous.
**REFACTOR**: assess — likely none (data + type widen only).

**Done when**: AC-1..AC-5 met; `benchmark-config.test.ts` green at v4; the synthetic + net-invariance
tests green; dogfood re-pinned; `docs/benchmark-gauntlet-v4.md` added, v3 intact; typecheck + lint +
`format:check` clean; mutation report reviewed; human approves commit. **PR on `feat/benchmark-senshu`.**

**Gotchas**:

- The v3→v4 doc is an ADD, not a rename (find-gaps AC-5) — a rename would orphan the two
  `.claude/CLAUDE.md` citations of the v3 record.
- The forced-RED for AC-2 is real TDD evidence: set `MATCH` first, watch the hash + `MATCH` tests fail,
  then paste the printed hash + bump the version. Don't bump the version without the config actually
  differing.
- The synthetic AC-1 pair must produce a SOLO first blood (not a simultaneous trade → `none` → still a
  draw). Stagger the two scores across ticks.

---

### Slice D2: `docs/spec.md` teaches the senshu win/draw cascade + makes the tells actionable

**Value**: An LLM bot author — the spec now explains that a level-at-cap bout is decided by first-blood
senshu (not a draw) and points at the `self.senshu`/`opponent.senshu` tells, so the author can play to
protect/steal senshu.
**Path**: `generateSpec(rules, match=MATCH)` → `benchmarkSection` win-condition prose + the primer
"play the match" bullet → regenerated `docs/spec.md`. Observability: new `gen-spec.test.ts` assertions
(AC-6/AC-7) + the byte-drift test (`docs/spec.md` byte-matches `generateSpec()`). VERSION-NEUTRAL.
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.
**Acceptance criteria**: AC-6, AC-7 + AC-8/AC-9 (D2 half). **Present to the human and confirm before
writing code.** Cut `feat/spec-senshu` AFTER D1 merges (so `MATCH` already carries senshu).

**RED** (`src/cli/gen-spec.test.ts`):

1. **AC-6** — in the "benchmark rules" describe: assert the win-condition line now names **"senshu"**
   (new), AND still contains "draw" (the existing `gen-spec.test.ts:213` assertion must keep passing).
   Add an assertion that the cascade is interpolated (winGap from `MATCH`, not a literal — extend the
   existing `interpolates the win gap` pattern if useful). Likely mutants: a `StringLiteral` mutant on
   "senshu"/"draw"; guard by asserting both tokens co-occur on the win-condition line.
2. **AC-7** — in the "strategic primer" describe: assert a primer line names **"senshu"** AND
   code-spans BOTH `self.senshu` and `opponent.senshu`; assert the existing "match win-rate" primer
   assertions (winGap + maxTicks) still hold on the augmented bullet.
3. The byte-drift test (`docs/spec.md byte-matches generateSpec()`) goes RED the moment the generator
   prose changes — it re-pins after the regen.

**GREEN**:

- `src/cli/gen-spec.ts`: widen the local `Match` type with `senshu?: boolean`. Correct
  `benchmarkSection`'s win-condition bullet: "...decided on total points; if still LEVEL, the first
  fighter to have scored (SENSHU) wins; only a bout with no first-blood holder is a draw." Augment the
  primer "play the match" bullet with the actionable senshu clause naming `self.senshu`/`opponent.senshu`.
  Keep every number interpolated from `match`/`rules` (no hardcoded literals).
- Regenerate: `npm run gen:spec` → commit the updated `docs/spec.md` (the drift test re-pins it).

**MUTATE**: scoped Stryker on the changed `gen-spec.ts` regions (`benchmarkSection` win-condition +
the primer bullet). `rm -rf .stryker-tmp reports` first. Kill `StringLiteral` survivors on "senshu" /
the field names by the co-occurrence assertions. **KILL MUTANTS**: strengthen as needed.
**REFACTOR**: assess — likely none (prose + one optional type field).

**Done when**: AC-6/AC-7 met; the new `gen-spec.test.ts` assertions + the byte-drift test green;
`docs/spec.md` regenerated and committed; `BENCHMARK_VERSION`/`INPUT_HASH` UNCHANGED (version-neutral);
typecheck + lint + `format:check` clean (`docs/spec.md` is LF-pinned via `.gitattributes` — regenerate,
don't hand-edit); mutation report reviewed; human approves commit. **PR on `feat/spec-senshu`.**

**Gotchas**:

- `docs/spec.md` is `.prettierignore`d + LF-pinned; ALWAYS regenerate via `npm run gen:spec`, never
  hand-edit, or the drift test fails on EOL/format.
- D2 must NOT touch `benchmark-config.ts` — a version/hash bump here would be wrong (version-neutral).
- No new field-whitelist bullets: `self.senshu`/`opponent.senshu` already shipped in C3's
  `ALLOWED_FIELDS`; D2 adds SEMANTIC prose only, so the spec's field/schema lists are unchanged (bounds
  the drift to the two prose regions — AC-9).

## Pre-PR Quality Gate (each slice)

1. Mutation testing — scoped Stryker on the changed regions; `rm -rf .stryker-tmp reports` before/after.
2. Refactoring assessment — run `refactoring` (likely minimal: data/type/prose changes).
3. `npm run typecheck` + `npm run lint` + `npm run format:check` pass.
4. Full `npm test` green (D1: engine byte-identical where match absent stays green; D2: drift test
   re-pinned).

## End of Feature (after D2 merges)

1. Verify AC-1..AC-9 met; full suite green.
2. Record Capability D DONE in `.claude/CLAUDE.md` Status + flip the tracker's Next Step (Capability C
   was the prior close-out precedent). ADD the `docs/benchmark-gauntlet-v4.md` pointer to CLAUDE.md
   (do NOT rewrite the v3 refs).
3. Delete this plan file (`plans/d-benchmark-spec-adoption.md`); keep the standing tracker
   `plans/s7-match-remainder-stories.md` (flip its Capability D progress entry to DONE).

---

_Delete this file when the plan is complete._
