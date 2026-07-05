# Air-actions — story split (2026-07-05)

Vertical child stories for the air-actions capability. Resolved design:
`plans/air-actions-decisions.md`. These are **capability-level** stories (what a
bot author can do, demonstrable validate → fight → replay); each feeds `planning`,
which will re-derive the PR-sized slices inside it (including the project's
fixture-first-then-canonical sequencing — a PR concern, **not** a story boundary).

## Parent

**A bot author can use aerial combat** — jump around the ring and attack from the
air — and the frozen gauntlet/benchmark exercises it. Too large because it spans a
new state-machine branch (airborne + attacking), a new canonical technique, a new
perception surface, and a gauntlet recalibration.

Actor: the **bot author / LLM** who writes DSL bot documents and is scored against
the gauntlet. Secondary: the **platform maintainer** who keeps the benchmark
calibrated.

## Recommended First Slice

**A bot can jump horizontally to reposition** (aerial mobility) — jump `dir`
finally moves the fighter through the arc (approach / retreat / dodge-and-relocate).

Why this first: honors the grill's "displacement first" decision; a genuine
primitive whole (a real, if modest, tactical tool); independently shippable; burns
down the `vx`-on-airborne-state + emergent-jogai + cross-up-facing risks before the
heavier air-strike work. **Warning:** the heaviest architecture risk — the
air-attacking state composition (two clocks, landing-is-master, §11 integration) —
lives in Story 2, so this slice does **not** de-risk that; see Warnings.

## Split Candidates

| Slice                                               | Value                                                                                                             | Includes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Defers                                                                        | Acceptance Examples                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Release Constraint                                                                                                                                                                            |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Aerial mobility** (jump horizontally)          | Bot gains a committed horizontal jump — approach past a zoner, retreat, dodge-and-relocate                        | `vx` stored on the airborne state, `jumpXSpeed` Rules field + canonical value, constant-velocity-locked-at-launch, emergent jogai, cross-up facing (world-space `vx` survives a mid-arc facing flip)                                                                                                                                                                                                                                                                                                                  | Air strikes; self-perception reads; anything that reads the airborne velocity | **G** a bot returns `{jump, dir:1}` at neutral range **W** it fights **T** its `x` closes toward the foe across the arc, lands at `y=0`, replay byte-identical · **G** `jumpXSpeed` absent **T** jumps are vertical-only, byte-identical to today · **G** (match mode) a forward jump arcs `x` into the out-zone **T** a jogai foul fires + reset to grounded neutral · **G** a forward jump that crosses past the foe **T** facing flips mid-arc but travel continues same-direction (cross-up)                                                                                                                                 | Shippable; canonical `jumpXSpeed` ⇒ a benchmark version bump (mechanical — no gauntlet bot jumps yet, so no rebalance). Wiring-vs-consolidation sequencing = planning decision                |
| **2. Air strikes** (jump-in with `tobi-geri`)       | The headline: a bot can jump-in and land an aerial technique, scored by the benchmark                             | air-attacking state, `MoveSpec.air` flag (reuse `attack`, TCB untouched), landing-is-master + landing-lag = move `recovery`, horizontal-only reach, anti-air = trade / clean-stuff-by-timing, throws can't grab air-attacking, out of cancel web, anytime-airborne one-per-jump; canonical **`tobi-geri`** (bands `[high,mid]`, `scoreByBand {high:3,mid:2}`, pure scoring, gas-locked); air = incomparable island in the no-Pareto test; **`self.posture`** (the minimum read to time it); spec regen + version bump | `self.y`/`self.vy` (finer timing → Story 3); gauntlet rebalance (Story 4)     | **G** an airborne bot `{attack, tobi-geri, high}`, standing foe in reach, active overlaps **T** score 3 (ippon), land into recovery · **G** the foe crouches **T** the high `tobi-geri` whiffs (crouch vacates high) · **G** `{…, mid}` **T** score 2 vs standing AND crouching · **G** a ground-only move issued airborne (or any non-attack) **T** degrade to idle, arc continues · **G** a grounded strike active while the jumper is still in startup **T** clean stuff (only grounded scores) · **G** both active same tick **T** trade · **G** a throw vs an air-attacking foe **T** no grab · same fight ⇒ byte-identical | Shippable; bot-reachable; benchmark version bump. Big story — planning slices it into the mechanic (fixture) PRs + the canonical `tobi-geri` PR + a reads-only `rule("moves.tobi-geri.*")` PR |
| **3. Precise air timing** (`self.y`, `self.vy`)     | Finer air-strike control — strike at apex, or only while descending                                               | `self.y` (height), `self.vy` (vertical velocity, sign = rising/falling); live zero-delay static `FIELD_READERS`                                                                                                                                                                                                                                                                                                                                                                                                       | —                                                                             | **G** `self.y`/`self.vy` exposed **W** a bot gates its air strike on `self.vy < 0` **T** it only strikes while descending · reads are live (zero delay), mirror `opponent.y`/`vx` · **G** no arc configured **T** sentinel reads, byte-identical · `dsl.ts` interpreter stays 100%                                                                                                                                                                                                                                                                                                                                               | Shippable; a refinement of Story 2 (Story 2 is usable with `self.posture` + `mem`-counted tick timing; this adds reactive precision)                                                          |
| **4. Gauntlet exercises aerial combat** (rebalance) | The measuring instrument stays honest with air strikes in the meta; coverage lock proves `tobi-geri` is exercised | **rekka** carries the jump-in `tobi-geri`, firing gate tuned empirically; calibration-lock update (band + coverage guards); `docs/benchmark-gauntlet-v<next>.md`; dogfood re-characterization                                                                                                                                                                                                                                                                                                                         | —                                                                             | **G** rekka carries `tobi-geri` **W** the frozen round-robin runs **T** all 6 bots ∈ `[0.25, 0.75]` AND the coverage guard sees `tobi-geri` referenced + reachable (ideally firing) · **G** a "guard bites" companion **T** an uncovered roster / out-of-band pushover fails the lock · new `BENCHMARK_VERSION` + gauntlet doc                                                                                                                                                                                                                                                                                                   | Shippable; closes the capability. Empirical gating per the S2/S3 lesson (committal niche moves often need narrow-gating)                                                                      |

## Parking Lot

- **Canonical-wiring sequencing** — ✅ RESOLVED (find-gaps decision 4):
  **consolidated**, 2 bumps. See the Story 1 "Sequencing" note above.
- **find-gaps edge cases** — ✅ RESOLVED, written back as hardened ACs above:
  cross-up (AC-1.1), jump-from-non-neutral (AC-1.2), ring-edge clamp (AC-1.3),
  jump-while-gassed (AC-2.4), double-air-strike swap-symmetry (AC-2.3),
  air-strike × okizeme (AC-2.5), yame/jogai mid-arc (AC-2.6), connect-then-land
  (AC-2.2), landing-recovery punish (AC-2.7), degrade telemetry (AC-2.8),
  one-per-jump (AC-2.9). **Still open — passivity × jump (Story 4):** an air-strike
  commit should count as engagement (reset the passivity clock) but a bare jump
  should not; verify how offense-detection keys the passivity clock during Story 4
  planning and add the AC then (deferred — it lives in the officiating-adoption
  slice, not the mechanic).
- **Air-only vs air+ground moves** — decisions doc assumes disjoint sets
  (`tobi-geri` air-only). If a future move is both, revisit the `air` flag
  semantics. Not needed now.

## Warnings

- **Risk ordering:** the recommended first slice (mobility) does not burn the
  capability's biggest architecture risk — the air-attacking two-clock state
  composition + §11 integration in Story 2. Mitigation: Story 1 establishes the
  "airborne state carries extra data (`vx`)" pattern that Story 2 extends. If you
  would rather burn the air-strike risk first, Story 2 can lead (it doesn't depend
  on horizontal displacement — you can air-strike from a vertical jump). The grill
  chose displacement-first; keeping that unless you say otherwise.
- **Story 1 standalone value is modest** — horizontal jump without air strikes is a
  real but minor repositioning tool; its full payoff is unlocked by Story 2's
  jump-ins. It clears the "not just a solution detail" bar (a bot gains a
  tactical option + it generates gauntlet feedback), but do not oversell it.
- **Do NOT split Story 2 into "mechanic (fixture-only)" + "canonical" as separate
  _stories_** — a fixture-only mechanic isn't bot-reachable (a component, not a
  vertical slice). That division is a planning/PR concern _inside_ Story 2.

## Hardened acceptance criteria (find-gaps, 2026-07-05)

Confirmed decisions written back per story. These supplement the table's
acceptance examples.

### Story 1 — Aerial mobility

- **AC-1.1 (cross-ups allowed, emergent).** Given the engine has no inter-fighter
  collision (`distance`/reach are `|Δx|`, facing recomputes each tick, walk clamps
  to the ring only), when a forward horizontal jump carries a fighter past the
  opponent's `x`, then the fighter passes through and lands on the far side (a
  cross-up); `facing` recomputes on landing, `vx` is unchanged mid-arc (world-space,
  locked at launch — no collision clamp), and `distance`/reach stay correct
  (`|Δx| ≥ 0`). No inter-fighter collision rule is added. A bot reads `self.x` to
  choose whether to cross.

- **AC-1.2 (jump commits only from neutral).** Given a fighter that is not neutral
  (mid-move, mid-throw, downed, or already airborne), when it issues `jump`, then the
  jump degrades to idle — no relaunch, no double-jump — like every committed action.
- **AC-1.3 (ring-edge clamp is horizontal-only).** Given a horizontal jump toward a
  ring edge, when `x` would exceed `[0, ring.width]`, then `x` clamps to the edge
  while the vertical arc continues to completion and still lands at `y ≤ 0` (the
  clamp never shortens the airtime).
- **AC-1.4 (integer + replay + swap-symmetry).** `vx` is integer sub-units/tick,
  constant per arc; the arc + horizontal displacement replay byte-identically; a
  mirrored start produces a mirrored jump (swap-symmetric).
- **Sequencing (decision 4 — consolidated).** `jumpXSpeed` stays fixture-proven in
  Story 1; `CANONICAL_RULES` is untouched until Story 2's consolidated wiring ⇒
  Story 1 `npm run fight` is byte-identical and Story 1's release is
  **internal/fixture-proven** (bot-reachable-in-benchmark once Story 2 wires
  `jumpXSpeed` + `tobi-geri` together — one version bump; Story 4's rebalance is the
  second).

### Story 2 — Air strikes

- **AC-2.1 (reactable + blockable).** Given `tobi-geri`'s `startup ≥ lAct+1` (7,
  like every committed move), when a grounded defender reads the incoming air strike
  (`opponent.attacking` + `opponent.attackBand` on the `L_act` layer) and raises the
  matching-band guard, then it blocks (reaction-block iff `S ≥ lAct+1` holds); a
  FRESH matching guard **parries** it → `parryRecovery` + a counter window, and the
  air striker (landing into recovery) is counter-punishable. Composes via
  `computeStrike` (the air-attacking fighter is just an active striker). The jump
  telegraph (`opponent.posture: airborne` for the whole arc) is a bonus pre-read.
  The reactability invariant is preserved (no fast-overhead exception).

- **AC-2.2 (connect-then-land ordering).** Given an air strike whose active tick
  coincides with the landing tick, when the tick resolves, then the strike resolves
  FIRST off the pre-advance airborne snapshot (§11 compute/apply) and landing occurs
  AFTER in `advance` — so the last airborne active tick CAN connect, then the fighter
  enters landing recovery. Forced by the S1 posture → S2 intake → S3 compute → S4
  apply → S5 advance pipeline.
- **AC-2.3 (swap-symmetry of air resolutions).** Given two fighters both
  air-attacking with aligned active windows + bands in range, when resolved, then
  both score (a trade), swap-symmetric; and air-strike vs grounded-strike resolves
  swap-symmetrically through the compute-then-apply union (air-attacking is just an
  active striker in the union).
- **AC-2.4 (jump-while-gassed / unaffordable air strike).** Given a gassed or
  low-stamina fighter, when it jumps, then the jump launches (a jump costs no
  stamina); when it then issues an air move it cannot afford, the air strike degrades
  to idle (existing affordability gate) and the fighter rides the arc to landing (no
  strike, no spend).
- **AC-2.5 (air strike can be the okizeme finish).** Given a downed opponent within
  its `finishWindow`, when an air-attacking fighter's active strike is in range, then
  it lands the FINISH — scoring `finishScore`, ignoring band/occupancy (the foe is
  prone), closing the window — composing via `computeStrike`'s finish variant exactly
  like a grounded finish.
- **AC-2.6 (yame can't fire mid-arc; jogai can).** Given a fighter is air-attacking
  (not neutral), when the yame trigger is evaluated, then it does NOT fire
  (`isNeutral` requires `state.kind === "neutral"`) — a scored air strike is never
  amputated by yame; the fighter lands + recovers to neutral first, THEN yame checks.
  Given jogai (match mode), a jump arcing `x` into the out-zone DOES reset mid-arc
  (jogai is x-position-based, state-agnostic) → `resetToNeutral` drops the fighter to
  grounded neutral; points already scored persist.
- **AC-2.7 (landing recovery is a normal punishable window).** Given a fighter in
  post-landing recovery (`spec.recovery` + gas `extra`), when an opponent strike or
  throw is active in range, then it lands normally — the fighter is grounded and
  recovering (cannot guard, like any recovery) — so a whiffed/mistimed air strike is
  punishable on landing.
- **AC-2.8 (degrade telemetry for wrong-context air paths).** Given an air move
  issued while grounded, or a ground move / non-attack issued while airborne, when it
  degrades, then a typed `FighterFrame.degrade` reason is recorded (a new
  wrong-context reason alongside the existing `unaffordable`/`out-of-band`/`locked`/
  `inert`) and surfaced in the CLI read-out. Exact enum name is a planning detail.
- **AC-2.9 (one air strike per jump; non-attacks degrade).** Given an airborne
  fighter, when it issues any non-attack action (move/block/crouch/throw/throw-break/
  sweep), then it degrades to idle (stays committed to the arc); exactly ONE air
  strike (an `attack` naming an `air` move) may be issued per jump, after which
  `canAct = 0` until landing (a second attempt degrades).

### Story 3 — Precise air timing

- **AC-3.1 (sign convention + sentinels).** `self.vy > 0` rising, `< 0` falling, `0`
  at apex; `self.y ≥ 0` (`0` grounded); `self.posture` ∈ {0 standing, 1 crouching,
  2 airborne}. All live (zero delay). Absent jump physics / not airborne ⇒
  `self.y = 0`, `self.vy = 0`, `self.posture = 0` (grounded sentinels) ⇒
  byte-identical; `dsl.ts` interpreter stays 100%.

### Story 4 — Gauntlet exercises aerial combat

- **AC-4.1 (coverage bar: really fires, with fallback).** Primary: the coverage
  guard requires `tobi-geri` to actually **connect (score) in ≥1 frozen-board bout**
  carried by rekka (the S3 grappler "full real integration" standard). Documented
  fallback if measurement shows it can't reliably connect on the frozen roster (too
  telegraphed): relax to "referenced + reachable" (the S2 zoner precedent), stated
  explicitly in `docs/benchmark-gauntlet-v<next>.md` with the reason. A "guard
  bites" companion (a roster that can't land it) must fail the lock. The band guard
  (all 6 ∈ `[0.25, 0.75]`) stays green.

## Next Step

Run `find-gaps` on this split (seed it with the Parking-Lot edge cases) to harden
the ACs, then load `planning` for **Story 1 (Aerial mobility)** to derive its
PR-sized TDD slices. Each implementation slice must run the full
RED-GREEN-MUTATE-KILL-MUTANTS-REFACTOR cycle (`tdd` + `testing` +
`mutation-testing` + `refactoring`) before the next.
