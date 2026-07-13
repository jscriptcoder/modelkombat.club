# Plan: Variety telemetry — S3b (reach-zone occupancy)

**Branch**: `feat/variety-telemetry-s3b-occupancy` (single slice — see "Slice count")
**Status**: Active
**Parent story**: `variety-telemetry-stories.md` §S3b (resolved via grill-me 2026-07-13,
examples S3b-1…S3b-9). Design grounded in the engine: distance = `|a.x − b.x|` (the sim's
own horizontal reach gate, `sim.ts:745`); `x` is on every `FighterFrame` and pushed every
tick (`sim.ts:1322`, dense); `ring.width = 600000`, `startGap = 300000` (`rules.ts:29-30`).
Bucketing locked in `variety-telemetry-harness.md` §Resolved decisions #9.

## Goal

The roster designer runs `npm run telemetry` and sees, beneath the usage (S1), opener (S2),
and degrade (S3a) sections, a **reach-zone occupancy** histogram answering _"which reach
zones do fights actually happen in — and is the >300k long-poke range ever occupied?"_ — the
spacing signal that tells a technique whose reach niche is live apart from one whose zone the
fighters never enter (a spacing-dead move → buff / re-role / cut).

## Non-negotiable invariant (inherited from S1a/S1b/S2/S3a)

A **pure read-only reduction** over `runFight`. NO change to any scoring-input file
(`sim.ts`/`dsl.ts`/`types.ts`/`prng.ts`/`rules.ts`/`benchmark.ts`/`benchmark-config.ts`);
NO `INPUT_HASH` flip; NO `BENCHMARK_VERSION` bump; `npm run fight` stays byte-identical.
The occupancy reduction reads only `.x` (already emitted every tick). Verify the PR with
`git diff --name-only` touching only `src/engine/telemetry.ts`, `src/cli/run-telemetry.ts`

- their co-located `*.test.ts` (and the plan/stories/harness docs). `src/cli/telemetry.ts`
  (the fs shell) is untouched — no new deps, the population is already loaded.

## Architecture (mirrors the S1a/S1b/S2/S3a trio + benchmark.ts)

- **`src/engine/telemetry.ts`** — a new pure `reduceOccupancy(fights)` sibling to
  `reduceUsage` / `reduceDegrades` (both already take `readonly FightResult[]` — occupancy
  needs no bot identity or winner). It flatMaps each fight's events to **one distance per
  tick** (`Math.abs(event.a.x − event.b.x)` — NOT `[a, b]`, the key divergence from
  `reduceDegrades`), buckets into the 5 `REACH_ZONES`, and returns `OccupancyRow[]` in the
  fixed near→far order. `runVariety` calls it with the existing `fights` array (already
  built for `reduceUsage` / `reduceDegrades`) and adds `occupancy: OccupancyRow[]` to the
  returned `VarietyReport`.
- **`src/cli/run-telemetry.ts`** — a new `renderOccupancy(report)` section appended after
  the degrade table; `--json` carries the occupancy automatically (it rides inside
  `report`, which the S1b envelope already serialises). No legend (S3b-7: no flag). No sort
  — the rows are pre-ordered near→far.
- **`src/cli/telemetry.ts`** — untouched.

## The metric (S3b-1, the resolved Blocker)

Over every tick of every round-robin fight (ONE sample per tick — distance is symmetric):

- `d = |event.a.x − event.b.x|` — one distance per `FightEvent` (NOT per fighter). **All
  frames counted**, no exclusions (yame-reset re-approach + okizeme clinch are genuine
  spacing).
- `d` is placed in exactly one of 5 half-open reach tiers (classify by `d < zone.hi` — the
  tiers are contiguous from 0; the ring ceiling `d == 600000` pins to the top `out` tier):
  `clinch [0,120k)` · `hand [120,240k)` · `kick [240,300k)` · `poke [300,330k)` ·
  `out [330,600k]`.
- `totalFrames = Σ ticks` (the count of distance samples). `share(zone) = frames(zone) /
totalFrames`; `null` when `totalFrames === 0` (÷0 → `n/a`).

Consequences that pin the tests:

- The 5 tiers **partition** `[0, ring.width]` (contiguous + exhaustive), so
  `Σ frames == totalFrames` and the raw shares sum to exactly 1.0 when `totalFrames > 0`
  (S3b-5).
- Denominator = total **ticks**, NOT 2× — a per-fighter double-count (the `reduceDegrades`
  `[a, b]` shape, copy-pasted) is the signature mutant; a fixture with a known tick count
  pins `frames` / `totalFrames` to ticks, not `2×` (S3b-1).
- Breakpoints are reach-ladder rungs (throw 120k / reverse 240k / roundhouse + startGap
  300k / ushiro 330k), spelled as named constants with provenance comments — legible +
  retunable, not magic literals.

## Types (added by the slice, TDD-faithful)

```ts
// S3b: reach-zone occupancy. The 5 coarse tiers partition inter-fighter distance
// (|a.x − b.x|, [0, ring.width]) at reach-ladder breakpoints — throw-floor 120k, the
// reverse-punch hand anchor 240k, roundhouse/startGap 300k, the longest reach (ushiro) 330k.
// Contiguous half-open tiers (classify by `d < hi`; the ceiling pins to the top tier), listed
// in this FIXED near→far order — the render honours it (no share-sort: the axis is ordered).
// Named literals with provenance, not magic numbers, so the buckets are legible + retunable.
export const REACH_ZONES = [
  { id: "clinch", lo: 0, hi: 120000 }, // < throw: empi/hiza/throw infighting
  { id: "hand", lo: 120000, hi: 240000 }, // throw..reverse: sweep/uraken/jab/reverse
  { id: "kick", lo: 240000, hi: 300000 }, // reverse..roundhouse: tobi/shuto/mae/roundhouse
  { id: "poke", lo: 300000, hi: 330000 }, // roundhouse/startGap..ushiro: yoko/ushiro only
  { id: "out", lo: 330000, hi: 600000 }, // beyond all reach: approach/spacing (hi = ring.width, inclusive)
] as const;
export type ReachZone = (typeof REACH_ZONES)[number]["id"];

export type OccupancyRow = {
  zone: ReachZone; // the 5 tiers, always all present, fixed near→far order
  frames: number; // ticks whose |a.x − b.x| fell in this tier
  share: number | null; // frames / totalFrames (raw); null when totalFrames === 0 (÷0 → "n/a")
};
// VarietyReport gains: occupancy: OccupancyRow[];
```

## Acceptance Criteria (the resolved S3b-1…S3b-9)

- [ ] one distance per TICK (`|a.x − b.x|`, symmetric); denom = total ticks, NOT 2×; all
      frames, no exclusions; 5 half-open reach tiers at 120k/240k/300k/330k (S3b-1)
- [ ] fourth section, columns `zone · distance · frames · share%`; FIXED natural distance
      order (clinch→out), not share-desc; share to 1 dp; all 5 tiers present (S3b-2)
- [ ] an unoccupied tier → `frames 0`, `share 0.0%`, never omitted (poke-tail visibility)
      (S3b-3)
- [ ] `totalFrames == 0` → every share `n/a` (÷0 guard) (S3b-4)
- [ ] the 5 raw shares partition-sum to exactly 1.0 when `totalFrames > 0` (S3b-5)
- [ ] half-open `[lo,hi)`: boundary 120000 → `hand`; ceiling 600000 → `out`; no tick
      lost/double-counted (S3b-6)
- [ ] no `⚠`, no legend, no sample gate; exit 0 always (S3b-7)
- [ ] `--json` carries `occupancy` additively on `VarietyReport`; envelope version
      unchanged; round-trips (S3b-8)
- [ ] byte-identical across two runs; no INPUT_HASH / BENCHMARK_VERSION impact (S3b-9)

## Slice count — why one slice

Same reasoning as S3a: **no flag** (S3b-7), and the integration path — a new `reduce*` + a
new `render*` section + `--json` riding the S1b envelope — is proven four times over
(S1a/S1b/S2/S3a), so there is no walking-skeleton risk left to burn down. There is nothing
to defer into a second PR (the only boundary risk — the half-open partition — is intrinsic
to the one readout, not a separable behavior). Splitting it further would be a same-report
`+section` salami slice, precisely the "salami-slice smell" the stories doc warns against.
So S3b is **one PR-sized slice**, comparable in scope to S3a.

## Slice 1 (only): the reach-zone occupancy section

**Value**: the designer sees, per reach tier, `frames · share%` beneath the degrade table —
answering "where do fights spatially happen, and is the >300k poke range dead?" in one
readout.
**Path**: `npm run telemetry` → `runVariety` builds `matchups` → `fights` (unchanged) → new
pure `reduceOccupancy(fights)` → `VarietyReport.occupancy` → `renderOccupancy` appended to
stdout; `--json` carries it for free. Skips: nothing deferred (no flag exists to defer).
**Covers**: S3b-1 … S3b-9.
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.
**Acceptance criteria** (present + CONFIRM before code): the nine boxes above.
**RED** (mutation-aware — likely mutants from `resources/mutator-rules.md`):

- **per-tick single sample (S3b-1)**: a fixture of N events with known `a.x`/`b.x` → assert
  `Σ frames === N` (NOT 2N) — kills the copy-pasted `[a, b]` per-fighter double-count.
- **bucket boundaries (S3b-6)**: distances at each seam (119999→clinch, 120000→hand,
  239999→hand, 240000→kick, 299999→kick, 300000→poke, 329999→poke, 330000→out) and the
  ceiling 600000→out, plus 0→clinch → exact per-tier `frames` — kills `<`→`<=`, off-by-one
  on each breakpoint, and a mis-ordered tier `find`.
- **partition sum (S3b-5)**: a mixed-distance fixture → raw shares sum to exactly 1.0 AND
  `Σ frames === totalFrames` — kills a gap/overlap in the tiers.
- **share = frames/total (S3b-1)**: a fixture with a known non-round split (e.g. 3 of 12
  ticks in `kick` → 0.25) → exact `share` — kills `frames↔total`, `/`→`*`.
- **zero-zone (S3b-3)**: a fixture that never enters `poke` → that row present, `frames 0`,
  `share 0.0%` (not omitted) — kills a filter-out-empty.
- **zero-total (S3b-4)**: an empty `fights` (or eventless) fixture → every `share === null`,
  renders `n/a` — kills `=== 0`→`!== 0`, `0`→`1`.
- **row order (S3b-2)**: assert the rendered rows are in clinch→out order even when `poke`
  has the highest share — kills any accidental share-sort.
- **render presentation (S3b-2)**: exact `toBe` on the rendered section string (kills
  column/label/spacing/`.toFixed(1)` mutants — the S1b lesson).
- **no flag / exit 0 (S3b-7)**: assert the rendered section contains no `⚠` and no legend
  even with a 100%-in-one-zone fixture, and the CLI still exits 0.
- **`--json` round-trip (S3b-8)**: `JSON.parse(stdout).report` `toEqual` `runVariety(cfg)`;
  envelope `version` unchanged.
- **determinism (S3b-9)**: `renderOccupancy` twice `toEqual`; `git diff --name-only` shows
  no scoring-input file touched.

**GREEN**: `reduceOccupancy` (flatMap fights → one `|a.x − b.x|` per event; classify by
`d < zone.hi` with the ceiling pinning to `out`; tally per tier over all 5; `share` with
÷0 guard); wire into `runVariety`; `renderOccupancy` (fixed near→far rows, distance column,
1-dp share, `n/a` guard, no flag).
**MUTATE**: `npx stryker run --mutate "src/engine/telemetry.ts,src/cli/run-telemetry.ts"`.
**KILL MUTANTS**: expect a boundary comparator survivor (add the exact-seam fixture), an
`n/a`/null else-branch (assert the exact cell + stdout tail), and possibly the ceiling
fallback (`600000 → out`) needing its own sample. Ask if any survivor's value is ambiguous.
**REFACTOR**: assess sharing the tally shape with `reduceDegrades`; only if it removes real
duplication of knowledge (the prior reducers stayed split deliberately — don't force a
premature abstraction). The single-sample-per-tick divergence likely keeps it separate.
**Done when**: all nine AC met, mutation reviewed (100% or documented equivalents), `git
diff` clean of TCB/version files, full `npm test` green, human approves commit.

## Pre-PR Quality Gate

1. Mutation testing — `mutation-testing` skill, scoped to the two touched files; target
   100% (equivalents documented, as prior slices did — none expected).
2. Refactoring assessment — `refactoring` skill.
3. `npm run typecheck` + `npm run lint` + `npm run format:check` clean (format only my files).
4. `git diff --name-only` proves no scoring-input / TCB / version file touched.
5. Full `npm test` green.

## Notes / open micro-decisions (resolve at CONFIRM, not blocking)

- **Distance column display** — each row's distance interval (e.g. `120k–240k` or
  `120000–240000`) is microcopy; pinned by the exact-`toBe` render test, reword at CONFIRM.
- **In-range-move annotation** — the grill preview showed an optional "in-range moves"
  column (clinch → `empi, hiza, throw`, …). Static text derived from the reach ladder;
  include or drop at CONFIRM (pinned by the render test either way). Keeping it aids
  legibility so a reader needn't memorise the breakpoints.
- **`totalFrames` in the header** — optionally surface the total tick count near the
  header's `totalFights`; a small readability add, decide at CONFIRM.
- **Zone labels** — `clinch` / `hand range` / `kick range` / `poke range` / `out of range`
  (the approved grill preview); microcopy, pinned by the render test.
- **Height (`y`) occupancy is OUT of scope** — reach is horizontal (`|Δx|`); a height-band
  occupancy readout, if ever wanted, is a separate future slice.
- **Column widths / exact spacing** — match `renderReport`/`renderDegrades` style; pinned by
  the exact-`toBe` render tests, not pre-specified here.

---

_Per `[[archive-plans-not-delete]]`: on completion, archive to `docs/archive/` + a README
entry (do NOT delete). The sibling `variety-telemetry-{harness,stories}.md` scoping trail
stays live for S4+._
