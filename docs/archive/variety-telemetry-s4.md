# Plan: Variety telemetry — S4 (scoring attribution)

**Branch**: `feat/variety-telemetry-s4-attribution` (single slice — see "Slice count")
**Status**: ✅ Complete — shipped PR #289 (merged 2026-07-13); 100% mutation on both
files (engine + CLI), all eleven acceptance criteria met. Archived per
`[[archive-plans-not-delete]]`.
**Parent story**: `variety-telemetry-stories.md` §S4 (resolved via grill-me 2026-07-13,
examples S4-1…S4-11). Design grounded in the engine: the frame carries `points`
(`sim.ts:81`, the post-tick scoreboard) so a per-tick delta is `frame[t].points −
frame[t−1].points`; a point lands `startup` ticks AFTER the honoured-start, inside the
`[startup, startup+active−1]` window (`elapsed` increments after `events.push`); the window
is exact for air too (`sim.ts:969-995`); a move scores at most once (the `scored` latch,
`sim.ts:847`); penalty points are the only non-move delta (`sim.ts:1058`, +1 to the
opponent). Attribution rule locked in `variety-telemetry-harness.md` §Resolved decisions
#10. Full engine survey in the session scratchpad
`s4-scoring-attribution-engine-research.md`.

## Goal

The roster designer runs `npm run telemetry` and sees, beneath the usage (S1), opener (S2),
degrade (S3a), and occupancy (S3b) sections, a **scoring-attribution** table answering
_"which moves actually put points on the board vs whiff — effectiveness, not just choice?"_
— the readout that tells a move that is _chosen and lands_ apart from one that is _chosen
and bounces_ (a mis-targeted or outclassed technique → buff / re-role / cut), and reconciles
with S1 usage (`starts(X)` **is** the S1a usage count).

## Non-negotiable invariant (inherited from S1a/S1b/S2/S3a/S3b)

A **pure read-only reduction** over `runFight`. NO change to any scoring-input file
(`sim.ts`/`dsl.ts`/`types.ts`/`prng.ts`/`rules.ts`/`benchmark.ts`/`benchmark-config.ts`);
NO `INPUT_HASH` flip; NO `BENCHMARK_VERSION` bump; `npm run fight` stays byte-identical.
The attribution reduction reads only `.action`, `.degrade`, and `.points` (all already
emitted every tick) plus per-technique `startup`/`active` looked up from the SAME `Rules`
object the round-robin already ran on (read, never mutated). Verify the PR with `git diff
--name-only` touching only `src/engine/telemetry.ts`, `src/cli/run-telemetry.ts` + their
co-located `*.test.ts` (and the plan/stories/harness docs). `src/cli/telemetry.ts` (the fs
shell) is untouched — no new deps, the population + rules are already loaded.

## Architecture (mirrors the S1a/S1b/S2/S3a/S3b trio + benchmark.ts)

- **`src/engine/telemetry.ts`** — a new pure `reduceAttribution(fights, rules)` sibling to
  `reduceUsage` / `reduceDegrades` / `reduceOccupancy`. **The one signature divergence:** it
  also takes `rules` — the prior reducers took only `readonly FightResult[]`, but attribution
  needs each technique's `[startup, startup+active−1]` window, sourced from `rules.throw`
  (for `throw`) and `rules.moves[X]` (for the 12 move techniques incl. `sweep`). It stays
  pure — `rules` is a plain param, testable with a fixture `Rules`. Per fight, per fighter
  side, it: (a) enumerates honoured-starts (reusing the `honouredTechnique` /
  `degrade === null` predicate the usage reducer already uses), each carrying its absolute
  window `[start.tick + startup, start.tick + startup + active − 1]`; (b) computes per-tick
  positive scoreboard deltas for that side; (c) attributes each positive delta to the
  covering honoured-start (unique — windows provably never overlap, S4-8); (d) sums an
  uncovered delta into a per-fighter `excludedPenaltyPts`. Returns `AttributionRow[]` (all 13
  techniques) in the S4-2 total order. `runVariety` calls it with the existing `fights`
  array + the run's `rules`, and adds `attribution: AttributionRow[]` to the `VarietyReport`.
- **`src/cli/run-telemetry.ts`** — a new `renderAttribution(report)` section appended after
  the occupancy table; `--json` carries the attribution automatically (it rides inside
  `report`, which the S1b envelope already serialises). No legend (S4-9: no flag). Sort by
  `pts` desc → `starts` desc → canonical order (S4-2). Knockdown-class rows (`sweep`,
  `hiza-geri`) blank their `land` / `land%` / `pts/start` cells to `—` (S4-3).
- **`src/cli/telemetry.ts`** — untouched.

## The metric (S4-1, the resolved core)

Over every honoured-start of every round-robin fight, for each fighter side independently:

- A **honoured-start** of technique X = a frame where the fighter's `action` resolves to X
  (an `attack`/`throw`/`sweep`) AND `degrade === null` — **exactly the S1a usage predicate**,
  so `starts(X)` == the S1a usage count.
- A **positive scoreboard delta** at tick `t` = `frame[t].points − frame[t−1].points > 0`
  for that fighter (the frame `points` is post-tick; the first frame's baseline is 0).
- **Attribution:** a delta at tick `t` is credited to the honoured-start `S` iff
  `t − S.tick ∈ [startup(X), startup(X) + active(X) − 1]`. Windows provably never overlap
  (S4-8) ⇒ at most one covering `S`, so this is a total function. The whole delta (counter
  bonus **included**) goes to `S`'s technique.
- A move **lands** iff a covering delta exists in its window; it scores **at most once per
  start** (the `scored` latch), so `land` is binary per start and `land ≤ starts`.
- A positive delta with **no** covering honoured-start is a jogai/passivity **penalty**
  (`sim.ts:1058`, +1 to the opponent — the only non-move delta) ⇒ **excluded** from all
  attribution and summed into `excludedPenaltyPts`.
- Per technique: `pts(X)` = Σ attributed deltas; `land% = land/starts`; `pts/start =
pts/starts` (both `null` when `starts === 0`).

Consequences that pin the tests:

- **Master sum invariant (S4-5):** `Σ pts(X) + Σ excludedPenaltyPts == Σ FightResult.scores`
  (a.scores + b.scores over all fights). Every combat delta is covered (attributed) and
  every penalty delta is uncovered (excluded); the two partitions exhaust the scoreboard.
- **Reconciliation (S4-4):** `Σ excludedPenaltyPts == Σ_fighter max(0, foulCount − 1)`, where
  `foulCount(f) = FightResult.fouls[f].jogai + .passivity` (each foul beyond the first awards
  +1 to the opponent). Asserted so a window-math drift (a real combat delta wrongly dropped
  as "penalty") surfaces loudly instead of silently.
- **Score-0 knockdown moves (S4-3):** `sweep` + `hiza-geri` (`score:0`, `knockdown:true`)
  score via the LATER okizeme finisher (`sim.ts:829`), which correctly keeps the delta credit
  — NO chain reconstruction. They are flagged `knockdownClass`; the render blanks their
  `land`/`land%`/`pts-per-start` to `—` (not `0.0%`) so the 0 reads as "scores via okizeme."
  `tobi-geri` is NOT knockdown-class — a normal row whose arc-truncated no-scores are honest
  whiffs.

## Types (added by the slice, TDD-faithful — final shape settled at GREEN)

```ts
// S4: scoring attribution. Per technique, joins each positive scoreboard delta to the
// honoured-start whose [startup, startup+active−1] window covers the delta tick (windows
// never overlap ⇒ unique). `pts` includes counter bonuses (whole delta to the move).
// sweep + hiza-geri are score-0 knockdown moves (they score via the okizeme finisher, not
// directly) ⇒ knockdownClass: the render blanks land/land%/pts-per-start to "—".
export type AttributionRow = {
  technique: Technique; // all 13, always present, in the S4-2 total order
  starts: number; // honoured-starts of X (== the S1a usage count)
  land: number; // starts whose window caught a positive delta (binary per start ⇒ land ≤ starts)
  pts: number; // summed attributed deltas, counter bonuses included
  landRate: number | null; // land/starts; null when starts === 0 (÷0 → "—")
  ptsPerStart: number | null; // pts/starts; null likewise
  knockdownClass: boolean; // sweep/hiza — render land + rates as "—" (scores via okizeme)
};
// VarietyReport gains: attribution: AttributionRow[];
// (excludedPenaltyPts is an internal reconciliation quantity; whether to also surface it in
//  the report/JSON is a CONFIRM micro-decision — the test asserts it regardless.)
```

## Acceptance Criteria (the resolved S4-1…S4-11)

- [ ] per technique `starts · land · pts` via the `[startup, startup+active−1]` window join;
      `land` binary per start; `starts` == the S1a usage count (S4-1)
- [ ] fifth section, columns `move · starts · land · land% · pts · pts/start`; sort `pts`
      desc → `starts` desc → canonical; 1 dp; all 13 present (S4-2)
- [ ] `sweep` + `hiza-geri` render knockdown-class (`land`/`land%`/`pts-per-start` → `—`,
      `pts` 0, note); strict attribution, no chain reconstruction; `tobi-geri` NOT
      knockdown-class (S4-3)
- [ ] a positive delta with no covering start is excluded; excluded total reconciles to
      `Σ max(0, foulCount − 1)` from `FightResult.fouls` (S4-4)
- [ ] master invariant `Σ pts + Σ excluded == Σ final scores`, counters included (S4-5)
- [ ] `starts == 0` → `land` 0, `pts` 0, `land%`/`pts-per-start` `—`, never omitted (S4-6)
- [ ] zero-total (no scores landed) → every rate `—`, no ÷0 NaN/crash (S4-7)
- [ ] rekka/cancel chains unambiguous (windows never overlap); air (`tobi-geri`) window exact
      (S4-8)
- [ ] no `⚠`, no legend, no sample gate; exit 0 always (S4-9)
- [ ] `--json` carries `attribution` additively on `VarietyReport`; envelope version
      unchanged; round-trips (S4-10)
- [ ] byte-identical across two runs; no INPUT_HASH / BENCHMARK_VERSION impact (S4-11)

## Slice count — why one slice

Same reasoning as S3a/S3b: **no flag** (S4-9), and the integration path — a new `reduce*` +
a new `render*` section + `--json` riding the S1b envelope — is proven five times over
(S1a/S1b/S2/S3a/S3b), so there is no walking-skeleton risk left to burn down. This is the
**meatiest** of the S3/S4 readouts (window reconstruction + penalty exclusion +
reconciliation + knockdown-class rendering), but it is still ONE observable behavior (the
attribution section) through one path — and it is **not** separable: shipping the
attribution numbers without penalty exclusion would put _wrong_ per-move totals on `main`
(un-excluded +1s mis-attributed to whatever move is in-window), a broken intermediate state.
So the exclusion + its reconciliation guard must land WITH the first numbers. S4 is therefore
**one PR-sized slice**. (If the reconstruction proves fiddly at RED, the fallback split is
core-attribution-with-exclusion first, richer knockdown-class presentation second — but the
default and expectation is one slice.)

## Slice 1 (only): the scoring-attribution section

**Value**: the designer sees, per technique, `starts · land · land% · pts · pts/start`
beneath the occupancy table — answering "which moves actually score vs whiff?" and
reconciling with S1 usage — in one readout.
**Path**: `npm run telemetry` → `runVariety` builds `matchups` → `fights` (unchanged) → new
pure `reduceAttribution(fights, rules)` → `VarietyReport.attribution` → `renderAttribution`
appended to stdout; `--json` carries it for free. Skips: nothing deferred (no flag; exclusion
is intrinsic, not deferrable).
**Covers**: S4-1 … S4-11.
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.
**Acceptance criteria** (present + CONFIRM before code): the eleven boxes above.
**RED** (mutation-aware — likely mutants from `resources/mutator-rules.md`):

- **window join (S4-1)**: a synthetic fight where fighter A honour-starts `mae-geri`
  (startup 9, active 3) at tick 0 and `points` rises by 2 at tick 9 → assert
  `mae-geri.pts == 2`, `land == 1`. Add a delta at tick 8 (before window) and tick 12 (after
  window) → those are NOT attributed to that start — kills `>=`↔`>`/`<=`↔`<` on the window
  bounds and an off-by-one on `startup`/`startup+active−1`.
- **positive-delta gate (S4-1)**: a flat `points` (no rise) in a start's window → `land 0`,
  `pts 0` — kills `> 0`→`>= 0` (a zero delta must not count as a land).
- **at-most-once / binary land (S4-1)**: a start whose window has one +2 delta → `land 1`,
  `pts 2` (not `land 2`) — kills a per-delta-tick land count.
- **penalty exclusion (S4-4)**: a fight with a jogai/passivity penalty (a +1 delta with no
  covering start) → that +1 is NOT in any technique's `pts`, and the excluded total ==
  `Σ max(0, foulCount − 1)` — kills "attribute the nearest start anyway" and a wrong
  `max(0, k−1)` (off-by-one on the free first warning).
- **sum invariant (S4-5)**: a mixed fixture (combat scores + a penalty) → `Σ pts + Σ excluded
== Σ final scores` — the master guard; kills a dropped/double-counted delta and a
  counter-bonus split (whole delta must land on the move).
- **knockdown-class (S4-3)**: a fixture where `sweep` honour-starts N times and the okizeme
  finisher (a later strike) scores → `sweep.knockdownClass == true`, `sweep.pts 0`, and the
  finisher (not sweep) holds the 3; the render shows `sweep`'s land/land%/pts-per-start as
  `—`. `hiza-geri` likewise. Assert `tobi-geri.knockdownClass == false` — kills mis-flagging
  the wrong moves and crediting the finish back to the setup.
- **starts == S1a usage (S4-1)**: assert `reduceAttribution` `starts` per technique equals
  `reduceUsage` count on the same fights — kills a divergent honoured-start predicate.
- **zero-start (S4-6)**: a technique never honour-started → row present, `starts 0`, `land 0`,
  `pts 0`, `landRate`/`ptsPerStart` `null` (render `—`) — kills a filter-out-empty and a
  `starts===0`→`!==0` ÷0 guard flip.
- **zero-total (S4-7)**: an all-turtle / eventless fixture (no scores) → every `landRate`/
  `ptsPerStart` `null`, no NaN/crash — kills `0`→`1` and a missing ÷0 guard.
- **sort + row order (S4-2)**: a fixture where a low-`pts` move would sort above a high-`pts`
  one under a wrong key → assert `pts` desc, ties by `starts` desc, then canonical — kills a
  flipped comparator and a mis-ordered tie-break (mirrors the S2/S3a two-list-sort lesson).
- **render presentation (S4-2/3)**: exact `toBe` on the rendered section string (columns,
  labels, `.toFixed(1)`, the knockdown-class `—` blanking, the one-line knockdown note) —
  kills spacing/label/format mutants (the S1b exact-render lesson).
- **no flag / exit 0 (S4-9)**: assert the section contains no `⚠` and no legend even with a
  dominant scorer, and the CLI still exits 0.
- **`--json` round-trip (S4-10)**: `JSON.parse(stdout).report` `toEqual` `runVariety(cfg)`;
  envelope `version` unchanged.
- **determinism (S4-11)**: `renderAttribution` twice `toEqual`; `git diff --name-only` shows
  no scoring-input file touched.

**GREEN**: `reduceAttribution(fights, rules)` (build the per-technique `{startup, active}`
map from `rules.throw` + `rules.moves`; per fighter side enumerate honoured-starts with
absolute windows, compute per-tick positive deltas, attribute each to its covering start or
the penalty bucket; tally `starts`/`land`/`pts` + `excludedPenaltyPts`; flag
`knockdownClass` for the two `score:0`+`knockdown` moves); wire into `runVariety` (pass the
run's `rules`); `renderAttribution` (sort `pts`↓→`starts`↓→canonical, 1-dp rates, `—` for
null + knockdown-class, the note, no flag).
**MUTATE**: `npx stryker run --mutate "src/engine/telemetry.ts,src/cli/run-telemetry.ts"`.
**KILL MUTANTS**: expect window-bound comparator survivors (add the exact off-by-one seam
fixtures), a `> 0`→`>= 0` delta-gate survivor, the `max(0, k−1)` penalty-reconciliation
edge, and render-blanking survivors on the knockdown-class cells. Refactor for
mutation-observability where a survivor is equivalent-looking (the recurring project lesson —
e.g. surface the covering-start search so a `-1`/`findIndex` sentinel is load-bearing, not
shadowed). Ask if any survivor's value is ambiguous.
**REFACTOR**: assess sharing the honoured-start enumeration with `reduceUsage` /
`reduceOpeners` (all three walk honoured-starts) — extract only if it removes real
duplication of KNOWLEDGE, not merely similar code (the prior reducers stayed split
deliberately; the window-join is attribution-specific). Only if it adds value.
**Done when**: all eleven AC met, mutation reviewed (100% or documented equivalents — the
Lua-glue-style exemption does not apply here; this is pure TS), `git diff` clean of
TCB/version files, full `npm test` green, human approves commit.

## Pre-PR Quality Gate

1. Mutation testing — `mutation-testing` skill, scoped to the two touched files; target
   100% (equivalents documented, as prior slices did).
2. Refactoring assessment — `refactoring` skill.
3. `npm run typecheck` + `npm run lint` + `npm run format:check` clean (format only my files;
   the hand-wrapped live plan/stories/harness docs are intentionally not prettier'd).
4. `git diff --name-only` proves no scoring-input / TCB / version file touched.
5. Full `npm test` green.
6. Real-gauntlet smoke: `npm run telemetry` — sanity-check the attribution section against the
   scoreboard (the sum invariant should visibly hold; sweep/hiza show `—`).

## Notes / open micro-decisions (resolve at CONFIRM, not blocking)

- **`rules` source in `runVariety`** — pass the SAME `Rules` the round-robin ran on
  (`CANONICAL_RULES` via the existing config path); no new import, no second ruleset. Pin the
  exact wiring at GREEN.
- **Surface `excludedPenaltyPts`?** — it is an internal reconciliation quantity; whether to
  also show a "penalty pts (excluded)" line in the header/section or carry it in `--json` is a
  CONFIRM micro-decision. The reconciliation test asserts it either way.
- **Knockdown-class note wording** — "knockdown setups: they score via the okizeme finisher,
  not directly" is microcopy; pinned by the exact-`toBe` render test, reword at CONFIRM.
- **Column labels / header** — `move · starts · land · land% · pts · pts/start`; exact widths
  match `renderReport`/`renderOccupancy` style, pinned by the render tests, not pre-specified.
- **`pts/start` for knockdown-class vs zero-start** — both render `—`, but for different
  reasons (knockdown-class: not a point move; zero-start: ÷0). The `knockdownClass` flag
  disambiguates them for a `--json` consumer; the human table shows `—` for both.
- **Counter breakdown is OUT of scope** — counters ride inside each move's `pts` (decision
  #10, Q4). A base-vs-counter split, if ever wanted, is a separate future slice.
- **Row/reducer naming** — `telemetry.ts` already has an `Attribution` type meaning
  _per-bot adoption_ (`reducePerBot`), so name the S4 row + reducer to avoid collision /
  confusion (likely `ScoringRow` + `reduceScoring`, or `EffectivenessRow`). Settle at GREEN;
  the plan writes `AttributionRow` / `reduceAttribution` as placeholders for clarity here.

---

_Per `[[archive-plans-not-delete]]`: on completion, archive to `docs/archive/` + a README
entry (do NOT delete). The sibling `variety-telemetry-{harness,stories}.md` scoping trail
stays live for S5+._
