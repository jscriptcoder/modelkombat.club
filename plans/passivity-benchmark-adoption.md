# Plan: passivity benchmark + spec adoption (item 3, capability B / v16)

**Branch**: feat/passivity-v16-adoption (PR 1)
**Status**: Active — planning complete, awaiting Slice-1 RED approval

Second of the three deferred §7 officiating adoptions. Resolved decisions:
`plans/item3-officiating-adoption-decisions.md` (the grill-me record — read it first).
Precedent to mirror slice-for-slice: the **jogai adoption** (v15, PRs #147–#150),
archived at `docs/archive/jogai-benchmark-adoption.md`.

## Goal

Make the already-built §7 **passivity** mechanic (non-engagement clock ⇒ yame-style
reset + shared category-2 penalty) a **live, taught, CI-locked** part of the LLM
benchmark: score it in `MATCH`, teach it in `docs/spec.md`, and prove it *fires* and is
*field-read* on the frozen gauntlet — all 6 members still ∈ `[25%, 75%]`.

## Context — what already exists (NOT in scope to build)

The passivity engine shipped in Capability B (PRs #100–#103) and its telemetry in the
jogai PR #147. All of this is present and merely reads sentinel `0` because `MATCH`
configures no `passivity` key:

- `FightConfig.match.passivity?: { limit: number }` (sim.ts).
- The per-fighter no-offense clock `ticksSinceOffense` (reset on own contact), the
  `> limit` foul check, `applyPenalty(fouler, opp, "passivity")` on the **shared**
  `penaltyCount` ladder (1st free, 2+ ⇒ opponent +1), senshu revocation, and the
  same-tick winGap re-check.
- DSL perception fields `self.passivityRemaining` (B3, live) and
  `opponent.passivityRemaining` (B4, L_act-delayed) — already whitelisted TCB surface,
  derived via `passivityRemainingOf`, sentinel `0` when unconfigured.
- `FightResult.fouls.{a,b}.passivity` telemetry — already recorded at the passivity
  `applyPenalty` site; byte-identical (read only at the terminal return).
- The CLI officiating line + the benchmark `OfficiatingTally` (jogai split) from PR #149.

⇒ **No engine change, no new DSL/TCB surface, no new telemetry field.** `npm run fight`
stays byte-identical throughout (match is scoring-only; the invariant from the decisions
doc's non-goals).

## Acceptance Criteria

- [ ] `MATCH` scores `passivity:{limit:120}`; `BENCHMARK_VERSION` = `v16`; `INPUT_HASH`
      recomputed; the `benchmark-config.test.ts` drift guard passes at v16.
- [ ] `docs/spec.md` (regenerated via `gen:spec`) teaches passivity — a `benchmarkSection`
      rule bullet (non-engagement clock ⇒ reset + shared-ladder penalty) and a primer
      "play the match" clause naming `self.passivityRemaining` (+ `opponent.passivityRemaining`
      for parity), both gated on `match.passivity` (taught == scored).
- [ ] The **vulture** carrier references `self.passivityRemaining` in a condition to
      re-engage before its own foul (the field-read), asserted by an AST walk in the
      calibration lock.
- [ ] A gauntlet bout is **decided** by a passivity foul (the fire): turning passivity OFF
      (jogai still ON) flips that bout's winner, with `fouls.<fouler>.passivity ≥ 1` — a
      naive staller pays off the point. CI-locked, with a companion "guard bites" test.
- [ ] All 6 gauntlet members' round-robin win-rate stays ∈ `[25%, 75%]` on the v16 board.
- [ ] The v15 jogai fire still holds under the pooled ladder (the jogai-adoption lock stays
      green at v16).
- [ ] `npm run fight` output byte-identical (no engine/rules change).
- [ ] The CLI benchmark report surfaces the passivity foul split (bot vs opp), ranking-inert.
- [ ] New `docs/benchmark-gauntlet-v16.md` re-characterization; dogfood record re-pinned.

## Slices

Every slice follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR. Before code, load `tdd`,
`testing`, `mutation-testing`, `refactoring`. No production code without a failing test.

### Slice 1 (PR 1): the atomic v16 passivity flip — scored, taught, locked

**Value**: an LLM author (and the gauntlet) is now ranked on WKF passivity — stalling is
punished and `self.passivityRemaining` is a live, taught, exercised strategy field.

**Path**: `MATCH` (benchmark-config.ts) gains `passivity:{limit:120}` → `runFight`
already honours it → `benchmark()` scores every matchup under it → the gauntlet
re-characterizes → `gen:spec` teaches it → the calibration + adoption locks certify it.
This is necessarily **one atomic PR**: the `MATCH` change, the `INPUT_HASH`/`BENCHMARK_VERSION`
bump, the spec regeneration, and the gauntlet re-authoring are the same scoring-input flip
(splitting them leaves the drift guard red between commits).

**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.

**Acceptance criteria** (present + confirm before code): the v16 `MATCH`/version/hash
criteria, the vulture field-read, the passivity fire (winner-flip + companion), all 6 ∈
band, the v15 jogai lock still green, spec prose gated on `match.passivity`, byte-identical
`npm run fight`. **Present to human before writing any code.**

**Pre-code MEASUREMENT (the decision-10 / open-risk resolution — do FIRST, like jogai's
sweeper measurement):**
1. Turn `passivity:{limit:120}` on over the frozen v15 roster and measure, per (bots × seed
   × side): each fighter's `fouls.*.passivity`, who exceeds the clock, and whether any
   foul is **decisive** (flips vs passivity-OFF). Record which bots stall.
2. Make the **vulture** passivity-aware (carrier): add a high-priority rule
   `when self.passivityRemaining <= <threshold> → <re-engage attack>` so it never eats its
   own foul (WKF-faithful: the skilled bot reads-and-avoids). Pick the re-engage move + the
   `self.passivityRemaining` threshold empirically (the vulture already advances via
   `default {move dir 1}`; the new rule forces an *offense* before the clock expires).
3. **Victim resolution (decision 10).** If, once the vulture avoids, NO frozen bot stalls
   past 120 decisively, escalate: re-author ONE non-carrier bot into a plausibly-naive
   staller that over-turtles into a decisive passivity foul in a *close* bout while staying
   ∈ band. Measure first — do not assume the victim; jogai's was the sweeper only after
   measurement. **Constraint:** prefer a bot NOT reserved for overtime (v17 carrier = jabber),
   so v17 need not re-touch it.
4. **Pooled-ladder re-verify.** Confirm the v15 jogai fire (sweeper→vulture) still holds now
   that passivity fouls share `penaltyCount` — a prior passivity foul can make the first jogai
   foul confer (and vice-versa). If the jogai lock's exact fouler/beneficiary shifts, update
   that assertion deliberately (it is self-contained per decision 6).
5. **`limit=120` calibration.** Confirm a *paced poker* (regen ~10/tick, move costs 15–52) is
   never flagged while a genuine staller is — empirically, against the live economy. `120` is
   held FIXED; bots do the balancing (decision 5). Only revisit the param as a last resort.
6. **Rebalance to `[25,75]`.** Adopting passivity + the carrier/victim edits perturb the
   coupled round-robin. Lever order (decision 5): re-author the carrier → re-author one
   coupled bot → (last resort) the param. Band = dispersion; can't be precision-dialed.

**RED**: failing tests, added/extended across:
- `benchmark-config.test.ts`: the `INPUT_HASH`/`BENCHMARK_VERSION` drift guard expects the
  v16 digest (fails until `MATCH` + version + hash are updated together). Mutator focus:
  the exact version string + hash constant.
- `gauntlet-calibration.test.ts` — a **passivity-adoption lock** mirroring the jogai lock:
  - *fires*: ∃ a board bout whose winner flips between `MATCH` (passivity ON) and
    `MATCH_NO_PASSIVITY` (jogai still ON), with `fouls.<fouler>.passivity ≥ 1`. Winner-flip
    isolates passivity's causal point under the pooled ladder better than a raw `≥2` count
    (recommended over jogai's `≥2` form precisely because the shared warning may already be
    spent on jogai). Companion "guard bites": with passivity OFF, total passivity fouls == 0.
  - *field-read*: an AST walk (`passivityReaders`, analog of `movesReferencedBy` /
    `selfXConstants`) asserts the vulture's conditions reference the path
    `self.passivityRemaining`. Companion "guard bites": a bot referencing some *other* self
    field is NOT counted.
  - the existing band + jogai-adoption locks must stay green (re-run over the v16 roster).
- `gen-spec.test.ts`: assert the passivity bullet + primer clause appear iff `match.passivity`
  is set (drift-pin the literal prose, as jogai/senshu prose is pinned); the `Match` type in
  gen-spec.ts gains `passivity?: { limit: number }`.
- dogfood re-pin (dogfood.test.ts) — the character bot's v16 W/L/D record.

**GREEN**: minimum to pass — update `MATCH`/`BENCHMARK_VERSION`/`INPUT_HASH`; re-author
`bots/vulture.json` (+ any coupled/victim bot) with the measured edits (LF-pinned via
`.gitattributes`); add the passivity prose (gated on `match.passivity`) to
`benchmarkSection` + `primerSection` and widen the `Match` type; run `gen:spec` to
regenerate `docs/spec.md`; add `docs/benchmark-gauntlet-v16.md`.

**MUTATE**: run Stryker over the changed production files (`benchmark-config.ts`,
`gen-spec.ts`, any bot-loading/report code touched). `rm -rf .stryker-tmp` first. Target
100% as jogai held. Likely survivors to pre-empt: the version/hash literals (killed by the
drift guard), the passivity-gating `?.` in gen-spec (killed by the prose iff-tests), the
`limit` value (killed by a calibration boundary test).

**KILL MUTANTS**: strengthen tests for survivors; ask the human when a survivor's value is
ambiguous (e.g. an equivalent prose-ordering mutant).

**REFACTOR**: assess only if it adds value — the passivity lock will structurally echo the
jogai lock; consider whether the two share a helper without over-abstracting (jogai kept its
own; default to mirroring, not premature DRY).

**Done when**: all Slice-1 acceptance criteria met, `npm run fight` byte-identical verified,
full suite + typecheck + lint + format green, mutation report reviewed, human approves commit.

### Slice 2 (PR 2): CLI passivity foul breakdown — version-neutral reporting

**Value**: a human running `npm run benchmark` sees passivity firing (bot-vs-opponent foul
split), the same observability jogai got in PR #149.

**Path**: `benchmark()`'s `OfficiatingTally` gains a `passivity:{bot,opp}` split (threaded
through `Outcome` like `jogaiBot/jogaiOpp`); `run-benchmark.ts`'s `officiatingLine` renders
it alongside the jogai split. **Ranking-inert** — no `INPUT_HASH`/`BENCHMARK_VERSION` change
(mirrors the jogai reporting slice exactly).

**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.

**Acceptance criteria** (present + confirm before code): the tally accumulates the bot's own
passivity fouls (`asA.fouls.a.passivity + asB.fouls.b.passivity`) vs the opponent's
(`asA.fouls.b + asB.fouls.a`) — the bot-centric split, NOT raw fighter-A/B; the CLI line
appends `passivity fouls: bot=N opp=N`; ranking figures (win-rate/net) unchanged; the
`OpponentScore`/`compareSubmission` path stays inert to it.

**RED**: extend `benchmark.test.ts`'s officiating-tally describe with passivity cases —
default config ⇒ `passivity {bot:0,opp:0}`; a staller-vs-idle fixture ⇒ bot accumulates; a
MIRROR fixture ⇒ opp accumulates (the KILL-MUTANT test for the opp accumulator, the exact
survivor jogai hit at benchmark.ts:143). Extend `run-benchmark.test.ts`'s exact-stdout
assertions with the passivity segment. Fix the `submission.test.ts` `scored` factory literal
(add the zeroed `passivity` tally to satisfy the type).

**GREEN**: add the `passivity` split to `OfficiatingTally` + `tallyOfficiating` + `Outcome`
+ `playBothSides`; extend `officiatingLine`.

**MUTATE**: Stryker over `benchmark.ts` + `run-benchmark.ts`; the opp-accumulator `+`→`-`
survivor must be killed by the MIRROR fixture (the jogai lesson).

**KILL MUTANTS**: as surfaced.

**REFACTOR**: assess — the jogai + passivity splits are structurally identical; consider a
small shared shape if it reads cleaner (only if it adds value).

**Done when**: all Slice-2 criteria met, suite/typecheck/lint/format green, mutation report
reviewed, human approves commit.

### Close-out (PR 3): archive the passivity plan + close the STATUS entry

**Value**: the design trail is preserved and the roadmap reflects reality.

**Scope** (docs only, no code): git-move `plans/passivity-benchmark-adoption.md` →
`docs/archive/passivity-benchmark-adoption.md` (per archive-plans-not-delete); add its
`docs/archive/README.md` index entry under §7 match officiating; update `docs/STATUS.md`
(a build-log DONE entry for v16; narrow "Next in the pipeline" item 3 to overtime-only);
update memory (`jogai-benchmark-adoption.md` / MEMORY.md forward-link, or a sibling note).

**Do NOT archive** `plans/item3-officiating-adoption-decisions.md` — it still governs
overtime (v17). Per its Definition of Done, `plans/` empties only when overtime ships.

**Done when**: plan archived + indexed, STATUS closed for passivity, memory updated, human
approves commit.

## Pre-PR Quality Gate (each PR)

1. Mutation testing — run `mutation-testing` (`rm -rf .stryker-tmp` first).
2. Refactoring assessment — run `refactoring`.
3. Typecheck, lint, format:check all pass.
4. `npm run fight` byte-identical (Slice 1 especially — the byte-stability invariant).
5. Full `npm test` green.

## Open risks carried from the decisions doc (resolve in Slice-1 TDD)

- **Reader/trigger circularity** — the vulture reads *to avoid* its foul ⇒ a different bot
  must trigger for the fire (decision 10). MEASURE the victim; don't assume it.
- **`limit=120` calibration** — paced poker safe, staller flagged (empirical).
- **Pooled-ladder coupling (v16)** — passivity + jogai share `penaltyCount`; re-verify the
  v15 jogai fire under the pooled count.
- **Per-PR board re-characterization** — resets/penalties perturb the round-robin; expect to
  re-author the carrier ± one coupled bot to hold all 6 ∈ band.

---
*Per the archive-plans-not-delete policy, this file is ARCHIVED to `docs/archive/` on
feature completion, never deleted.*
