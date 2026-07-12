# Plan: Variety telemetry — S1a (pooled usage histogram)

**Branch**: feat/variety-telemetry-s1a
**Status**: Active

## Goal

`npm run telemetry` runs the frozen gauntlet round-robin and prints a pooled
move-usage histogram over the 13 techniques — answering "is the arsenal broadly used
or collapsing, and is anything dead-on-arrival?" — as a pure read-only reduction over
`runFight` output (no engine / TCB / `CANONICAL_RULES` change, no version bump).

## Context (source of truth)

- Child story + 12 hardened acceptance examples: `plans/variety-telemetry-stories.md`
  (§S1a — acceptance examples, S1a-1..S1a-12).
- Locked design decisions: `plans/variety-telemetry-harness.md` (§Resolved decisions).
- Architecture to mirror: `src/engine/benchmark.ts` (pure aggregator that runs
  `runFight` internally) + `src/cli/run-benchmark.ts` (pure CLI logic → `{stdout,
  stderr, code}`) + `src/cli/benchmark.ts` (thin fs/manifest shell + `process.exit`).
- Key seam (already emitted, nothing to instrument): `FightResult.events[].{a,b}` carry
  `action` + `degrade` (`sim.ts:77`, `:1321`). A **honoured commitment** = a frame where
  `action.type ∈ {attack, throw, sweep}` AND `degrade === null` (grill #1).

## Non-negotiable invariants (must not be violated)

- **Read-only over the engine.** No change to `sim.ts` / `dsl.ts` / `types.ts` /
  `prng.ts` / `rules.ts` / `CANONICAL_RULES`. Therefore **no `INPUT_HASH` flip, no
  `BENCHMARK_VERSION` bump**; `npm run fight` stays byte-identical. If a slice seems to
  need an engine edit, STOP — the design says it shouldn't.
- Pure core, imperative shell (the `benchmark.ts` / `benchmark`-CLI split).
- No new runtime deps.

## Acceptance Criteria (S1a)

Verbatim IDs from `variety-telemetry-stories.md`. Slice mapping in brackets.

- [x] **S1a-1** pooled histogram over 13 techniques; share = count / totalCommitments over the both-sides, all-seeds round-robin (`i≠j`; sameDoc mirror-skip deferred to S1b) [Slice 1]
- [x] **S1a-2** share to 1dp; raw shares sum to exactly 1.0 when `totalCommitments > 0` (invariant on raw, not rounded display) [Slice 1]
- [x] **S1a-3** a technique no bot commits shows 0 count / 0.0% (never omitted) [Slice 1]
- [x] **S1a-4** `totalCommitments == 0` ⇒ every share 0.0%, no ÷0 (NaN) in shares [Slice 1] — EMC deferred to S1b (approved 2026-07-12)
- [x] **S1a-5** raw share strictly `> USAGE_FLAG_THRESHOLD` (0.35) ⇒ row flagged `⚠`; exit 0 [Slice 1]
- [x] **S1a-6** byte-identical output across two runs (deterministic) [Slice 1]
- [x] **S1a-7** rows sorted share-desc, ties broken by canonical frame-table order (stable sort over canonically-built rows) [Slice 1]
- [x] **S1a-8** a `⚠` present ⇒ a one-line legend explains it [Slice 1]
- [x] **S1a-9** a chosen-but-always-degraded move contributes 0 (honoured-only) + cross-ref S3a [Slice 1]
- [ ] **S1a-10** provenance header: version / population / seeds / fights / totalCommitments [Slice 2]
- [ ] **S1a-11** small-sample caveat when population < `SMALL_POPULATION` [Slice 2]
- [x] **S1a-12** CLI contract: exit 0 on report; fail-fast non-zero on load failure; user-bot errors deferred to S1b [Slice 1]

## Slices

Every slice follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR. No production code without a
failing test. Read `.claude/CLAUDE.md` + the `testing` rules before writing each slice.

### Slice 1: `npm run telemetry` prints the pooled usage histogram (with dominance flag)

**Value**: the roster designer runs one command and sees, per technique, how much of the
actual-play meta it occupies over the reference population — with dominant moves flagged
and dead moves visible as explicit 0s. This alone answers the originating "is our variety
used?" question and is the walking skeleton that proves the whole path.

**Path**: `npm run telemetry` (thin shell `src/cli/telemetry.ts`) → loads the 6 frozen
gauntlet bots through the validator gate (reusing `loadBotDoc`, like `benchmark.ts:48`)
→ pure driver in `src/engine/telemetry.ts` runs the round-robin over distinct ordered
index pairs (`i≠j`) × `SEEDS`, calling `runFight` and **keeping `events`** → pure
reducer counts honoured commitments per technique for both fighters → `VarietyReport`
→ `src/cli/run-telemetry.ts` renders the ordered, flagged table to **stdout**; exit 0.
*Intentionally skipped this slice:* provenance header + caveat (Slice 2), adoption /
diversity scalar / `--json` / population override (S1b), degrade-rate + spacing (S3),
scoring attribution (S4).

**Required implementation skills**: before code, load `tdd`, `testing`,
`mutation-testing`, `refactoring`, and `cli-design` (stream/exit discipline).

**Acceptance criteria** (present + confirm before any code): S1a-1, S1a-2, S1a-3,
S1a-4, S1a-5, S1a-6, S1a-7, S1a-8, S1a-9, S1a-12.

**RED** — failing behavioral tests over synthetic `FightResult` fixtures (factory
functions, the `benchmark.test.ts` pattern), plus a small real-gauntlet integration
test. Cover the mutants the `mutator-rules.md` will spawn:
- *Honoured-commitment predicate* (`degrade === null`): a fixture with a degraded
  attack frame must NOT count (kills `!== null` / removed-check mutants) — S1a-9.
- *Technique extraction* (attack→`move`, throw→`throw`, sweep→`sweep`, else none):
  a fixture per action type; an `idle`/`move`/`block` frame contributes nothing.
- *Both fighters counted*: a fixture where only the `b` frame commits ⇒ b's move
  appears (kills "count only a").
- *Share math* `count/total`: known counts ⇒ known shares (kills `total/count`,
  operator swaps); *raw shares sum to 1.0* on a multi-move fixture — S1a-2.
- *Zero-total guard*: an all-idle fixture ⇒ all shares 0.0, no NaN in shares — S1a-4
  (EMC deferred to S1b).
- *Dead technique present*: a fixture missing one technique ⇒ it still renders 0 /
  0.0% (kills "omit zero rows") — S1a-3.
- *Sort order*: a fixture with a share tie between two techniques ⇒ assert the EXACT
  row sequence (share-desc, canonical tie-break) — kills ascending + wrong-tie-break
  mutants — S1a-7.
- *Flag threshold* strict `> 0.35`: a move at exactly 35.0% NOT flagged, at >35% IS —
  kills `>=` / `<` / boundary mutants — S1a-5; legend present iff a `⚠` exists — S1a-8.
- *Determinism*: run the real round-robin twice ⇒ byte-identical stdout — S1a-6.
- *CLI contract*: report path ⇒ exit 0; an injected load failure ⇒ non-zero exit,
  message on stderr (reuse the `run-benchmark.ts` loader-throws pattern) — S1a-12.

**GREEN** — minimum code: `techniqueOfAction`, the round-robin driver, the usage
reducer, the `VarietyReport` type, the table renderer (reuse/adapt `run-benchmark.ts`'s
`render` column helper), the CLI arg-less entry, and the `telemetry` npm script. No
adoption / diversity / json / header yet.

**MUTATE** — run `mutation-testing` (node project; the pure core is the target). Produce
a report. (Note: any Stryker exclusions match the project's existing benchmark-core
coverage expectations.)

**KILL MUTANTS** — add per-axis fixtures for survivors (esp. the sort tie-break and the
strict `>` boundary — the highest-value mutants). Ask the human if a survivor's value is
ambiguous.

**REFACTOR** — assess only if it adds value: shared render helper vs `run-benchmark.ts`
(extract if duplication is real, leave if incidental); a shared round-robin helper with
`benchmark.ts` is likely NOT worth it (benchmark discards events, telemetry keeps them —
different shapes).

**Done when**: all listed criteria met, mutation report reviewed, typecheck + lint +
format pass, human approves commit.

### Slice 2: the report carries a provenance header + small-sample caveat

**Value**: a reader can trust and correctly interpret the numbers — knowing exactly which
version/population/seed-set/fight-count they describe, and being warned when the figures
reflect a small hand-authored reference population rather than discovered LLM behavior.

**Path**: `run-telemetry.ts` renderer prepends a header (mirroring `benchmark.ts`'s
`formatReport` header) reading `BENCHMARK_VERSION`, the population names/count, seed
count, total fights, and `report.totalCommitments`; when `population.length <
SMALL_POPULATION` it appends the caveat line. *Skipped:* everything already skipped in
Slice 1.

**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.

**Acceptance criteria** (present + confirm before code): S1a-10, S1a-11.

**RED**:
- Header includes each field with the value from the config/report (fixtures with
  known version/population/seeds/fights/totalCommitments) — kills dropped-field mutants.
- Caveat present when `population.length < SMALL_POPULATION`, absent at/above it —
  a boundary fixture on each side of the threshold (kills `<` vs `<=` mutants) — S1a-11.
- Determinism (S1a-6) still holds with the header.

**GREEN** — minimum header/caveat rendering + the `SMALL_POPULATION` named constant.

**MUTATE / KILL MUTANTS / REFACTOR** — as Slice 1; watch the caveat-threshold boundary
mutant specifically.

**Done when**: S1a-10 + S1a-11 met, mutation report reviewed, static analysis passes,
human approves commit.

## Pre-PR Quality Gate (each slice)

1. `mutation-testing` — run + review the report (pure core is the target).
2. `refactoring` — assess (only refactor if it adds value).
3. `npm run typecheck` + `npm run lint` + `npm run format:check` pass.
4. Confirm the invariant: `git diff` touches **no** `src/engine/{sim,dsl,types,prng,
   rules}.ts`, no `benchmark-config.ts` `INPUT_HASH`/`BENCHMARK_VERSION`; `npm run fight`
   remains byte-identical (determinism/replay suite green).

## Notes

- **New files**: `src/engine/telemetry.ts` (+ `.test.ts`), `src/cli/run-telemetry.ts`
  (+ `.test.ts`), `src/cli/telemetry.ts`; `package.json` `telemetry` script. Mirrors the
  benchmark trio exactly.
- **Deferred to S1b** (do NOT pull forward): adoption basis, effective-move-count
  (value + `n/a` rendering) + live/dead list, `--json`, population path/glob override +
  arbitrary-bot error handling, and the `sameDoc` mirror-skip (the frozen population has
  no byte-identical dupes, so it can never fire until override populations exist).
- **Completion**: per project convention ([[archive-plans-not-delete]]) this plan is
  **archived** under `docs/archive/` with a README entry on close-out — not deleted.

---
*Feeds the S1a PR chain. On feature close, archive (do not delete) per project convention.*
