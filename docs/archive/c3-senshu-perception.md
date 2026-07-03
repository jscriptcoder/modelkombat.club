# Plan: C3 — Senshu Perception (`self.senshu` / `opponent.senshu`)

**Branch**: feat/senshu-perception
**Status**: Active

## Goal

Surface the bout-level senshu holder to bots as two live, egocentric DSL reads — `self.senshu` and
`opponent.senshu` — so a bot can protect its own first-blood lead or bait a holder into fouling it
away. Pure perception fold-in: the C1 latch/revocation already computes `senshuHolder`; C3 only reads
it out. One PR.

## Resolved decisions (grill + find-gaps 2026-07-03 — see `s7-match-remainder-stories.md`)

- **Fields (both):** `self.senshu` + `opponent.senshu`, bilateral like `points`/`penalties`.
- **Layer (live, zero delay):** off the bout-level `senshuHolder` in `viewFor`, like `opponent.points`
  — NOT the `L_act` ring buffer (`senshuHolder` isn't in the `Frame` at all; delaying would contradict
  the zero-delay `opponent.points` senshu is derived from).
- **Encoding (two booleans):** `senshuHolder === "A"/"B" ? 1 : 0`, egocentric; `undecided` and `none`
  both collapse to `0/0` (availability nuance deferred as YAGNI).
- **Slicing (one PR):** both readers share the `senshuHolder → viewFor` threading; no sub-split.
- **Spec:** mechanical `gen:spec` regen (2 bullets + 2 enum entries, no prose); no
  `BENCHMARK_VERSION`/`INPUT_HASH` change (Capability D owns the senshu win/draw prose).

## Acceptance Criteria

Verified behaviorally through a minimal probe bot that branches its move on `self.senshu` /
`opponent.senshu` (the C2b `clock.overtime` `attackOnceWhenOvertime` pattern) + interpret-tick
reader-table rows. Full text in `s7-match-remainder-stories.md` (find-gaps 2026-07-03).

- [x] **AC-1** — solo-holder read + swap: A latches senshu → A reads `self=1`/`opp=0`, B mirrors
      (`self=0`/`opp=1`); also interpret-tick reader rows for both fields.
- [x] **AC-2** — undecided read: pre-first-blood → both read `0/0`.
- [x] **AC-3** — none (simultaneous) → `0/0` for the rest of the bout (== undecided).
- [x] **AC-4** — none (revoked) + revoke visibility: holder fouls it away → from next tick both reads
      drop to `0/0`, not transferred (opponent's `self.senshu` stays `0`).
- [x] **AC-5** — penalty never confers (visibility): a penalty point never makes a fighter read as
      holder; a later solo technique still latches.
- [x] **AC-6** — same-tick latch-then-revoke never flashes: bot never reads `self.senshu = 1`
      transiently (view goes `0` → `0`).
- [x] **AC-7** — read cadence = live-points cadence: first reads `1` on tick T+1, lockstep with
      `opponent.points`, no extra `L_pos`/`L_act` delay.
- [x] **AC-8** — `opponent.senshu` is LIVE (immune to `L_act`): with `L_act > 0`, flips in lockstep
      with `opponent.points`, not lagged.
- [x] **AC-9** — persists across resets incl. OT: holder still reads `1` after yame/jogai/passivity +
      overtime `resetToNeutral`.
- [x] **AC-10** — byte-identical absent + swap-symmetric + interpreter 100%: absent `match.senshu` →
      `0/0` all bout, existing fights byte-identical (no `FightResult` change), replay-stable.
- [x] **AC-11** — spec drift-clean: `docs/spec.md` regenerated (2 bullets + 2 enum entries, bare, no
      prose), drift test re-pinned, no version/hash bump.

## Slices

Every slice follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR. No production code without a failing test.

### Slice 1 (only): both senshu reads + spec regen

**Value**: A bot author gets two live first-blood tells (`self.senshu` / `opponent.senshu`) to drive
protect/steal play; the platform gains the C3 perception surface with zero outcome change.
**Path**: bot DSL `read("self.senshu")` / `read("opponent.senshu")` → `FIELD_READERS` (dsl.ts, the
TCB) → the `State` view built in `viewFor` (sim.ts) from the bout-level `senshuHolder` local threaded
in at the two per-fighter call sites → observable as the probe bot's post-latch action in the frame
stream / `FightResult`. Intentionally skipped: the undecided-vs-none availability tell (YAGNI); all
senshu win/draw spec prose (Capability D).
**Required implementation skills**: before code, load `tdd`, `testing`, `mutation-testing`,
`refactoring`.

**Acceptance criteria**: AC-1…AC-11 above. **Present to human and confirm before writing code.**

**RED** (write failing tests first, in this order):

1. **interpret-tick reader rows** (`src/engine/interpret-tick.test.ts`): add table rows
   `["self.senshu", { self: { senshu: 1 } }, 1]` and `["opponent.senshu", { opponent: { senshu: 1 } },
1]`. These fail to compile until `FieldPath` + the state types include `senshu` — add `senshu: 0` to
   the `getMockState` default `self` / `opponent` objects (like C2b's `overtime: 0` on the default
   clock). Fails for the right reason (unknown field path / missing reader), not merely a type error:
   scaffold the type + a deliberately-wrong placeholder reader (`() => 0`) so the row is RED on value.
2. **run-fight behavioral ACs** (`src/engine/run-fight.test.ts`, new describe block): a probe-bot
   helper `attackWhenSelfSenshu(move)` / `attackWhenOppSenshu(move)` — rules keyed on
   `eq(self.senshu, 1)` / `eq(opponent.senshu, 1)` emitting a distinct observable action recorded in
   `FighterFrame.action` (a move switch or mem-gated second behavior). Fixtures:
   - AC-1 solo latch + swap-symmetry (drive first blood to a known holder; assert both fighters' reads,
     and the swapped fixture mirrors).
   - AC-2 undecided (`0/0` before any score), AC-3 simultaneous first blood (`0/0` forever),
     AC-4 holder foul → `0/0` from T+1, AC-5 penalty point never reads as holder,
     AC-6 same-tick latch+foul never surfaces `1`.
   - AC-7 cadence: senshu `1` first appears on the same tick the live `opponent.points` increment does
     (T+1), no extra delay.
   - AC-8 `perception` latency `act > 0`: `opponent.senshu` flips at T+1 (lockstep with the live
     `opponent.points`), NOT T+1+`L_act`.
   - AC-9 persists across a yame/jogai/passivity reset AND an overtime `resetToNeutral`.
   - AC-10 `match.senshu` absent → `0/0` all bout + `FightResult` byte-identical to a pre-C3 baseline
     (`JSON.stringify` equality, the §7 byte-identical idiom) + replay-stable + swap-symmetric.
3. **spec drift** (`docs/spec.md` drift test, `src/**/gen-spec.test.ts`): goes RED automatically once
   the two readers join `ALLOWED_FIELDS` (the field-whitelist bullets + JSON Schema `fieldPath.enum`
   gain the two entries).

**Likely mutator gaps to pre-empt** (from `mutation-testing` `resources/mutator-rules.md`): the
egocentric map is `senshuHolder === "A" ? 1 : 0` — assert BOTH arms per field (holder == self ⇒ `1`,
holder != self ⇒ `0`) so the `EqualityOperator` (`===`→`!==`) and `StringLiteral` (`"A"`→`""`) mutants
die. **Deliberately chosen over a bare `holds ? 1 : 0`** so a killable non-conditional mutant exists —
Stryker under-generates the `ConditionalExpression` mutant for `X ? 1 : 0` literal ternaries (the C2b
gotcha), but the `===`/string mutants fully cover the mapping here, so NO hand-verification is needed.

**GREEN** (minimum code):

1. `src/engine/types.ts`: add `senshu: number;` to `SelfState` (after `passivityRemaining`) and
   `OpponentState` (after `passivityRemaining`) with a one-line comment (live first-blood tell; `0` =
   not held / no senshu configured — the sentinel).
2. `src/engine/sim.ts` `viewFor`: grow the signature by two params `selfSenshu: number, oppSenshu:
number`; assign `senshu: selfSenshu` in the `self` view and `senshu: oppSenshu` in the `opponent`
   view. At the two call sites (sim.ts:1027 A-view, :1034 B-view) pass the egocentric ternaries —
   A-view: `senshuHolder === "A" ? 1 : 0`, `senshuHolder === "B" ? 1 : 0`; B-view mirrored
   (`=== "B"`, `=== "A"`). Swap-symmetric by construction; the `===` lives at the call site so it is
   mutation-covered.
3. `src/engine/dsl.ts` (the TCB): add `| "self.senshu"` and `| "opponent.senshu"` to the `FieldPath`
   union and `"self.senshu": (s) => s.self.senshu`, `"opponent.senshu": (s) => s.opponent.senshu` to
   `FIELD_READERS`. `ALLOWED_FIELDS` auto-derives; the interpreter stays 100% (static readers, value
   config-gated — the reader can't depend on `match`, only the value is `0` when `senshuHolder` never
   latches).
4. `npm run gen:spec` → regenerate `docs/spec.md` (2 bullets + 2 enum entries appear mechanically).

**MUTATE**: `rm -rf .stryker-tmp reports` first, then scoped:
`npx stryker run --incremental --force --mutate "src/engine/sim.ts:<viewFor senshu lines>,src/engine/sim.ts:<call-site senshu ternaries>,src/engine/dsl.ts:<reader lines>"`
(single `--mutate`, comma-separated ranges). Produce the report. `rm -rf .stryker-tmp reports` after.

**KILL MUTANTS**: expected killable set — `EqualityOperator` + `StringLiteral` on the four call-site
`senshuHolder === "X"` comparisons (killed by AC-1's both-arms assertions), `ArrowFunction` on the two
`FIELD_READERS` (killed by the interpret-tick rows). Ask the human only if a survivor's value is
genuinely ambiguous.

**REFACTOR**: assess only if it adds value. `viewFor` now takes 10 positional args — note but likely
DEFER an options-object refactor (broader than this slice; keep positional for consistency with the
C2b `cap, inOT` precedent). Confirm the two mirrored call-site ternaries read clearly as a swap pair.

**Done when**: AC-1…AC-11 met, `docs/spec.md` regenerated + drift-pinned, typecheck + lint + full suite
green, mutation report reviewed (changed-line 100% or documented equivalents), human approves commit.

## Pre-PR Quality Gate

1. Mutation testing — scoped Stryker on the changed `viewFor` region + call-site ternaries +
   `dsl.ts` reader region (report-reviewed).
2. Refactoring assessment — `refactoring` skill (viewFor arg-list note).
3. `npm run typecheck` + `npm run lint` + `npm test` all green.
4. `docs/spec.md` regenerated via `npm run gen:spec`, LF-pinned, drift test re-pinned byte-for-byte.
5. Confirm byte-identical-absent (`match.senshu` absent ⇒ no `FightResult` change) + replay-stable +
   swap-symmetric.

## TDD Evidence (for the PR)

RED: the interpret-tick rows + run-fight behavioral fixtures + spec-drift failure.
GREEN: types + `viewFor` threading + `dsl.ts` readers + `gen:spec` regen.
MUTATE + KILL: scoped Stryker on the senshu regions; `===`/string/reader mutants killed.

---

_Delete this file when the plan is complete. If `plans/` is empty, delete the directory._
