# Plan: Variety telemetry — S1b (enrichment: diversity · adoption · --json · override)

**Branch**: one `feat/*` branch per slice (below); **PR per slice**
**Status**: Active

## Goal

Enrich the shipped S1a `npm run telemetry` histogram into the full first-class variety
instrument: a diversity headline (effective-move-count + live/dead), a tempo-neutral
per-bot adoption column, machine-readable `--json`, and a population override so the same
command profiles any supplied bot set — still a pure read-only reduction over `runFight`
(no engine / TCB / `CANONICAL_RULES` change, no version bump).

## Context (source of truth)

- Child story + S1b acceptance examples: `plans/variety-telemetry-stories.md` (§S1b).
- Locked design decisions: `plans/variety-telemetry-harness.md` §Resolved decisions —
  **#3** share basis (pooled **+** per-bot adoption `k/N` + mean per-bot share), **#4**
  diversity = effective-move-count `exp(Shannon)` (Hill q=1) + `# live`/`# dead` + dead
  list, **#6** population default = gauntlet, **overridable** by path/glob; round-robin
  skips self-mirrors (`sameDoc`), **#7** stdout table **+ `--json`** raw `VarietyReport`.
- **Shipped S1a** (mirror + extend, do not rewrite): `src/engine/telemetry.ts`
  (`reduceUsage(fights)` + `runVariety(cfg)` + `VarietyReport{rows,totalCommitments,
totalFights}`), `src/cli/run-telemetry.ts` (pure `renderHeader` + `renderReport` +
  `runTelemetryCli(deps)`), `src/cli/telemetry.ts` (thin fs shell). Archived plan:
  `docs/archive/variety-telemetry-s1a.md`.
- Reuse: `benchmark.ts`'s exported **`sameDoc(a,b)`** (byte-identical doc compare) for the
  mirror-skip; `benchmark.ts`/`run-benchmark.ts` for the argv-parse + per-bot load-error
  patterns (`ValidationError` → stderr issues → non-zero exit).

## Non-negotiable invariants (must not be violated)

- **Read-only over the engine.** No change to `sim.ts` / `dsl.ts` / `types.ts` /
  `prng.ts` / `rules.ts` / `CANONICAL_RULES`. Therefore **no `INPUT_HASH` flip, no
  `BENCHMARK_VERSION` bump**; `npm run fight` stays byte-identical. If a slice seems to
  need an engine edit, STOP.
- Pure core (`telemetry.ts`) + pure CLI logic (`run-telemetry.ts`) + thin imperative
  shell (`telemetry.ts`); stdout = data, stderr = diagnostics (cli-design).
- **No new runtime deps** (esp. no glob library — see Slice 4 note).
- Additive to the S1a `VarietyReport` — existing fields/tests keep passing.

## Acceptance Criteria (S1b)

Derived from the §S1b examples + resolved decisions. Slice mapping in brackets.

- [x] **S1b-1** effective-move-count headline = `exp(Shannon entropy)` (natural log) of the
      pooled share distribution: uniform use of `k` techniques ⇒ exactly `k.0`; a single
      technique ⇒ `1.0`; `totalCommitments == 0` ⇒ `n/a` (no ÷0 / log-0 NaN) [Slice 1]
- [x] **S1b-2** `# live` (techniques with ≥1 honoured commitment) / `# dead` (0) counts +
      the dead-move list (names, canonical order); all-13-used ⇒ `# dead` 0 + empty list [Slice 1]
- [ ] **S1b-3** each technique shows **adoption** = `k/N` bots that honour it ≥once (a bot
      counts once no matter how many times/fights); `0/N` for a move no bot uses, `N/N` for
      one every bot uses; degraded-only picks don't count (honoured-only, per S1a-9) [Slice 2]
- [ ] **S1b-4** `--json` emits the raw `VarietyReport` (rows + counts + adoption + EMC +
      live/dead) to **stdout** instead of the table; valid parseable JSON (no table / ANSI);
      stderr unaffected; exit 0; byte-identical across two runs [Slice 3]
- [ ] **S1b-5** `npm run telemetry -- <path…>` runs the round-robin over the **supplied**
      bots instead of the frozen gauntlet; no args ⇒ gauntlet (S1a behaviour unchanged) [Slice 4]
- [ ] **S1b-6** a supplied bot that fails to load/validate ⇒ a structured error on **stderr** + **non-zero exit** (never a silent partial population); the driver skips byte-identical
      self-mirrors (`sameDoc`) so a dup in the supplied set doesn't fight its own clone [Slice 4]

## Slices

Every slice follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR. No production code without a
failing test. Read `.claude/CLAUDE.md` + the `testing` rules before each slice. Ordered
thinnest/highest-value first; each is independently shippable and leaves the tree green.

### Slice 1: the report headlines a diversity read (effective-move-count + live/dead)

**Value**: the roster designer sees, in one scalar, "how many of the 13 techniques are
_effectively_ in rotation" (13.0 = perfectly even, 1.0 = total collapse) plus an explicit
live/dead split and the dead-move list — the direct answer to "is our variety enough, and
what's dead on arrival?" Thinnest S1b slice: a pure function over the **existing** pooled
distribution — no per-bot restructure.

**Value/Actor**: roster designer · **Trigger**: `npm run telemetry` · **Observable**: a
headline line (e.g. `effective moves 4.7 of 13   ·   live 11 / dead 2: yoko-geri, mae-geri`).

**Path**: `reduceUsage` already yields per-technique `count`/`share` + `totalCommitments`
→ add a pure `diversity(report)` (or fold onto the report): `effectiveMoves =
totalCommitments === 0 ? null : exp(-Σ_{share>0} share·ln share)`, `live`/`dead` counts
from `count`, `deadList` = 0-count techniques in canonical order → `run-telemetry.ts`
renders a headline line (below the table or in the header block). _Skipped this slice:_
adoption (Slice 2), `--json` (Slice 3), override (Slice 4).

**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`,
`cli-design`.

**Acceptance criteria** (present + confirm before code): S1b-1, S1b-2.

**RED** — behavioral tests over synthetic `VarietyReport`s / `FightResult` fixtures. Key
mutants (`mutator-rules.md`):

- _EMC formula_: uniform over `k` techniques ⇒ `effectiveMoves === k` exactly (pins the
  `exp`/natural-log/`-Σ` shape — kills sign-swap, base, `exp`→identity); a single technique
  ⇒ `1.0`; a 50/50 two-technique split ⇒ `2.0`.
- _log-0 / ÷0 guard_: the `share > 0` filter (0·ln0) and the `totalCommitments === 0` ⇒
  `null`/`n/a` path — an all-idle fixture ⇒ `n/a`, never `NaN` (kills guard removal).
- _live/dead boundary_: a fixture with some 0-count techniques ⇒ exact `# live`/`# dead`
  and exact `deadList` in canonical order (kills `>=1`↔`>0`↔`>1`, and dead-list ordering);
  an all-13-used fixture ⇒ `dead 0` + empty list.
- _render_: exact-`toBe` on the headline line (kills string/label/`n/a` mutants), incl. the
  `n/a` rendering for the zero-total case.

**GREEN** — a pure `diversity` computation (natural-log Shannon → `exp`) + a `renderDiversity`
line; wire into `runTelemetryCli`. Decide at CONFIRM: report field vs derived-in-CLI (lean
report field `effectiveMoves: number | null` + `live`/`dead` so `--json` gets them free).

**MUTATE / KILL MUTANTS** — scoped Stryker on the changed source; the EMC-formula and the
live/dead boundary are the high-value survivors.

**REFACTOR** — assess only if it adds value.

**Done when**: S1b-1 + S1b-2 met, mutation report reviewed, typecheck + lint + format pass,
human approves commit.

### Slice 2: each technique shows per-bot adoption (k/N)

**Value**: the tempo-neutral variety signal — "how many distinct bots ever reach for this
move," which the pooled share (tempo-weighted) hides (a fast archetype can dominate pooled
share while few bots actually use a move). Answers "is this move broadly adopted or a
one-bot signature?"

**Value/Actor**: roster designer · **Trigger**: `npm run telemetry` · **Observable**: an
`adoption` column, e.g. `gyaku-zuki  2322  31.6%  6/6`.

**Path**: the driver must attribute each honoured commitment to the **committing bot**
(fighter A/B → `population[i]`/`[j]`), which `reduceUsage(FightResult[])` alone can't (no
bot identity in `FightResult`). So `runVariety` accumulates a per-bot honoured-technique
**set** (bot adopts `t` if ≥1 honoured commitment across its fights) → `adoption[t]` = |bots
whose set ∋ t| / N → each `UsageRow` gains `adoption` → the table gains a column. _Skipped:_
mean per-bot share (decision #3b — confirm at gate whether to include or defer). Honoured-only,
consistent with S1a-9.

**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.

**Acceptance criteria** (present + confirm before code): S1b-3 (+ decide S1b-3's mean-share
companion in/out).

**RED** — Key mutants:

- _counts bots, not commitments_: a bot that honours `t` in **multiple** fights ⇒ adoption
  counts it **once** (kills "sum commitments"); a fixture where `k` of `N` bots use `t` ⇒
  `adoption === k/N` exactly (kills the `/N` divisor + off-by-one).
- _≥1 threshold_: a bot that only ever **degrades** `t` (never honours) ⇒ not adopted
  (honoured-only); a move no bot uses ⇒ `0/N`; a move all use ⇒ `N/N`.
- _both fighters attributed_: a technique only bot B commits ⇒ B credited (kills "only A").
- _render_: exact-`toBe` on a row incl. the adoption cell.

**GREEN** — per-bot set accumulation in `runVariety`; `adoption` on `UsageRow`; column in
`renderReport`. Minimum only.

**MUTATE / KILL MUTANTS / REFACTOR** — as Slice 1; the "count bots once" and `/N` mutants
are highest-value.

**Done when**: S1b-3 met, mutation report reviewed, static analysis passes, human approves.

### Slice 3: `--json` emits the raw report for machines

**Value**: run-to-run diffing, a future web meta-report, and scripting — the report as
structured data, not a table. Ships after Slices 1–2 so the JSON carries the full enriched
report (histogram + adoption + diversity).

**Value/Actor**: designer / tooling · **Trigger**: `npm run telemetry --json` · **Observable**:
stdout is valid JSON that `JSON.parse`s to the `VarietyReport`; no table, no ANSI.

**Path**: `runTelemetryCli` grows an `argv` param (mirroring `runBenchmarkCli(argv, deps)`);
`--json` ⇒ `JSON.stringify` the report to stdout instead of `renderHeader`+`renderReport`;
stderr unaffected; exit 0. The thin shell passes `process.argv.slice(2)`. _Confirm at gate:_
raw `VarietyReport` vs a minimal `{version, report}` envelope (cli-design favours a versioned
envelope; decision #7 says "raw `VarietyReport`") — lean raw report + `version` alongside.

**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`,
`cli-design`.

**Acceptance criteria** (present + confirm before code): S1b-4.

**RED** — Key mutants:

- _flag parse_: `--json` present ⇒ stdout `JSON.parse`s to an object carrying the expected
  fields (rows length 13, `totalCommitments`, `effectiveMoves`, adoption); absent ⇒ the
  human table (contains `technique`, no leading `{`) — kills the flag string + branch invert.
- _pure JSON_: `--json` stdout has no `⚠`/table whitespace/ANSI and round-trips
  (`JSON.parse` succeeds); stderr still empty; exit 0.
- _determinism_: two `--json` runs ⇒ byte-identical stdout.

**GREEN** — argv parse for `--json`; `JSON.stringify` branch. Minimum.

**MUTATE / KILL MUTANTS / REFACTOR** — as above.

**Done when**: S1b-4 met, mutation report reviewed, static analysis passes, human approves.

### Slice 4: run the round-robin over a supplied population (override + errors + mirror-skip)

**Value**: the same instrument, any corpus — a pre-launch dead-move sweep across all 15
example bots (`-- bots/*.json`), or a post-launch submission dir. The instrument stops being
gauntlet-only; this is the capability that carries S5a "for free."

**Value/Actor**: designer · **Trigger**: `npm run telemetry -- <path…>` · **Observable**:
the report profiles the supplied bots (fight count / names reflect them); a bad bot fails
loudly; a duplicated bot doesn't fight its clone.

**Path**: positional args after flags ⇒ the population paths; the shell loads each via the
validator gate (reusing `loadBotDoc`); **any** load/validate failure ⇒ structured stderr +
non-zero exit (the S1a-12-deferred arbitrary-bot handling — mirror `run-benchmark.ts`'s
`ValidationError` → issues path); no paths ⇒ the frozen gauntlet (S1a default). The driver
filters self-mirrors via `sameDoc` (import from `benchmark.ts`) so a byte-identical dup pair
is skipped. _Glob note (no-dep):_ default to **shell-expanded** argv paths (Unix `bots/*.json`
expands to many argv entries — dep-free); document that non-expanding shells pass explicit
paths. Confirm at gate whether any in-CLI glob is worth it (would need a dep → likely no).

**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`,
`cli-design`.

**Acceptance criteria** (present + confirm before code): S1b-5, S1b-6.

**RED** — Key mutants:

- _population selection_: given explicit paths ⇒ population = those bots (assert via
  `totalFights` = `n·(n−1)·seeds` for the supplied `n`, and/or names in the header); no paths
  ⇒ gauntlet (unchanged) — kills the default-branch invert + arg-slice off-by-one.
- _load error_: a path that fails to load/validate ⇒ non-zero exit + stderr issue, empty
  stdout (kills the "swallow / partial population" mutant).
- _mirror-skip_: a population containing a byte-identical dup ⇒ the dup-vs-clone pairing is
  skipped (`totalFights` reflects the skip) — kills "don't skip"; a NON-dup pair is **not**
  skipped.

**GREEN** — argv positional-path handling in `run-telemetry.ts`; `loadPopulation(paths)` in
the shell; `sameDoc` filter in `runVariety`'s pairing. Minimum.

**MUTATE / KILL MUTANTS / REFACTOR** — as above; the mirror-skip and the fail-fast load are
highest-value.

**Done when**: S1b-5 + S1b-6 met, mutation report reviewed, static analysis passes, human
approves commit. **Feature close**: archive this plan under `docs/archive/` (+ README entry)
per `[[archive-plans-not-delete]]`; the `-harness`/`-stories` docs then cover S2–S5 only.

## Pre-PR Quality Gate (each slice)

1. `mutation-testing` — run scoped Stryker on the changed source; review the report.
2. `refactoring` — assess (only refactor if it adds value).
3. `npm run typecheck` + `npm run lint` + `npm run format:check` pass.
4. Confirm the invariant: `git diff` touches **no** `src/engine/{sim,dsl,types,prng,rules}.ts`,
   no `benchmark-config.ts` `INPUT_HASH`/`BENCHMARK_VERSION`; `npm run fight` byte-identical.

## Notes

- **Files**: extends `src/engine/telemetry.ts`, `src/cli/run-telemetry.ts`,
  `src/cli/telemetry.ts` (+ co-located tests). No new files expected.
- **Additive report shape**: `VarietyReport` grows `effectiveMoves`, `live`, `dead`/`deadList`
  (Slice 1) and per-row `adoption` (Slice 2); S1a fields + tests remain valid.
- **Deferred beyond S1b** (do NOT pull forward): opener win-rate (S2), degrade-rate +
  spacing (S3), scoring attribution (S4), committed board / web surface (S5). Grill each at
  its own planning time.
- **Open details to confirm at the relevant slice's CONFIRM gate** (not blocking the plan):
  mean-per-bot-share inclusion (Slice 2), `--json` envelope vs raw report (Slice 3), in-CLI
  glob vs shell-expansion (Slice 4).

---

_Feeds the S1b PR chain. On feature close, archive (do not delete) per project convention._
