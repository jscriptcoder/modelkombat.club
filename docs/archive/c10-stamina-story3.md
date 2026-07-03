# Plan: C10 Story 3 — Gassing penalty

**Branch**: feat/stamina-gas-penalty (Slice 3a; later slices get their own branch)
**Status**: Active

> Source story: `plans/c10-stamina-split.md` (Story 3 row + Story detail + notes N4).
> Resolved design: `docs/DESIGN.md` §P1 ("Gassing (stepped, binary)" + "No-specials is
> emergent"). Engine context: `.claude/CLAUDE.md` Status (C10 Stories 1–2 shipped).

## Goal

A fighter that drops to/below a single `gasThreshold` is **gassed**: its committed
moves recover slower (a flat `gasRecoveryPenalty`, recovery-only), it can read its own
condition via a live `self.gassed`, and — purely by the cost inequality
`specialCost > gasThreshold ≥ basicCost` — it can no longer afford throw/sweep while its
basic strike still commits. Never "cannot act", never a win condition.

## Acceptance Criteria (assert RELATIONSHIPS, never literals)

- [ ] A fighter pushed to/below the threshold has its committed strike's recovery
      **extended** by the penalty (it returns to neutral / becomes whiff-punishable
      strictly later than the same strike thrown un-gassed).
- [ ] A fighter above the threshold recovers in the **unmodified** frame count.
- [ ] The penalty is **recovery-only** (startup + active windows are unchanged — a
      gassed strike still becomes active on the same tick; only its tail is longer).
- [ ] `self.gassed` reads **1 iff stamina ≤ gasThreshold** (live), **0** above it, and
      **0** when no stamina/threshold is configured (the inert sentinel).
- [ ] With `specialCost > gasThreshold ≥ basicCost`, a **gassed** fighter's `throw`/
      `sweep` degrades to `idle` (unaffordable, no spend, no commitment) while its basic
      `strike` still commits — the lockout is **emergent** (no new flag).
- [ ] **Additive guard:** absent `gasThreshold` ⇒ never gassed ⇒ **byte-identical** to
      the Story 2 engine (and absent `Rules.stamina` ⇒ byte-identical to pre-stamina).

## Slices

Every slice runs the full RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR cycle; before code,
load `tdd`, `testing`, `mutation-testing`, `refactoring`. Behavioral `runFight` tests
only (no telemetry object exists). New `Rules` fields are optional ⇒ absent ⇒
byte-identical.

### Slice 3a: A gassed fighter's committed strike recovers slower

**Value**: Over-extension is punished — drop below the line and your moves leave you
exposed longer, so a bot can be whiff-punished for gassing out. (Engine; test-demonstrated.)
**Path**: `intake` commits a costed strike → `spend` drains it → if (post-spend)
`stamina ≤ gasThreshold`, the just-started `attacking` state's `extra` gains
`gasRecoveryPenalty` → `advance` holds the move `extra` ticks longer before neutral →
observable as a later return-to-`canAct` / longer whiff-punish window in `runFight`.
Reuses the existing `extra` recovery accumulator (shared with parry — they compose
additively). **Skipped here:** the read (`self.gassed`, 3b) and the lockout proof (3c).
**Required implementation skills**: load `tdd`, `testing`, `mutation-testing`, `refactoring`.
**Acceptance criteria** (present + confirm before code):

- A fighter whose commit drops it to ≤ `gasThreshold` returns to neutral / becomes
  punishable **later** than the same strike thrown above threshold (recovery extended).
- The extension is **recovery-only**: the gassed strike's active window opens on the
  same tick (startup + active unchanged).
- Evaluation is **post-spend at commit** (the move that gasses you eats the penalty —
  see resolved decision D1): a commit that lands exactly **on** the threshold is gassed
  (`≤`); one above it is not.
- Penalty composes with a parry's `extra` (a gassed **and** parried strike is extended
  by both) — same accumulator, additive.
- Absent `gasThreshold` ⇒ recovery unmodified ⇒ byte-identical to Story 2.
  **RED**: a `runFight` test where a fighter is brought to ≤ threshold and its strike's
  recovery is provably longer than an above-threshold strike's (compare the tick each
  returns to `canAct`, or the tick a punish lands). Mutator-aware: pin the `≤` boundary
  (commit landing exactly on threshold IS gassed — kills the `<`/`>` swaps), pin the `+=`
  (not `=`/`-=`), pin recovery-only (an assertion on the active-frame tick kills a mutant
  that lengthens startup), and an absent-threshold byte-identical guard.
  **GREEN**: add optional `gasThreshold`/`gasRecoveryPenalty` to `Rules.stamina`; add a
  `gassed(f, rules)` predicate (`stamina ≤ gasThreshold`, false if unconfigured); after
  `spend` on an attack/sweep commit in `intake`, if `gassed`, add `gasRecoveryPenalty` to
  the new `attacking` state's `extra`.
  **MUTATE**: run `mutation-testing` on the changed sim.ts lines (changed-line 100%).
  **KILL MUTANTS**: strengthen boundary/operator/recovery-only tests as needed.
  **REFACTOR**: assess (the `gassed` predicate is the DRY seam 3b reuses — keep it).
  **Done when**: all 3a ACs green, mutation report reviewed, human approves commit.

### Slice 3b: A bot can read its own `self.gassed`

**Value**: Self-pacing — a bot reads its conditioning to back off before locking itself
out of specials. (Engine; the read surface.)
**Path**: derive `gassed` (the 3a predicate) → expose as the live `self.gassed`
DSL field (the **first new TCB allowlist entry** since Story 1's `self.stamina`) → a bot
branches on it. **Skipped here:** the lockout proof (3c).
**Required implementation skills**: load `tdd`, `testing`, `mutation-testing`, `refactoring`.
**Acceptance criteria** (present + confirm before code):

- `self.gassed` = 1 when stamina ≤ `gasThreshold`, 0 when above — proven through a bot
  whose action diverges on the field (behavior, not a direct field read).
- Unconfigured (no `Rules.stamina`, or no `gasThreshold`) ⇒ `self.gassed` = 0; a bot
  reading it in an unconfigured fight is byte-identical to one that doesn't.
- `self.gassed` is on the **static** DSL allowlist (the TCB boundary can't depend on
  `Rules` — only its value is config-gated), mirroring `self.stamina`.
  **RED**: a `runFight` test with a bot that (e.g.) idles to regen while `self.gassed`,
  else attacks — its observable behavior flips at the threshold. A dsl-level validity test
  that `self.gassed` is an accepted field read (interpreter coverage). Mutator-aware: pin
  the `≤` boundary again at the read layer, and the unconfigured-0 sentinel.
  **GREEN**: add `gassed: number` to `SelfState` (types.ts); add `self.gassed` to the
  `dsl.ts` FIELD_READERS allowlist; populate it in `viewFor` from the `gassed` predicate
  (1/0). No new mechanic.
  **MUTATE**: `mutation-testing` on sim.ts (view) + dsl.ts. **dsl.ts interpreter must stay 100%.**
  **KILL MUTANTS**: address survivors.
  **REFACTOR**: assess.
  **Done when**: 3b ACs green, dsl interpreter 100%, mutation reviewed, human approves.

### Slice 3c: A gassed fighter is locked out of specials (emergent)

**Value**: The conditioning mind-game's payoff — gas your foe and their throw/sweep
vanish while their poke remains. (Engine; the design's headline emergent guarantee.)
**Path**: NO new mechanic — Story 1's affordability gate (`stamina ≥ cost`) + numbers
satisfying `specialCost > gasThreshold ≥ basicCost` ⇒ a gassed fighter (stamina ≤
gasThreshold < specialCost) can't afford throw/sweep → `idle`, while basicCost ≤
gasThreshold keeps the strike affordable. A **guarantee/characterization** relationship
test (likely zero production change — see D2). May fold into 3b if a standalone
test-only PR is undesirable.
**Required implementation skills**: load `tdd`, `testing`, `mutation-testing`, `refactoring`
(here primarily `characterisation-tests` framing — documenting an emergent guarantee).
**Acceptance criteria** (present + confirm before code):

- Over a mock `Rules` satisfying `specialCost > gasThreshold ≥ basicCost`: a fighter
  driven to gassed has its `throw` AND `sweep` degrade to `idle` (no spend, no
  commitment) **on the same tick** its basic `strike` still commits.
- The relationship is asserted structurally (the inequality holds in the fixture and
  drives the outcome), not by magic literals.
- Numbers live in the **test fixture** for now; promotion into `CANONICAL_RULES` is the
  deferred consolidated wiring slice (re-tuned against the C9 arsenal) — see D3.
  **RED**: a `runFight` relationship test asserting the simultaneous lockout-of-specials /
  strike-still-commits at gassed, over an inequality-satisfying mock.
  **GREEN**: expected **none** (emergent from existing affordability). If a survivor or
  gap reveals a real hole, address it minimally.
  **MUTATE**: confirm the new test kills a mutant of the affordability `≥`/cost wiring
  (re-scoped over the gas fixture).
  **KILL MUTANTS**: address survivors.
  **REFACTOR**: assess.
  **Done when**: 3c AC green, lockout proven over the inequality, human approves.

## Pre-PR Quality Gate (each slice)

1. `mutation-testing` — sim.ts changed-line 100% (whole-file ~95%+); **dsl.ts interpreter
   100%** for 3b (new allowlist entry).
2. `refactoring` assessment.
3. `npm run typecheck` + `npm run lint` pass.
4. Additive guard test green (absent `gasThreshold` ⇒ byte-identical).

## Resolved decisions (find-gaps)

- **D1 — Gassed evaluated post-spend at commit (RECOMMENDED, confirm).** Stamina is
  static throughout an `attacking` move (spend only on a fresh commit, regen only when
  neutral, chip only on a defender), so "gassed at commit (post-spend)" ≡ "gassed at
  recovery-entry" — they're equivalent, and post-spend is the temporally-coherent reading
  (you spent → you're now gassed → your following recovery is slowed). Consequence: the
  move that drops you to ≤ threshold eats the penalty itself (no one-move grace). Pin the
  `≤` boundary with a mutation test. _Alternative (rejected unless you object):_ pre-spend
  evaluation, giving the gassing move a grace pass — temporally inconsistent and a special-case.
- **D2 — 3c is a guarantee test (no production code expected).** The special-lockout is
  fully emergent from Story 1's affordability gate; 3c documents the guarantee rather than
  adding a mechanic. If a test-only PR is unwanted, fold 3c's relationship test into 3b.
- **D3 — CANONICAL_RULES wiring stays deferred (per split parking lot).** Stories 1 & 2
  did not touch `CANONICAL_RULES`; Story 3 follows suit. The inequality is proven over a
  **test fixture** mock; the real numbers (`max`, `regen`, per-move `staminaCost`,
  `gasThreshold`, `gasRecoveryPenalty`) are authored once in the consolidated wiring slice,
  re-tuned against gas + the C9 arsenal. (This reconciles note N4 — "author those numbers
  in the same slice" — as: author them in the proving fixture now, promote later.)

## Sequencing note

Story 4 (`opponent.stamina`/`gassed` on the `L_act` layer) depends on Story 3 (it reads
the delayed `gassed`). After Story 3: Story 4, then the consolidated `CANONICAL_RULES`
stamina wiring, then C9 arsenal.

---

_Delete this file when Story 3 is complete; mark the split tracker and CLAUDE.md, then
proceed to Story 4. If `plans/` is empty, delete the directory._
