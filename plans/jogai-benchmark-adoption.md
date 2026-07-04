# Plan: jogai benchmark + spec adoption (v15)

**Branch**: feat/jogai-benchmark-adoption
**Status**: Active

Source of resolved decisions: `plans/item3-officiating-adoption-decisions.md` (item 3, PR 1 of 3).
This is the **jogai** slice only — passivity (v16) and overtime (v17) are separate plans.

## Goal

Make WKF **jogai** (ring-out penalty) a live, taught, exercised part of the LLM benchmark:
score it in `MATCH`, make the zoner ring-aware, teach it in `docs/spec.md`, and CI-lock that
it both **fires** and is **field-read** on the frozen gauntlet — with all 6 members still in
`[25%, 75%]`.

## PR structure (why the slices map to 3 PRs)

Only the MATCH-jogai + zoner edits change a **scoring input** (they flip `INPUT_HASH` ⇒ the
`BENCHMARK_VERSION v14 → v15` bump). Everything else is byte-identical and separable, so the
work splits into three independently-mergeable PRs, staying close to `main`:

- **PR 1 — `FightResult.fouls` telemetry** (Slice 1). Byte-identical, **no** version bump.
  De-risks the engine change and unblocks the jogai "fires" guard. Mergeable on its own.
- **PR 2 — jogai adoption (the v15 flip)** (Slices 2–4). The atomic `INPUT_HASH` change:
  spec teaching + MATCH wiring + zoner ring-aware + rebalance + calibration guards. Coupled
  by the single hash flip and the taught==scored principle, so it is one PR.
- **PR 3 — CLI officiating breakdown** (Slice 5). Byte-identical display; **no** bump.
  Mergeable after PR 1.

## Acceptance Criteria (capability-level)

- [ ] `FightResult.fouls: { a: { jogai, passivity }, b: { jogai, passivity } }` is populated
      from the per-cause foul counters; a fight where a fighter rings out reports
      `fouls.<fouler>.jogai ≥ 1`; **outcomes are byte-identical** to before (all existing
      determinism/replay tests unchanged).
- [ ] `MATCH = { winGap: 8, senshu: true, jogai: { margin: 100000 } }`; `INPUT_HASH` re-pinned;
      `BENCHMARK_VERSION = "v15"`.
- [ ] The zoner is **ring-aware**: its rules contain a `self.x` comparison against a constant
      in the near-edge zone (within `δ` of `margin` / `width − margin`), and it zones without
      ringing itself out.
- [ ] All 6 gauntlet members' round-robin win-rate ∈ `[25%, 75%]` on v15.
- [ ] `gauntlet-calibration.test.ts` gains two guards (each with a "guard bites" companion):
      **fires** — ∃ a v15 board bout decided by a jogai foul (`fouls.x.jogai ≥ 1` confers the
      deciding point); **field-read** — the zoner references `self.x` near the margin.
- [ ] `docs/spec.md` teaches jogai (a `benchmarkSection` rule bullet + a primer clause naming
      `self.x`-vs-edge and `self.penalties`/`opponent.penalties`), gated on `match.jogai`;
      the drift test passes.
- [ ] Dogfood record re-pinned; `docs/benchmark-gauntlet-v15.md` added (v14 kept intact).
- [ ] The CLI benchmark report shows a per-bout/aggregate `endReason` + foul-count breakdown.
- [ ] `npm run fight` byte-identical throughout (no `Rules`/`CANONICAL_RULES` change);
      typecheck + lint clean.

## Slices

Every slice follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR. No production code without a
failing test. Load `tdd`, `testing`, `mutation-testing`, `refactoring` before code.

---

### Slice 1 (PR 1): Per-cause foul tally on `FightResult` — ✅ DONE (commit `871c1ac`)

_RED→GREEN→MUTATE (95%→100%, 20/20) done; full suite 1078 green, byte-identical, typecheck+lint
clean. `FightResult.fouls: { a: {jogai,passivity}, b: {jogai,passivity} }` surfaced via a `cause`
param on `applyPenalty`. No version bump (telemetry)._

**Value**: the benchmark/CI (and a human) can see which fighter committed a jogai/passivity
foul — the observable the "fires" guard needs. Byte-identical telemetry.
**Path**: `Fighter` gains per-cause counters (init 0 at sim.ts:908–923) → the jogai
(sim.ts:1227–1228) and passivity (1275–1276) call sites increment the **fouler's** cause
counter, threaded through a `cause` param on `applyPenalty` (sim.ts:896) → surfaced into
`FightResult.fouls` at the terminal return (sim.ts:1330–1336). Read only at return ⇒ no
outcome effect.
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.
**Acceptance criteria** (confirm before code):
- `FightResult.fouls = { a: { jogai, passivity }, b: { jogai, passivity } }`, all `0` when no
  foul occurs.
- A fight with `match: { winGap: 99, jogai: { margin: 100000 } }` where fighter A retreats into
  the out-zone reports `fouls.a.jogai ≥ 1`, `fouls.a.passivity === 0`.
- A fight with `match: { winGap: 99, passivity: { limit: <small> } }` where A stalls reports
  `fouls.a.passivity ≥ 1`, `fouls.a.jogai === 0` (proves the passivity sub-counter is wired,
  though the benchmark won't use it until v16).
- **Byte-identical**: an existing replay/determinism fixture yields an identical `events` log
  and `scores` with/without reading `fouls`.
**RED**: a test asserting `fouls.a.jogai` counts A's ring-outs (using an existing jogai
run-fight scenario) and stays `0` for B; plus the passivity-cause test; plus a byte-identical
assertion. Mutator watch (per `resources/mutator-rules.md`): the `++counter` (arithmetic/update
operator), the `> 1` ladder guard is **unchanged** (already covered), and the object-literal
`fouls` shape (ObjectLiteral/`{}` mutant — kill by asserting a specific non-zero count, not just
truthiness).
**GREEN**: add the counters + `cause` param + the `fouls` return field.
**MUTATE**: run `mutation-testing` on the changed `sim.ts` regions.
**KILL MUTANTS**: strengthen for any survivor (esp. the per-cause routing — a test that would
pass if jogai incremented the passivity counter must fail).
**REFACTOR**: assess only if it adds value.
**Done when**: all AC met, byte-identical proven, mutation report reviewed, human approves.

---

### Slice 2 (PR 2): `generateSpec` teaches jogai (gated on `match.jogai`)

**Value**: an LLM bot author reading `docs/spec.md` under a jogai-scored manifest learns the
ring-out rule and how to avoid it — taught == scored.
**Path**: extend `gen-spec.ts` `Match` type with `jogai?: { margin }`; add a gated
`benchmarkSection` rule bullet (ring-out ⇒ yame-style reset + shared-ladder penalty) + a gated
primer "play the match" clause naming `self.x`-vs-edge + `self.penalties`/`opponent.penalties`.
`docs/spec.md` is **not** regenerated in this slice (MATCH still lacks jogai until Slice 3), so
the committed spec is unchanged; the new prose is covered by unit tests passing a jogai-`Match`.
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.
**Acceptance criteria** (confirm before code):
- `benchmarkSection(match)` with `match.jogai` present includes the jogai rule bullet;
  absent ⇒ the bullet is **not** rendered (taught == scored).
- `primerSection` with `match.jogai` present includes the jogai strategy clause naming
  `self.x` and the penalties fields; absent ⇒ not rendered.
**RED**: gen-spec factual tests — a jogai-`Match` renders the bullet + clause; a jogai-absent
`Match` renders neither. (StringLiteral mutants on the new prose die on the factual assertions;
the `match.jogai ? … : ""` gate — Conditional mutant — dies on the present/absent pair.)
**GREEN**: add the gated prose.
**MUTATE / KILL / REFACTOR**: as standard on the changed `gen-spec.ts` region.
**Done when**: AC met, mutation report reviewed, human approves. (No `INPUT_HASH`/version
change — spec is not a scoring input.)

---

### Slice 3 (PR 2): Wire jogai into MATCH + zoner ring-aware + rebalance to v15

**Value**: jogai is scored in the benchmark; the zoner reads `self.x` to zone without ringing
out; the board stays calibrated. This is the atomic `INPUT_HASH` flip.
**Path**: `MATCH += jogai: { margin: 100000 }` (benchmark-config.ts); re-author `bots/zoner.json`
with a near-margin `self.x` rule that stops the retreat before the out-zone (handling BOTH walls,
since the zoner fights as A and B); **measure** the round-robin; re-pin `INPUT_HASH` +
`BENCHMARK_VERSION = "v15"`; regenerate `docs/spec.md` (now picks up the Slice-2 jogai prose);
re-pin the dogfood record; add `docs/benchmark-gauntlet-v15.md`.
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.
**Acceptance criteria** (confirm before code):
- `MATCH` includes `jogai: { margin: 100000 }`; `INPUT_HASH` re-pinned; `BENCHMARK_VERSION` v15.
- The zoner references `self.x` compared to a near-margin constant and, in a fixture where the
  old zoner rings out, the new zoner does **not**.
- All 6 members ∈ `[25%, 75%]` (the existing band guard stays GREEN on v15).
- `docs/spec.md` drift test passes (regenerated with jogai prose); `npm run fight` byte-identical.
**RED**: the `INPUT_HASH` guard goes RED on the MATCH edit (re-pin to GREEN); the band guard may
go RED as the board shifts (drive the zoner re-author — and per **decision 5's lever ladder**,
a coupled bot, only if needed — back to GREEN); a zoner characterization test (rings-out-before
vs. holds-after).
**GREEN**: the MATCH edit + zoner document + re-pins + regen.
**MUTATE**: `benchmark-config.ts` (the manifest is data — Stryker doesn't mutate the bot JSON;
effectiveness is structural via the RED characterization + the band guard).
**KILL MUTANTS / REFACTOR**: as applicable.
**Open risk (decision 10 escalation)**: if, once the zoner avoids ringing out, **no** frozen bot
still triggers a decisive jogai foul, the Slice-4 "fires" guard cannot pass — shape a non-carrier
bot into a plausibly-naive victim (still ∈ band) so jogai fires for real. Measure first.
**Done when**: AC met, board re-characterized, mutation/report reviewed, human approves.

---

### Slice 4 (PR 2): CI-lock jogai "fires" + "field-read"

**Value**: the v15 gauntlet certifies jogai is exercised, not just enabled — the durable guard.
**Path**: two tests in `src/cli/gauntlet-calibration.test.ts`, each with a "guard bites"
companion (the existing pattern): **fires** — run the round-robin and assert ∃ a bout with
`fouls.x.jogai ≥ 1` whose outcome the conferred point decides; **field-read** — walk the zoner's
condition AST (analogous to `movesReferencedBy`) and assert a `self.x` comparison against a
constant in `[.., margin+δ] ∪ [width−margin−δ, ..]`.
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.
**Acceptance criteria** (confirm before code):
- **fires** guard GREEN on the v15 roster; its "guard bites" companion (a roster/scenario with
  no ring-out) is RED-proven-then-inverted (asserts absence), like the coverage companion.
- **field-read** guard GREEN for the ring-aware zoner; its companion asserts a bot with only a
  generic mid-ring `self.x` (or none) is flagged — proving a bare `self.x` reference is
  insufficient.
**RED**: both guards written first (fail on pre-Slice-3 state / a fabricated non-firing roster).
**GREEN**: they pass on v15.
**MUTATE**: the near-margin predicate is **test-local** (like the no-Pareto detector) ⇒ pin its
comparison logic with a directional fixture matrix (in-zone near low edge, near high edge,
mid-ring negative, boundary `= margin` / `= margin+δ`) rather than a mutation score.
**Done when**: AC met, guards + companions GREEN/biting, human approves.

---

### Slice 5 (PR 3): CLI officiating breakdown line

**Value**: a human running `npm run benchmark` sees officiating firing (how bouts ended + foul
counts). Byte-identical; ranking untouched (decision 7).
**Path**: `src/cli/benchmark.ts` report gains an `endReason` + foul-count breakdown. **Resolve
in TDD**: whether the aggregate `benchmark()` result must surface per-bout `endReason`/`fouls`
(a small additive change to `src/engine/benchmark.ts`) or the CLI can derive an aggregate — pick
the smaller.
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.
**Acceptance criteria** (confirm before code):
- The report includes an officiating line (e.g. `ended: gap N / time N / senshu N`,
  `jogai fouls: a=N b=N`).
- Ranking (win-rate primary / net tiebreak) and all scoring outputs are unchanged.
**RED**: a CLI/format test asserting the breakdown line renders for a result carrying fouls +
endReasons; a test asserting the ranking is unchanged.
**GREEN / MUTATE / KILL / REFACTOR**: as standard.
**Done when**: AC met, mutation report reviewed, human approves.

## Pre-PR Quality Gate (each PR)

1. Mutation testing — run `mutation-testing` on changed regions.
2. Refactoring assessment — run `refactoring`.
3. `npm run typecheck` + `npm run lint` pass; `npm test` green.
4. Byte-identical / determinism invariants hold where claimed (Slices 1, 5); `npm run fight`
   unaffected.

---
**Close-out (NOT delete):** when all 3 PRs are merged, **archive this plan under
`docs/archive/`** (with a `README.md` index entry) per the archive-plans-not-delete policy —
do **not** delete it. Then close the `docs/STATUS.md` item-3 jogai entry. (This overrides the
planning skill's default "delete the plan file" footer.)
