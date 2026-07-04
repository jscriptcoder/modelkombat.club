# Plan: Overtime benchmark + spec adoption (item 3, overtime slice — v17)

**Branch**: feat/overtime-v17-adoption
**Status**: ✅ COMPLETE — Slice 1 PR #154 (merged), close-out this PR. `BENCHMARK_VERSION` = `v17`.

## Goal

Fold the already-built §7 **overtime** (sudden-death encho-sen, Capability C2) into the LLM
benchmark `MATCH` — the **last** of the three deferred officiating mechanics (jogai v15 ✅,
passivity v16 ✅, overtime v17). Turning it on routes a level-at-cap bout through one
sudden-death period (first to a 1-point gap wins, `endReason:"overtime"`) before senshu's
first-blood fallback. Closes roadmap **item 3**.

Source of truth for resolved decisions: `plans/item3-officiating-adoption-decisions.md`
(all overtime open items now MEASURED & resolved — see below).

## Grill outcomes — measured on the v16 board (2026-07-04)

- **Precondition holds:** the v16 board has **7 level-at-cap bouts** (grappler↔vulture ×4,
  grappler↔rekka ×2, vulture↔jabber ×1). With `overtime:{ticks:300}` on, **all 7 resolve via
  `endReason:"overtime"`** — no board-shaping / victim needed (decision 10 escalation moot).
- **Inherently decisive:** 4 of the 7 flip the winner vs senshu (all grappler→vulture) ⇒ **no
  passivity-style "exercised" relaxation** — the `endReason:"overtime"` "fires" bar is met cleanly.
- **Board stays in band:** with OT on, all 6 ∈ [25,75] (only movement grappler .56→.52,
  vulture .35→.39) ⇒ **no coupled rebalance**.
- **Carrier = jabber MULTI-READ** (user-confirmed): jabber gains a `clock.overtime == 1` all-in
  rule alongside its existing `self.passivityRemaining` read. In only 1 of the 7 OT bouts ⇒
  near-zero band risk; leaves grappler/vulture shaping untouched; read evaluates TRUE on the board.

## Why v17 is the thinnest of the three adoptions

- **No engine change** — `endReason:"overtime"` already exists on `FightResult`, is bucketed in
  `OfficiatingTally.endedBy`, and the sudden-death loop is built. (jogai needed the `fouls`
  telemetry field; overtime needs nothing new.)
- **No new CLI slice** — the CLI `officiatingLine` already renders `/ overtime ${o.endedBy.overtime}`;
  turning the mechanic on makes that count non-zero automatically. (passivity needed a new
  `passivity fouls` line; overtime does not.)
- So the whole adoption is one atomic PR (MATCH flip + spec + jabber carrier + guards + re-pins)
  plus a docs close-out.

## Acceptance Criteria

- [x] `MATCH` carries `overtime: { ticks: 300 }`; `BENCHMARK_VERSION` = `v17`; `INPUT_HASH` re-pinned.
- [x] `bots/jabber.json` gains a `clock.overtime == 1` all-in rule (a real, board-exercised
      field-read) and the jabber stays ∈ [25,75] (47%).
- [x] The full round-robin still keeps **all 6 members ∈ [25,75]** (calibration band lock green).
- [x] `gauntlet-calibration.test.ts` gains an **overtime adoption lock**: FIRES (≥1 board bout
      ends `endReason:"overtime"`) + FIELD-READ (the jabber's conditions reference `clock.overtime`),
      each with a "guard bites" companion.
- [x] `docs/spec.md` (via `gen:spec`) teaches overtime — a `benchmarkSection` bullet extending the
      win-condition cascade to `winGap → overtime → senshu → draw`, and a primer "go all-in when
      `clock.overtime`" clause — both gated on `match.overtime` (taught == scored).
- [x] `dogfood.test.ts` re-pinned to the v17 record (13W/107L unchanged — version refs updated);
      `docs/benchmark-gauntlet-v17.md` characterizes the board.
- [x] `npm run fight` byte-identical (match is scoring-only; no `Rules`/DSL/TCB change).

## Slices

Every slice follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR. No production code without a failing test.

### Slice 1: Atomic v17 overtime adoption

**Value**: An LLM author's benchmarked bot is now scored under sudden-death overtime, and the
spec teaches it — a level-at-cap bout is decided by an extra period, not first-blood alone.
**Path**: `MATCH.overtime` → `runFight` sudden-death loop (already built) → `endReason:"overtime"`
→ `OfficiatingTally.endedBy.overtime` (already tallied + rendered) → CLI report / gauntlet lock;
`gen-spec` → `docs/spec.md`.
**Required implementation skills**: load `tdd`, `testing`, `mutation-testing`, `refactoring` before code.
**Acceptance criteria**: all AC above except the close-out doc-archival ones. **Present to human and get confirmation before writing any code.**
**RED / GREEN (TDD increments, each RED-first):**

1. `benchmark-config.test.ts` — `BENCHMARK_VERSION === "v17"`, `MATCH.overtime` = `{ ticks: 300 }`,
   `INPUT_HASH` pin. GREEN: flip `MATCH` + version + recompute hash + update the manifest comment.
2. `bots/jabber.json` — add the `clock.overtime == 1` all-in rule (LF-pinned per `.gitattributes`).
   Its scoring-input change folds into `INPUT_HASH` (bumped in step 1). Verify jabber ∈ band.
3. `gauntlet-calibration.test.ts` — overtime adoption lock:
   - **FIRES**: ∃ a board bout with `endReason === "overtime"` (walk the roster pairs × seeds like
     `decisiveJogaiFires`). Companion "guard bites": with overtime OFF, count is 0.
   - **FIELD-READ**: the jabber's condition AST references `clock.overtime` (a `clockOvertimeRefs`
     walker, the condition-AST analog of `movesReferencedBy` / `selfXConstants`). Companion: a bot
     without the read fails it.
   - Re-assert the existing BAND lock stays green (all 6 ∈ [25,75]).
4. `gen-spec.ts` — add `overtime?: { ticks: number }` to `type Match`; extend the win-condition
   bullet + primer with the OT cascade/clause, gated on `match.overtime`. `gen-spec.test.ts` asserts
   the OT prose appears with overtime set and is absent without it. Then `npm run gen:spec` → `docs/spec.md`.
5. `dogfood.test.ts` — re-measure the dogfood's v17 W/L/D record (the jabber OT rule may shift the
   jabber-vs-dogfood matchup) and re-pin; update its comment.
6. `docs/benchmark-gauntlet-v17.md` — board re-characterization (win-rates, the 7 OT bouts, the 4
   grappler→vulture flips).
   **MUTATE**: Stryker over `benchmark-config.ts` + `gen-spec.ts` (the changed production files) —
   `rm -rf .stryker-tmp` first. Target 100% (0 survivors), as with jogai/passivity.
   **KILL MUTANTS**: strengthen the new spec-prose / config assertions to kill any survivor.
   **REFACTOR**: assess `gen-spec.ts` (three near-identical `...(match.X ? [bullet] : [])` blocks —
   only extract if it adds value; the senshu/jogai/passivity precedent kept them inline).
   **Done when**: all AC met, full suite + typecheck + lint + format green, mutation report reviewed,
   human approves commit. PR opened + merged on green.

### Slice 2: Close-out (item 3 complete)

**Value**: The repo records item 3 as done; the decisions doc is archived per policy; `plans/` empties.
**Path**: docs-only (no code).
**Required implementation skills**: none (docs); still verify format/lint green.
**Acceptance criteria**:

- `plans/overtime-benchmark-adoption.md` (this file) + `plans/item3-officiating-adoption-decisions.md`
  git-moved to `docs/archive/` with `docs/archive/README.md` index entries (archive-plans-not-delete).
- `docs/STATUS.md` — v17 build-log DONE entry; roadmap item 3 CLOSED (only rounds + air-actions +
  platform remain).
- `.claude/CLAUDE.md` — the deferred-adoption line updated (all three officiating mechanics adopted).
- Memory: new `overtime-benchmark-adoption.md`; update `jogai-…`/`passivity-…` "Next:" lines; `MEMORY.md` index.
- `plans/` is empty.
  **RED/GREEN**: n/a (docs). **Done when**: archived, STATUS/CLAUDE/memory updated, `plans/` empty,
  format:check green, human approves commit. PR opened + merged on green.

## Pre-PR Quality Gate

Before each PR:

1. Mutation testing — `rm -rf .stryker-tmp && npx stryker run --incremental --force --mutate <changed>` (S1).
2. Refactoring assessment.
3. `npm run typecheck` + `npm run lint` + `npm run format:check` green; full `npm test` green.
4. Confirm `npm run fight` byte-identical (no `Rules`/DSL/TCB change).

---

_Archive to `docs/archive/` on completion (per archive-plans-not-delete); do NOT delete._
