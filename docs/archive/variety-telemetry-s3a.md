# Plan: Variety telemetry — S3a (per-move degrade-rate)

**Branch**: `feat/variety-telemetry-s3a-degrade` (single slice — see "Slice count")
**Status**: Active
**Parent story**: `variety-telemetry-stories.md` §S3a (hardened via find-gaps 2026-07-13,
examples S3a-1…S3a-8). Design grounded in `variety-telemetry-harness.md` §Metric 5 +
the engine (`sim.ts:70` — the 5 `DegradeReason`s; `sim.ts:1321` — every frame records the
bot's RETURNED action + honour result).

## Goal

The roster designer runs `npm run telemetry` and sees, beneath the usage histogram (S1)
and opener table (S2), a per-technique **start-failure** section answering _"which moves
does a bot keep choosing but fail to execute, and why?"_ — the usability signal that
tells a dead-in-the-histogram move apart from a hard-to-use one (Metric 5: `out-of-band`
⇒ fix band targeting vs `unaffordable` ⇒ fix stamina budgeting — different remedies).

## Non-negotiable invariant (inherited from S1a/S1b/S2)

A **pure read-only reduction** over `runFight`. NO change to any scoring-input file
(`sim.ts`/`dsl.ts`/`types.ts`/`prng.ts`/`rules.ts`/`benchmark.ts`/`benchmark-config.ts`);
NO `INPUT_HASH` flip; NO `BENCHMARK_VERSION` bump; `npm run fight` stays byte-identical.
The degrade reduction reads only `.action` + `.degrade` — both already emitted, and
`benchmark.ts` already walks `.degrade`. Verify the PR with `git diff --name-only`
touching only `src/engine/telemetry.ts`, `src/cli/run-telemetry.ts` + their co-located
`*.test.ts` (and the plan/stories docs). `src/cli/telemetry.ts` (the fs shell) is
untouched — no new deps, the population is already loaded.

## Architecture (mirrors the S1a/S1b/S2 trio + benchmark.ts)

- **`src/engine/telemetry.ts`** — a new pure `reduceDegrades(matchups)` sibling to
  `reduceUsage` / `reducePerBot` / `reduceOpeners`. It reuses the existing
  `Matchup { a, b, fight }` (already built by `runVariety`) and the same `techniqueOf`
  helper. `runVariety` calls it and adds `degrades: DegradeRow[]` to the returned
  `VarietyReport`. No new run inputs — every datum (per-frame chosen technique + degrade
  reason) is already in `matchups`.
- **`src/cli/run-telemetry.ts`** — a new `renderDegrades(report)` section appended after
  the opener table; `--json` carries the degrades automatically (they ride inside
  `report`, which the S1b envelope already serialises). No new legend (S3a-6: no flag).
- **`src/cli/telemetry.ts`** — untouched.

## The metric (S3a-1, the resolved Blocker)

For each technique X, over every frame of every round-robin fight (both fighters):

- `t = techniqueOf(frame.action)` — skip the frame if `t === null` (idle/step).
- **`degrade === "locked"` ⇒ skip the frame entirely** — a busy fighter's ignored input
  while committed to an already-honoured move (`sim.ts:512-513`), not a failed pick.
  Excluded from BOTH numerator and denominator.
- Otherwise the frame is a **start attempt** for `t`: `attempts(t)++`. If
  `degrade !== null` (i.e. a `FailureReason`), it is a **failed start**:
  `failedStarts(t)++` and `reasons(t)[degrade]++`.
- `rate(t) = failedStarts(t) / attempts(t)`; `null` when `attempts(t) === 0` (÷0 → `—`).

Consequences that pin the tests:

- `honoured(t)` (= `degrade === null` frames) **is exactly S1a's usage count**, so
  `attempts = usage-count + failedStarts` — the two sections reconcile numerically
  (S3a-5). A `locked`-only or never-chosen technique has `attempts === 0` → `—` (S3a-3).
- `FailureReason = "out-of-band" | "unaffordable" | "wrong-context" | "inert"` — the four
  genuine-gate reasons; `locked` is deliberately NOT one (S3a-1).

## Types (added by the slice, TDD-faithful)

```ts
// S3a: per-technique start-failure telemetry. `locked` is intentionally NOT a
// FailureReason — it is excluded from the whole computation (a busy fighter's ignored
// input, not a failed pick). FAILURE_REASONS is a const tuple so it doubles as the
// stable render column order (S3a-2) and the reason-tally key set.
export const FAILURE_REASONS = [
  "out-of-band",
  "unaffordable",
  "wrong-context",
  "inert",
] as const; // = Exclude<DegradeReason, "locked">, spelled out so the exclusion is visible
export type FailureReason = (typeof FAILURE_REASONS)[number];

export type DegradeRow = {
  technique: Technique; // same 13-technique key space as PooledRow / OpenerRow
  attempts: number; // honoured(X) + failedStarts(X); `locked` frames excluded
  failedStarts: number; // Σ reasons — X chosen & gate-failed
  rate: number | null; // failedStarts / attempts (raw); null when attempts === 0 (÷0 → "—")
  reasons: Record<FailureReason, number>; // per-reason failedStarts; sums to failedStarts
};
// VarietyReport gains: degrades: DegradeRow[];
```

_A `FAILURE_REASONS` ⊂ `DegradeReason` compile-time guard (a `satisfies`/assignability
test) keeps the tuple honest if `sim.ts` ever adds a reason — a new reason surfaces as a
type error to be classified (gate-failure vs commitment-artifact), not silently dropped._

## Acceptance Criteria (the hardened S3a-1…S3a-8)

- [ ] start-failure rate = `failedStarts / attempts`, `attempts = honoured + failedStarts`;
      `locked` excluded from numerator AND denominator (S3a-1)
- [ ] third section, columns `move · N · fail · rate% · out-of-band · unaffordable ·
    wrong-context · inert`; the four reason counts sum to `fail`; rate to 1 dp (S3a-2)
- [ ] all 13 techniques listed; `attempts == 0` → all-0 row, rate `—` (S3a-3)
- [ ] sort rate↓ → N↓ → canonical; `—` (0-attempt) rows sink to the bottom (S3a-4)
- [ ] `honoured(X)` == S1a usage count so `attempts = usage + failedStarts`; a
      chosen-but-always-fails move reads 100% here / 0 in the usage histogram; the report
      cross-references so a usage-`0` isn't misread as "never attempted" (S3a-5)
- [ ] no `⚠`, no legend, no sample gate; exit 0 always (S3a-6)
- [ ] `--json` carries `degrades` additively on `VarietyReport`; envelope version
      unchanged; round-trips (S3a-7)
- [ ] byte-identical across two runs; no INPUT_HASH / BENCHMARK_VERSION impact (S3a-8)

## Slice count — why one slice

S2 split into table + flag because the **flag** carried isolated boundary/gate risk
(`>` vs `>=`, the `MIN_OPENER_SAMPLE` conjunct) worth its own PR. S3a has **no flag**
(S3a-6), and the integration path — a new `reduce*` + a new `render*` section + `--json`
riding the S1b envelope — is already proven three times over (S1a/S1b/S2), so there is no
walking-skeleton risk left to burn down. Splitting the four reason columns into their own
PR would be a same-table `+columns` salami slice — precisely the "salami-slice smell" the
stories doc warns against. So S3a is **one PR-sized slice**, comparable in scope to S2
Slice 1 (which shipped a whole table).

## Slice 1 (only): the start-failure section

**Value**: the designer sees, per technique, `N · fail · rate% · <4 reason counts>`
beneath the opener table — answering "which moves are chosen but fail to start, and via
which gate?" in one readout.
**Path**: `npm run telemetry` → `runVariety` builds `matchups` (unchanged) → new pure
`reduceDegrades(matchups)` → `VarietyReport.degrades` → `renderDegrades` appended to
stdout; `--json` carries it for free. Skips: nothing deferred (no flag exists to defer).
**Covers**: S3a-1 … S3a-8.
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.
**Acceptance criteria** (present + CONFIRM before code): the eight boxes above.
**RED** (mutation-aware — likely mutants from `resources/mutator-rules.md`):

- **metric / locked-exclusion (S3a-1)**: a fixture where X is chosen with a mix —
  honoured, `out-of-band`, AND `locked` frames — asserts `attempts` counts honoured +
  out-of-band only (NOT locked) and `failedStarts` counts out-of-band only → exact `toBe`
  (kills "include locked", `attempts` off-by-the-locked-count, and `/`→`*`).
- **rate = fail/attempts (S3a-1)**: known non-symmetric fixture (e.g. 3 failed of 12
  attempts → 0.25) → exact `rate` (kills `fail↔attempts`, `/`→`*`).
- **per-reason sum invariant (S3a-2)**: a fixture with ≥2 distinct reasons non-zero →
  each `reasons[r]` exact AND `Σ reasons === failedStarts` (kills a dropped reason bucket
  / a mis-keyed increment).
- **zero-guard (S3a-3)**: a technique nobody attempts (or only `locked`) → `attempts 0`,
  `rate === null`, renders `—` (kills `=== 0`→`!== 0`, `0`→`1`, and a locked frame
  leaking into `attempts`).
- **sort (S3a-4)**: crafted rows exercising each tie-break key in turn (equal rate diff N;
  equal rate+N diff canonical; a `—` row) → exact rendered order — the S2 **two-list**
  lesson (live rows filtered+sorted, `—` rows appended) so V8's insertion-sort can't leave
  an untested comparator branch coincidentally canonical (kills `b-a`→`a-b`, tie-break
  drop, null-to-top).
- **render presentation (S3a-2)**: exact `toBe` on the rendered section string (kills
  column/label/spacing/`.toFixed(1)` mutants — the S1b lesson).
- **no flag / exit 0 (S3a-6)**: assert the rendered section contains no `⚠` and no legend
  even with a 100%-rate row, and the CLI still exits 0.
- **`--json` round-trip (S3a-7)**: `JSON.parse(stdout).report` `toEqual` `runVariety(cfg)`;
  envelope `version` unchanged.
- **determinism (S3a-8)**: `renderDegrades` twice `toEqual`; `git diff --name-only` shows
  no scoring-input file touched.

**GREEN**: `reduceDegrades` (flatMap matchups → per-frame `{technique, degrade}`, drop
`technique===null` and `degrade==="locked"`, tally per technique over all 13 with the
`FAILURE_REASONS` buckets, `rate` with ÷0 guard); wire into `runVariety`; `renderDegrades`
with the two-list sort + `—` guard + the S1a cross-reference note.
**MUTATE**: `npx stryker run --mutate "src/engine/telemetry.ts,src/cli/run-telemetry.ts"`.
**KILL MUTANTS**: expect the S2-class survivors — a `—`/null else-branch (assert the exact
`—` cell + stdout tail), a sort tie-break equivalent (add the discriminating fixture), and
possibly a `locked`-exclusion conditional that's runtime-equivalent on the gauntlet (add a
synthetic `locked` fixture so exclusion is observable). Ask if any survivor's value is
ambiguous.
**REFACTOR**: assess sharing the tally/sort shape with `reduceUsage`/`reduceOpeners`; only
if it removes real duplication of knowledge (the S1b/S2 types stayed split deliberately —
don't force a premature abstraction).
**Done when**: all eight AC met, mutation reviewed (100% or documented equivalents),
`git diff` clean of TCB/version files, full `npm test` green, human approves commit.

## Pre-PR Quality Gate

1. Mutation testing — `mutation-testing` skill, scoped to the two touched files; target
   100% (equivalents documented, as S1b did for Lua-glue-style survivors — none expected).
2. Refactoring assessment — `refactoring` skill.
3. `npm run typecheck` + `npm run lint` + `npm run format:check` clean (format only my files).
4. `git diff --name-only` proves no scoring-input / TCB / version file touched.
5. Full `npm test` green.

## Notes / open micro-decisions (resolve at CONFIRM, not blocking)

- **Reason column order** — `FAILURE_REASONS` order (`out-of-band`, `unaffordable`,
  `wrong-context`, `inert`) doubles as the render column order; confirm at CONFIRM.
- **Cross-reference wording (S3a-5)** — the exact line tying a usage-`0` to
  "attempted but never executed → see degrade section" is microcopy; pinned by the
  exact-`toBe` render test, reword freely at CONFIRM. (S1a-9 already promised the
  reciprocal reference; keep the two consistent.)
- **`wrong-context` / `inert` columns are ~0 for the gauntlet** — structurally near-zero
  for validated bots on `CANONICAL_RULES`, but the columns stay for population-stability
  (an override population or a future bot can trigger them); a 0 column is a visible
  datum, like a dead move (S1a-3). Not a reason to drop them.
- **Column widths / exact spacing** — match `renderReport`/`renderOpeners` style; pinned
  by the exact-`toBe` render tests, not pre-specified here.

---

_Per `[[archive-plans-not-delete]]`: on completion, archive to `docs/archive/` + a README
entry (do NOT delete). The sibling `variety-telemetry-{harness,stories}.md` scoping trail
stays live for S3b+._
