# Plan: Aerial Mobility (air-actions Story 1)

**Branch**: feat/air-actions-s1-jump-displacement
**Status**: Active

Story 1 of the air-actions capability (`plans/air-actions-stories.md`). Design:
`plans/air-actions-decisions.md` §S1. The remaining air-actions stories (air
strikes, perception, canonical `tobi-geri`, gauntlet rebalance) are separate plans.

## Goal

A bot's `jump` `dir` finally moves the fighter horizontally through the arc
(approach / retreat / dodge-and-relocate), byte-identical when unconfigured.

## Scope

- **In:** `vx` on the airborne state; `jumpXSpeed?` on `Rules`; capture
  `vx = jumpXSpeed × dir × facing` at launch; apply `x = clamp(x + vx, 0, width)`
  every airborne tick; the emergent clamp + cross-up.
- **Out (deferred, per the consolidated-wiring decision):** wiring `jumpXSpeed`
  into `CANONICAL_RULES` (→ Story 2), the `rule("jumpXSpeed")` reader + `spec.md`
  regen (→ Story 2 wiring, following the C4 precedent where the jump-field readers
  landed later with the rule() infra), any air-strike behaviour. `CANONICAL_RULES`
  is untouched ⇒ `npm run fight` byte-identical ⇒ no `INPUT_HASH` flip ⇒ no
  `BENCHMARK_VERSION` bump.

## Acceptance Criteria

- [ ] **AC-1.0 (horizontal travel).** A `jump` with `dir=+1` moves the fighter
      toward the opponent by `jumpXSpeed` sub-units each airborne tick (in the
      facing direction); `dir=-1` moves it away; `dir=0` is pure vertical (no
      horizontal movement — today's behaviour). Displacement accrues across the
      whole arc, including the launch tick and the landing tick.
- [ ] **AC-1.1 (cross-ups allowed, emergent).** A forward jump with enough
      `jumpXSpeed` to pass the opponent's `x` lands on the far side; `vx` is
      unchanged mid-arc (world-space, locked at launch — no collision clamp),
      `facing` recomputes on the next tick, `distance`/reach stay correct
      (`|Δx| ≥ 0`). No inter-fighter collision is introduced.
- [ ] **AC-1.2 (jump commits only from neutral) — characterization.** A fighter
      that is committed (mid-move / airborne / throwing / downed) and issues `jump`
      does not relaunch — it degrades (`"locked"`) and its current state continues.
- [ ] **AC-1.3 (ring-edge clamp is horizontal-only).** A horizontal jump toward a
      ring edge clamps `x` to `[0, ring.width]` while the vertical arc still
      completes and lands at `y ≤ 0` (the clamp never shortens the airtime).
- [ ] **AC-1.4 (integer + replay + swap-symmetry).** `vx` is integer sub-units/tick,
      constant per arc; a full fight replays byte-identically; a mirrored start
      produces a mirrored jump.
- [ ] **AC-1.5 (absent-config byte-identical).** With `jumpXSpeed` absent, jumps are
      vertical-only and every existing test / replay is byte-identical to the
      pre-change engine.

## Slices

Every slice follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR. No production code
without a failing test. Read `.claude/CLAUDE.md` + the testing rules before coding.

### Slice 1: A bot's forward/back jump moves it horizontally through the arc

**Value**: The bot author gains a committed horizontal jump — approach past a
zoner, retreat, or dodge-and-relocate — the first air-actions capability and the
`vx`-on-airborne-state pattern that Story 2's air-attacking state extends.

**Path**: bot returns `{ type:"jump", dir }` → `intake` (only from neutral;
sim.ts:522) captures `vx = jumpXSpeed × dir × facing` onto the airborne state →
`advance` (sim.ts:839, airborne branch) applies `x = clamp(x + vx, 0, ring.width)`
every airborne tick, then integrates the vertical arc / landing → observable as the
fighter's `x` over the fight (and byte-identical replay). Intentionally skipped: the
`rule("jumpXSpeed")` reader, canonical wiring, air strikes (all later stories).

**Required implementation skills**: Before code changes, load `tdd`, `testing`,
`mutation-testing`, and `refactoring`. (`characterisation-tests` for the AC-1.2
already-enforced behaviour.)

**Acceptance criteria**: AC-1.0 through AC-1.5 above. **Present to human and confirm
before writing any code.**

**RED** — failing tests (behaviour, via the public `runFight` / tick surface, with a
fixture `Rules` carrying `jumpImpulse`/`gravity`/`lowClearance` + a new `jumpXSpeed`;
mutation-aware to pre-empt likely `resources/mutator-rules.md` mutants):

- _forward travel & sign_ — `dir=+1` moves `x` toward the foe by `jumpXSpeed`/tick;
  `dir=-1` away; `dir=0` no horizontal move. (Kills `× → +`, `+ vx → - vx`,
  dir-sign mutants.)
- _facing multiplication_ — a fighter with `facing=-1` (facing left) jumping
  `dir=+1` moves LEFT (toward its foe). (Kills dropping `× facing` / facing-sign.)
- _multi-tick accumulation_ — over the whole arc `x` accrues `Σ vx` (launch tick and
  landing tick included). (Kills not-storing-`vx`, off-by-one on the airborne
  branch, applying vx only once.)
- _absent `jumpXSpeed`_ — with the field absent `vx = 0` ⇒ vertical-only, and a
  full fight is byte-identical to the pre-change baseline. (Kills `?? 0 → ?? 1`.)
- _ring-edge clamp (both bounds)_ — a forward jump near `ring.width` clamps `x` to
  exactly `ring.width`; a backward jump near 0 clamps to exactly `0`; the arc still
  lands at `y=0`. (Kills clamp-bound mutants `0→1`, `width→width±1`, remove-clamp.)
- _cross-up_ — a forward jump with `jumpXSpeed` large enough passes the foe's `x`
  and lands on the far side; `distance` stays `|Δx| ≥ 0`; facing recomputes.
- _jump-from-non-neutral (characterization)_ — a mid-attack (and an airborne)
  fighter issuing `jump` does not relaunch (state unchanged; degrade `"locked"`).
- _replay + swap-symmetry_ — same seed/config ⇒ byte-identical events; a mirrored
  two-fighter start ⇒ mirrored `x` trajectories.

**GREEN** — minimum code:

- `types.ts`: add `vx: number` to the `airborne` `MoveState` variant; add optional
  `jumpXSpeed?: number` to `Rules` (documented like `jumpImpulse`).
- `sim.ts` intake jump handler (~522): `f.state = { kind:"airborne",
vy: rules.jumpImpulse ?? 0, vx: (rules.jumpXSpeed ?? 0) * action.dir * f.facing }`.
- `sim.ts` advance airborne branch (~839): first line
  `f.x = clamp(f.x + st.vx, 0, rules.ring.width)`, then the existing y-integration /
  landing.

**MUTATE**: run `mutation-testing` on the changed `sim.ts` intake + advance lines;
target changed-line 100% (mirror the existing jump-arc coverage).

**KILL MUTANTS**: add/strengthen tests for survivors (esp. the `× facing` and clamp
bounds); ask the human if any survivor's value is ambiguous.

**REFACTOR**: assess only if it adds value — likely none (the change mirrors the
existing `move`-clamp and arc-integration idioms verbatim).

**Done when**: AC-1.0–AC-1.5 met, mutation report reviewed, typecheck + lint clean,
full suite green (byte-identical existing tests confirm AC-1.5), human approves
commit.

## Pre-PR Quality Gate

1. Mutation testing — `mutation-testing` on the changed `sim.ts` regions (100%
   changed-line).
2. Refactoring assessment — `refactoring`.
3. `npm run typecheck` + `npm run lint` clean; `npm test` green.
4. Confirm `CANONICAL_RULES` / `spec.md` / `BENCHMARK_VERSION` UNCHANGED (this slice
   is engine-only; `npm run fight` byte-identical).

---

_Story 1 COMPLETE (PR #158, merged `c3ff512`). **Archive** this plan under
`docs/archive/` with a `README.md` entry when the air-actions capability closes —
**do NOT delete** (project convention overrides the planning skill's delete footer)._
