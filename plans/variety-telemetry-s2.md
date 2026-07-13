# Plan: Variety telemetry — S2 (opener win-rate)

**Branch**: PR-per-slice (`feat/variety-telemetry-s2-openers`, then `-flag`)
**Status**: Active
**Parent story**: `variety-telemetry-stories.md` §S2 (hardened via find-gaps 2026-07-13,
examples S2-1…S2-8). Design locked in `variety-telemetry-harness.md` §Resolved
decision #5 (opener = first honoured commitment → that fighter's fight outcome).

## Goal

The roster designer runs `npm run telemetry` and sees, beneath the S1 usage histogram, a
per-**opener** win-rate table answering DESIGN §P7's second balance dial — *"does any
opener over-win?"* — with the `>60%` breach flagged (sample-gated so a 6-bot reference
population doesn't false-alarm).

## Non-negotiable invariant (inherited from S1a/S1b)

A **pure read-only reduction** over `runFight`. NO change to any scoring-input file
(`sim.ts`/`dsl.ts`/`types.ts`/`prng.ts`/`rules.ts`/`benchmark.ts`/`benchmark-config.ts`);
NO `INPUT_HASH` flip; NO `BENCHMARK_VERSION` bump; `npm run fight` stays byte-identical.
Verify each PR with `git diff --name-only` touching only `src/engine/telemetry.ts`,
`src/cli/run-telemetry.ts`, `src/cli/telemetry.ts` + their co-located `*.test.ts` (and
the plan/stories docs). The opener join reads `FightResult.winner` + `.events` only —
both already emitted.

## Architecture (mirrors the S1a/S1b trio + benchmark.ts)

- **`src/engine/telemetry.ts`** — a new pure `reduceOpeners(matchups)` sibling
  to `reduceUsage` / `reducePerBot` (no `botCount` — openers key by technique, not bot).
  It reuses the existing `Matchup { a, b, fight }`
  (already built by `runVariety`) and `honouredTechnique`. `runVariety` calls it and adds
  `openers: OpenerRow[]` + `nullOpeners: number` to the returned `VarietyReport`. No new
  run inputs — every datum (first honoured commitment per side, per-side outcome from
  `fight.winner`) is already in `matchups`.
- **`src/cli/run-telemetry.ts`** — a new `renderOpeners(report)` section appended after
  the usage table; `--json` carries the openers automatically (they ride inside
  `report`, which the S1b envelope already serialises).
- **`src/cli/telemetry.ts`** — untouched (no new deps; the shell already loads the
  population + calls the pure CLI).

## Types (added incrementally by the slices, TDD-faithful)

```ts
// Slice 1:
export type OpenerRow = {
  technique: Technique;         // same 13-technique key space as PooledRow
  opens: number;                // (fighter, fight) observations that opened with this move
  wins: number; losses: number; draws: number; // opens === wins + losses + draws
  winRate: number | null;       // wins / opens (raw fraction); null when opens === 0 (÷0 → "—")
};
// VarietyReport gains: openers: OpenerRow[]; nullOpeners: number;

// Slice 2 adds one field to OpenerRow:
//   dominant: boolean;         // winRate > OPENER_FLAG_THRESHOLD AND opens >= MIN_OPENER_SAMPLE
```

## Acceptance Criteria (whole story — the hardened S2-1…S2-8)

- [ ] Each fighter's opener = its first honoured technique commitment in a fight, joined
      to that fighter's outcome (`FightResult.winner`); up to 2 observations per fight (S2-1)
- [ ] win-rate = wins / opens with `opens = wins+losses+draws`; draws in the denominator,
      never a win; W/L/D each shown (S2-2)
- [ ] `⚠` iff win-rate strictly > `OPENER_FLAG_THRESHOLD` (0.60) AND `opens ≥ MIN_OPENER_SAMPLE`;
      exit 0 always; legend printed (S2-3)
- [ ] pure-turtle (fighter, fight) → null opener, excluded from rates, counted (S2-4)
- [ ] 2nd section; columns `opener·opens·W·L·D·win%·⚠`; sort win%↓ → opens↓ → canonical (S2-5)
- [ ] all 13 techniques listed; 0-open rows render win% `—` and sink to the bottom (S2-6)
- [ ] `--json` carries `openers` + `nullOpeners` additively; envelope version unchanged;
      round-trips (S2-7)
- [ ] byte-identical across two runs; no INPUT_HASH / BENCHMARK_VERSION impact (S2-8)

## Slices

Every slice follows RED–GREEN–MUTATE–KILL MUTANTS–REFACTOR. Before code, load `tdd`,
`testing`, `mutation-testing`, `refactoring`. Present slice acceptance criteria and get
CONFIRM before writing any code. Wait for explicit commit approval.

### Slice 1: opener win-rate table (the walking skeleton, no flag)

**Value**: the designer sees, per opener, `opens · W · L · D · win%` beneath the usage
histogram — already answers "which openers win most?" at the number level.
**Path**: `npm run telemetry` → `runVariety` builds `matchups` (unchanged) → new pure
`reduceOpeners(matchups)` → `VarietyReport.openers`/`nullOpeners` → `renderOpeners`
appended to stdout; `--json` carries it for free. Skips: the `⚠` flag + legend (Slice 2).
**Covers**: S2-1, S2-2, S2-4, S2-5, S2-6, S2-7, S2-8.
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.
**Acceptance criteria** (present + CONFIRM before code):
- opener = FIRST honoured commitment per side; a fighter that commits X then Y opens with X
- outcome join: an A-won fight credits side-A's opener a **win** and side-B's opener a **loss**;
  a draw credits **both** openers a draw (opens++, wins unchanged)
- `winRate = wins/opens`, `opens = wins+losses+draws`; 0-open → `winRate null` → `—`
- pure-turtle (fighter, fight) → `nullOpeners++`, contributes to no opener row
- render: 2nd section, exact columns, sort win%↓ → opens↓ → canonical; 0-open rows `—` at bottom;
  all 13 techniques present
- `--json` round-trips (`JSON.parse(stdout).report` `toEqual` `runVariety(cfg)`); envelope
  `version` unchanged
- two runs byte-identical; `git diff --name-only` shows no scoring-input file touched
**RED** (mutation-aware — likely mutants from `resources/mutator-rules.md`):
- `winRate = wins/opens`: fixture with a known non-symmetric W/L/D (e.g. 6W/2L/2D → 0.6) →
  exact `toBe` (kills `wins↔losses`, `/`→`*`)
- `opens = wins+losses+draws`: all three terms non-zero, distinct → exact opens (kills a
  dropped `+` term / `+`→`-`)
- 0-open ÷0 guard: a technique nobody opens with → `winRate === null`, renders `—` (kills
  `=== 0`→`!== 0`, `0`→`1`)
- outcome mapping: separate A-wins / B-wins / draw fixtures pin each branch (kills
  `winner==="A"` flips and draw-as-win)
- opener = first: fixture committing X@early then Y@late → opener X (kills first↔last)
- null opener: all-idle fighter fixture → `nullOpeners` exact, no phantom opener row
- sort: crafted rows exercising each tie-break key in turn (equal win% different opens;
  equal win%+opens different canonical; a `—` row) → exact rendered order (mirror S1a-7;
  kills `b-a`→`a-b`, tie-break drop, null-to-top)
- render presentation: exact `toBe` on the rendered section string (kills column/label/
  spacing mutants — the S1b lesson)
- determinism: `renderOpeners` twice `toEqual`
**GREEN**: `reduceOpeners` (flatMap matchups → per-side {opener, outcome}, filter nulls to
`nullOpeners`, tally per technique over all 13, `winRate` with ÷0 guard); wire into
`runVariety`; `renderOpeners` with the sort comparator + `—` guard.
**MUTATE**: `npx stryker run --mutate "src/engine/telemetry.ts,src/cli/run-telemetry.ts"`.
**KILL MUTANTS**: expect the S1b-class survivors — a `—`/null else-branch (assert the
exact `—` cell + stdout tail), a sort tie-break equivalent (add the discriminating
fixture). Ask if any survivor's value is ambiguous.
**REFACTOR**: assess sharing the tally shape with `reducePerBot`; only if it adds value
(don't force a premature abstraction — the S1b types stayed split deliberately).
**Done when**: all Slice-1 AC met, mutation reviewed, `git diff` clean of TCB, human approves.

### Slice 2: the sample-gated §P7 breach flag

**Value**: the designer sees which openers actually breach the §P7 ~60% target, without
1-open false alarms — the headline answer to "does any opener over-win?"
**Path**: same report; `OpenerRow` gains `dominant`; `renderOpeners` shows `⚠` on
dominant rows + a one-line legend when ≥1 is flagged. Exit 0 unchanged.
**Covers**: S2-3.
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.
**Acceptance criteria** (present + CONFIRM before code):
- `dominant = winRate > OPENER_FLAG_THRESHOLD (0.60) AND opens ≥ MIN_OPENER_SAMPLE`
- exactly 60.0% → NOT flagged (strict `>`); just above 60% with `opens ≥ min` → flagged
- above 60% but `opens < MIN_OPENER_SAMPLE` → NOT flagged (the gate kills 1-open-100%)
- `opens` exactly at `MIN_OPENER_SAMPLE` boundary → flagged (`>=`, not `>`)
- process still exits 0; legend line printed iff ≥1 opener is dominant
- both `OPENER_FLAG_THRESHOLD` and `MIN_OPENER_SAMPLE` are exported named constants
**RED** (mutation-aware — boundary + boolean mutants are the whole risk here):
- exactly-60% fixture → not dominant (kills `>`→`>=`)
- 60%+ε with `opens ≥ min` → dominant (kills `>`→`<`, threshold literal — use a HARDCODED
  expected boundary, the S1a `SMALL_POPULATION` lesson)
- 60%+ε with `opens = min-1` → not dominant; `opens = min` → dominant (kills `>=`→`>`,
  `&&`→`||`, and the `MIN_OPENER_SAMPLE` literal)
- legend present iff a dominant row exists; assert `stdout` tail so the `? :""` else-branch
  can't survive (the S1b legend lesson)
- `⚠` renders on exactly the dominant rows (exact `toBe`)
- exit code stays 0 with a flagged opener (no gate — decision #8)
**GREEN**: add `dominant` to `OpenerRow` in `reduceOpeners` (the guarded `&&`); render `⚠`
+ conditional legend.
**MUTATE**: same scoped Stryker run.
**KILL MUTANTS**: the boundary/boolean survivors above; hardcoded-boundary tests, not
computed expectations.
**REFACTOR**: assess sharing the legend/flag shape with the usage `renderLegend`; only if
it removes real duplication of knowledge.
**Done when**: all Slice-2 AC met, full suite green, mutation 100% (or documented
equivalents), `git diff` clean of TCB, human approves.

## Pre-PR Quality Gate (each slice)

1. Mutation testing — `mutation-testing` skill, scoped to the two touched files; target
   100% (equivalents documented, as S1b did for Lua-glue-style survivors — none expected here).
2. Refactoring assessment — `refactoring` skill.
3. `npm run typecheck` + `npm run lint` + `npm run format:check` clean (format only my files).
4. `git diff --name-only` proves no scoring-input / TCB / version file touched.
5. Full `npm test` green.

## Notes / open micro-decisions (resolve at CONFIRM, not blocking)

- `MIN_OPENER_SAMPLE` default ~10 — a starting value; tune once the real gauntlet numbers
  are seen (it's a named constant, retunable, and the header already carries the global
  small-sample caveat). Confirm the exact default when Slice 2's AC is presented.
- Column widths / exact spacing — match `renderReport`'s existing style; pinned by the
  exact-`toBe` render tests, not pre-specified here.

---
*Per `[[archive-plans-not-delete]]`: on completion, archive to `docs/archive/` + a README
entry (do NOT delete). The sibling `variety-telemetry-{harness,stories}.md` scoping trail
stays live for S3+.*
