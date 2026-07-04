# Plan: passivity benchmark + spec adoption (item 3, capability B / v16)

**Branch**: feat/passivity-v16-report (PR 2 — Slice 2)
**Status**: Active — **Slices 1 & 2 DONE** (S1 PR #151 `main`@`e930960`; S2 `414405f`); close-out (PR 3) next

Second of the three deferred §7 officiating adoptions. Resolved decisions:
`plans/item3-officiating-adoption-decisions.md` (the grill-me record — read it first).
Precedent to mirror slice-for-slice: the **jogai adoption** (v15, PRs #147–#150),
archived at `docs/archive/jogai-benchmark-adoption.md`.

## Goal

Make the already-built §7 **passivity** mechanic (non-engagement clock ⇒ yame-style
reset + shared category-2 penalty) a **live, taught, CI-locked** part of the LLM
benchmark: score it in `MATCH`, teach it in `docs/spec.md`, and prove it _fires_ and is
_field-read_ on the frozen gauntlet — all 6 members still ∈ `[25%, 75%]`.

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

- [x] `MATCH` scores `passivity:{limit:240}`; `BENCHMARK_VERSION` = `v16`; `INPUT_HASH`
      recomputed; the `benchmark-config.test.ts` drift guard passes at v16.
- [x] `docs/spec.md` (regenerated via `gen:spec`) teaches passivity — a `benchmarkSection`
      rule bullet (non-engagement clock ⇒ reset + shared-ladder penalty) and a primer
      "play the match" clause naming `self.passivityRemaining` (+ `opponent.passivityRemaining`
      for parity), both gated on `match.passivity` (taught == scored).
- [x] The **jabber** carrier references `self.passivityRemaining` in a condition (a light
      last-ditch re-engage), asserted by an AST walk in the calibration lock (the field-read).
- [x] The mechanic is **EXERCISED** on the board (the relaxed fire, per decision 3): ∃ a board
      bout where the **shaped vulture victim** commits **≥2 passivity fouls** — the shared ladder
      confers a penalty point on the frozen roster. CI-locked, with a companion "guard bites"
      test (passivity OFF ⇒ 0 fouls). (A _decisive_ winner-flip is structurally infeasible on the
      all-aggressive roster; conferral-decisiveness stays proven by the Capability-B engine tests.)
- [x] All 6 gauntlet members' round-robin win-rate stays ∈ `[25%, 75%]` on the v16 board.
- [x] The v15 jogai fire still holds under the pooled ladder (the jogai-adoption lock stays
      green at v16).
- [x] `npm run fight` output byte-identical (no engine/rules change).
- [x] The CLI benchmark report surfaces the passivity foul split (bot vs opp), ranking-inert.
- [x] New `docs/benchmark-gauntlet-v16.md` re-characterization; dogfood record re-pinned.

## Slices

Every slice follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR. Before code, load `tdd`,
`testing`, `mutation-testing`, `refactoring`. No production code without a failing test.

### Slice 1 (PR 1): the atomic v16 passivity flip — scored, taught, locked ✅ DONE (PR #151, `main`@`e930960`)

**Value**: an LLM author (and the gauntlet) is now ranked on WKF passivity — stalling is
punished and `self.passivityRemaining` is a live, taught, exercised strategy field.

**Path**: `MATCH` (benchmark-config.ts) gains `passivity:{limit:240}` → `runFight`
already honours it → `benchmark()` scores every matchup under it → the gauntlet
re-characterizes → `gen:spec` teaches it → the calibration + adoption locks certify it.
This is necessarily **one atomic PR**: the `MATCH` change, the `INPUT_HASH`/`BENCHMARK_VERSION`
bump, the spec regeneration, and the gauntlet re-authoring are the same scoring-input flip
(splitting them leaves the drift guard red between commits).

**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.

**Acceptance criteria** (present + confirm before code): the v16 `MATCH`/version/hash
criteria, the jabber field-read, the passivity fire (winner-flip + companion), all 6 ∈
band, the v15 jogai lock still green, spec prose gated on `match.passivity`, byte-identical
`npm run fight`. **Present to human before writing any code.**

**Pre-code MEASUREMENT — ✅ DONE (2026-07-04).** Throwaway diagnostics turning passivity on over
the frozen v15 roster (per bots × seed × side) + a `limit` sweep. Findings written back into the
decisions doc (decisions 4, 5, 10 revised):

- **Sole staller at limit 120 = jabber** (79 fouls, all vs the zoner — it blocks the zoner's kick
  ladder, and blocking does NOT reset the attacker's no-offense clock; only its own offense does).
  Every other bot 0. The decisions-doc premise "vulture is the natural staller" is REFUTED.
- **`limit=120` mis-flags the jabber's LEGITIMATE patient counter-game.** Its only non-turtle
  winning matchup does not exist (it loses 0-20 to grappler/sweeper/vulture; its whole v15
  viability was out-pointing the zoner by patient blocking — exactly what passivity punishes).
  120 craters it to 12%; NO bot edit recovers it (an aggressive redesign → 0%).
- **`limit` sweep ⇒ 240** self-calibrates the board (jabber 31 / zoner 35 / all 6 ∈ band ≈ the v15
  balance) while a pure turtle still fouls 80× — paced safe, stallers flagged. **User confirmed
  limit 120 → 240** (decision 5 revised; the calibration hook resolving against data).
- **Pooled-ladder jogai fire SURVIVES** ✓: sweeper→vulture still decisive (12 fires) at limit 240.

**Resolved design (confirmed with the user):**

- **`passivity.limit = 240`** (was 120) — the board self-calibrates, so NO rebalancing edits are
  needed for band; the bot work is now minimal.
- **Carrier = jabber** — a light `self.passivityRemaining ≤ 10` re-engage (fires only in a true
  deep stall, so it keeps jabber ∈ band ~31%) satisfies the field-read.
- **Victim = vulture** (was grappler — the grappler is too aggressive to stall selectively; every
  foe engages it within 240 ticks). The vulture is the lowest-offense bot (73% ⇒ huge downward
  headroom): a standoff-idle rule (`opponent.attackBand == 0 AND opponent.distance > 200000 → idle`)
  makes it commit ~23 passivity fouls (incl. ≥2-foul conferring bouts) with the whole board ∈ band.
- **Fire = EXERCISED, not decisive** — no passivity foul flips a bout on the all-aggressive roster
  (a 480-tick stall loses on points regardless); the board bar is a real bot CONFERRING a penalty
  point (≥2 fouls in a bout). Conferral-decisiveness stays engine-unit-tested (Capability B).

**Remaining GREEN-time tuning (measure as I author):**

- Confirm the vulture-victim edit produces a ≥2-foul bout AND keeps all 6 ∈ `[25,75]`.
- Confirm the jabber's `self.passivityRemaining ≤ 10` read leaves it ∈ band at limit 240.
- **Re-verify the jogai fire** after the edits (the jogai lock's `MATCH_NO_JOGAI` counterfactual
  must keep passivity ON once `MATCH` carries it, else it conflates the two causes — a Slice-1 edit).

**RED**: failing tests, added/extended across:

- `benchmark-config.test.ts`: the `INPUT_HASH`/`BENCHMARK_VERSION` drift guard expects the
  v16 digest (fails until `MATCH` + version + hash are updated together). Mutator focus:
  the exact version string + hash constant.
- `gauntlet-calibration.test.ts` — a **passivity-adoption lock** mirroring the jogai lock:
  - _exercised_ (relaxed fire): ∃ a board bout where a real bot commits **≥2 passivity fouls**
    under `MATCH` (the shared ladder confers a penalty point). The vulture is the ≥2-foul victim.
    Companion "guard bites": with passivity OFF (`MATCH_NO_PASSIVITY`), total passivity fouls == 0.
  - _field-read_: an AST walk (`readsPassivityRemaining`, analog of `movesReferencedBy` /
    `selfXConstants`) asserts the **jabber's** conditions reference the path
    `self.passivityRemaining`. Companion "guard bites": a bot referencing some _other_ self
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

### Slice 2 (PR 2): CLI passivity foul breakdown — version-neutral reporting ✅ DONE (`414405f`)

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

- `playBothSides`; extend `officiatingLine`.

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

- **Reader/trigger circularity** — ✅ MEASURED & resolved. Carrier = jabber (natural staller,
  reads-to-avoid), victim = grappler (shaped headroom bot). Trigger + read on different bots.
- **`passivity.limit` calibration** — ✅ MEASURED & REVISED to **240**. 120 mis-flagged the jabber's
  legitimate patient game; 240 self-calibrates the board while a pure turtle still fouls 80×.
- **Pooled-ladder coupling (v16)** — ✅ MEASURED. v15 jogai fire (sweeper→vulture) survives the
  pooled ladder (12 fires at limit 240); re-verify once more after the two bot edits.
- **Per-PR board re-characterization** — at limit 240 the board self-calibrates (all 6 ∈ band with
  no bot edits), so re-characterization is minimal — just the jabber field-read + shaped grappler.

---

_Per the archive-plans-not-delete policy, this file is ARCHIVED to `docs/archive/` on
feature completion, never deleted._
