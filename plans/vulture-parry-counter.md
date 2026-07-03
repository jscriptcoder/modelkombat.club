# Plan: Vulture parry→counter redesign (Gauntlet modernization — S1)

**Branch**: feat/vulture-parry-counter
**Status**: Done — `v11`. `vulture` 16→60% (in-band); `sweeper` 82→67% (bargain held).
Side effect: `jabber` 28→19% (OUT low) — accepted, deferred to a new slice (see parent
split). 1017 tests green; `benchmark-config.ts` mutation 100% (10/10).

First PR of the gauntlet-modernization + rebalance feature (parent split:
`plans/gauntlet-modernization-stories.md`). Lever = **bot-document redesign only**
(no `CANONICAL_RULES` change ⇒ `npm run fight` byte-identical).

## Goal

Redesign the `vulture` gauntlet bot into a disciplined **parry→counter** defender
(gas-proof `uraken` counter), fixing its low-tail calibration defect (16%, below the
`[25%, 75%]` band) and covering the first Batch-1 move.

## Confirmed `v10` baseline

| Member | Win% | Band | | Member | Win% | Band |
|---|---|---|---|---|---|---|
| `sweeper` | 82.0 | ❌ high | | `zoner` | 36.0 | ✅ |
| `rekka` | 72.0 | ✅ | | `jabber` | 28.0 | ✅ |
| `grappler` | 66.0 | ✅ | | `vulture` | 16.0 | ❌ low |

Coverage 5/11 moves (uncovered = the 6 Batch-1 moves). **Bargain hypothesis:**
`vulture` meets `sweeper` in 20 of its 100 fights; `sweeper` needs to shed only
≥7 points (82→75) to re-enter band, so a countering `vulture` may pull `sweeper`
in on its own — recorded as an S1 learning outcome, not a commitment.

## Why the counter fires (parry-reliability, de-risked)

A startup-7 strike goes active at `T+7`. `vulture` perceives the `attackBand` tell at
`T+lAct` = `T+6` (±1 jitter) and raises a matching guard → **age 2 at `T+7`** →
inside `parryWindow: 2` → **parry**, which opens `counterWindow: 10` on `vulture`
and `parryRecovery: 12` on the attacker (wide open). A startup-7 counter (`uraken`)
lands well inside the window (`10 ≥ 7+2`). Slower kicks (startup 9/11/13) age the
guard past the window → block only. So `vulture` counters the fast startup-7
pressure of `jabber`/`rekka`/`sweeper` (its hardest matchups); jitter gates
frequency, which the re-measure quantifies.

## Acceptance Criteria

- [ ] `vulture` gains ONE disciplined rule: when `self.counterWindow > 0` (and it can
      afford it), it attacks with gas-proof `uraken`; the defensive core
      (idle-when-committed, `throw-break`, block-by-band, walk-forward, gassed-punish)
      is otherwise unchanged.
- [ ] **Discipline**: offense fires ONLY in the counter window (or the pre-existing
      gassed-punish) — `vulture` does NOT attack in neutral (guards the 16→7% backfire).
- [ ] **Behavioral proof**: fed a snapshot with `self.counterWindow > 0`, `self.canAct
      = 1`, affordable stamina, `vulture` chooses `attack uraken` — a scenario in which
      today's `vulture` chooses block/move (no counter rule exists).
- [ ] `vulture.json` references `uraken` (coverage ++ toward the 12-move goal).
- [ ] Round-robin re-measured at `v11`: `vulture` lands in `[25%, 75%]`; the effect on
      `sweeper` is recorded (bargain check); **no other member is knocked out of band**.
- [ ] `npm run fight` byte-identical (no `CANONICAL_RULES` touch); replay-stable.
- [ ] `dogfood.test.ts` characterization updated to the new gauntlet; `INPUT_HASH`
      re-pinned; `BENCHMARK_VERSION → v11`; the config guard test passes.
- [ ] Full vitest suite + typecheck + lint green.

## Slices

This story is **one PR** — the bot edit, the version bump, and the downstream
characterization updates are atomic (the `INPUT_HASH` guard test fails CI if a bot
file changes without a matching version bump), so they cannot be split without a
broken intermediate state.

### Slice 1: `vulture` parries and counters with a gas-proof `uraken`

**Value**: the benchmark's reactive-defense axis becomes a real test again (`vulture`
in-band), and the gauntlet begins covering the Batch-1 arsenal.
**Path**: opponent startup-7 strike → `vulture` perceives `attackBand` (`L_act`) →
raises matching guard → fresh guard deflects (**parry**) → `counterWindow` opens →
the new rule fires → `uraken` lands in-window → `counterBonus` scores. Real production
path = the DSL interpreter running `vulture.json` inside `runFight`; **no engine
change**. Intentionally skipped: neutral offense, whiff-punish-on-read, kick counters.
**Required implementation skills**: before any code, load `tdd`, `testing`,
`mutation-testing`, `refactoring`.
**Acceptance criteria**: as above — **present and get human confirmation before writing
any test/data.**
**RED** (failing tests first; both fail against today's counter-less `vulture`):
- *Primary (deterministic, interpreter-level)*: given a perceived state with
  `self.counterWindow > 0`, `self.canAct = 1`, affordable stamina, assert `vulture`'s
  action is `attack uraken` (`high`). Fails today (falls through to block/move).
- *Discipline (kills the over-broad rule)*: given `counterWindow == 0`, not gassed,
  opponent not attacking, mid-range, assert `vulture` does NOT attack (move/block/idle).
  This is the guard against an unconditional / `>= 0` counter rule — the 16→7% mutant.
- *Behavioral (end-to-end, also re-confirms parry reliability)*: in a crafted fight
  vs a minimal startup-7 attacker at a seed whose jitter yields a parry, assert
  `vulture` scores a counter (`uraken` + `counterBonus`) inside `counterWindow`. If a
  deterministic parry seed proves fiddly, the aggregate round-robin re-measure is the
  end-to-end evidence and this drops to best-effort (noted, not silently cut).
- *Mutator note*: this slice is a **DATA** change — no new `src/` logic. The mutant it
  must kill is "revert `vulture.json` to the counter-less doc"; the primary + discipline
  RED tests kill it by construction (pass on new, fail on old).
**GREEN**: add exactly ONE rule to `vulture.json`, high-priority (after the
`canAct == 0` idle guard): `when self.counterWindow > 0 → attack uraken high`.
Gas-proof `uraken` (cost 12) so a chip-drained blocker can still counter. No other
rule touched.
**MUTATE**: no new production logic to mutate. The only `src/` change is the versioned
config constants (`BENCHMARK_VERSION`, `INPUT_HASH` in `benchmark-config.ts`), whose
mutants are already killed by the existing `INPUT_HASH` guard test — re-run Stryker on
the changed `benchmark-config.ts` region to confirm 100% (expected: unchanged). Test
effectiveness for the data change is evidenced structurally (RED distinguishes
old-vs-new `vulture` + rejects the over-broad rule).
**KILL MUTANTS**: ensure the discipline test is present and red-first, so an
over-broad or unconditional counter rewrite cannot pass.
**REFACTOR**: assess `vulture.json` rule ordering for readability; keep the defensive
core intact and self-evident.
**Done when**: all ACs met; round-robin re-measured (`vulture` in-band; `sweeper`
effect + any new outlier recorded); `dogfood.test.ts` + `INPUT_HASH` + `v11` updated;
`npm run fight` byte-identical; suite/typecheck/lint green; **human approves commit**.

## Contingency (feeds the escalation ladder)

- If the re-measure shows `vulture` **still < 25%** → the counter alone is insufficient;
  pause and re-grill the `vulture` design (do NOT bolt on neutral aggression).
- If `vulture` **> 75%** (overshoot) or another member is knocked **out** → note it; the
  fix belongs to a later slice (redistribute), not a `vulture` nerf here.
- If `sweeper` falls in-band as a side effect → the bargain holds; S2/S3 become
  coverage-only.

## Deferred to later S-slices

- Capability-level **band-membership + full-coverage** acceptance tests (land in S3/S4,
  when green).
- `zoner` (S2) / `grappler` (S3) modernization; `jabber`/`rekka`/`sweeper` stay frozen.

## Pre-PR Quality Gate

1. MUTATE — confirm `benchmark-config.ts` changed region stays 100% via the guard test
   (no new production logic); document the data-change effectiveness rationale.
2. Refactoring assessment — `vulture.json` rule clarity.
3. Typecheck + lint.
4. Fresh round-robin re-measure recorded as the calibration evidence (the S1 datapoint
   the next slices build on).

---
*Delete this file when S1 is merged; the parent split tracks the remaining slices.*
