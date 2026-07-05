# Plan: Air Strikes (air-actions Story 2)

**Branch**: (one per slice — see below)
**Status**: Active

Story 2 of the air-actions capability (`plans/air-actions-stories.md`). Resolved
design: `plans/air-actions-decisions.md` §S2 (air-strike mechanic) + §S4 (canonical
`tobi-geri` + wiring). Story 1 (aerial mobility) shipped in PR #158 — this story
extends the `vx`-carrying airborne state into an **air-attacking** state.

## Goal

A bot can **jump in and land an aerial technique** (`tobi-geri`), scored by the
benchmark — the headline air-actions payoff. Timing is the skill: strike too early
⇒ active at altitude ⇒ whiff; well-timed ⇒ active overlaps the descending approach.

## Scope

- **In (across the slices):** `MoveSpec.air` flag; a dedicated **air-attacking**
  state (`vy`, `vx`, `spec`, `elapsed`) that integrates the arc AND ticks move
  frames; landing-is-master with landing-lag = the move's own `recovery`; §11
  integration (air-attacking registers as an active striker in
  `computeStrike`/`applyStrike`); horizontal-only reach; anti-air = trade,
  clean-stuff-by-timing; throws can't grab an air-attacker; out of the cancel web;
  one air strike per jump + wrong-context degrade telemetry; `self.posture` (the
  minimum read to time it); canonical **`tobi-geri`** (`air`, bands `[high, mid]`,
  `scoreByBand {high:3, mid:2}`, pure scoring, gas-locked) + consolidated
  `jumpXSpeed` wiring (one `BENCHMARK_VERSION` bump + `spec.md` regen); the
  `air:true` incomparable-island fix in the no-Pareto property test; reads-only
  `rule("moves.tobi-geri.*")` + `rule("jumpXSpeed")` readers.
- **Out (later stories):** `self.y` / `self.vy` finer timing (Story 3); gauntlet
  rebalance — rekka carries `tobi-geri` (Story 4); the passivity×jump AC (Story 4).

## Acceptance Criteria

The hardened ACs live in `plans/air-actions-stories.md` §"Story 2 — Air strikes"
(AC-2.1 … AC-2.9). Mapped to slices below; not duplicated here.

- [x] **AC-2.2** connect-then-land ordering (§11 compute before `advance`) — Slice 1 ✅ (PR #159)
- [x] **AC-2.7** landing recovery is a normal punishable window — Slice 1 ✅ (PR #159)
- [x] Table happy-path: airborne `{attack, <air move>, high}` in range/active ⇒ ippon;
      high whiffs a croucher (crouch vacates high); `{…, mid}` ⇒ 2 vs standing AND
      crouching — Slice 1 (fixture move) ✅ (PR #159) + Slice 4 (canonical, pending)
- [x] **AC-2.8** typed degrade for wrong-context air paths — Slice 2 ✅ (PR #TBD)
- [x] **AC-2.9** one air strike per jump; non-attacks airborne degrade to idle — Slice 2 ✅
- [x] **AC-2.4** jump-while-gassed launches; unaffordable air strike degrades — Slice 2 ✅
- [x] `self.posture` ∈ {0,1,2} live read (the AC-3.1 posture portion) — Slice 2 ✅
- [x] **AC-2.1** reactable + blockable + parry/counter — Slice 3 ✅
- [x] **AC-2.3** swap-symmetry of air resolutions (trade / clean-stuff) — Slice 3 ✅
- [x] **AC-2.5** air strike can be the okizeme finish — Slice 3 ✅
- [x] **AC-2.6** yame can't fire mid-arc; jogai can — Slice 3 ✅
- [x] throws can't grab an air-attacking fighter — Slice 3 ✅
- [ ] canonical `tobi-geri` + `jumpXSpeed` wired; one version bump; `spec.md` regen;
      `air` is an incomparable island in the no-Pareto test — Slice 4
- [ ] reads-only `rule("moves.tobi-geri.*")` + `rule("jumpXSpeed")` readers, no bump — Slice 5

## Slice map

| #   | Branch                                    | One-sentence behaviour                                                                                                      | Benchmark                     |
| --- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 1   | `feat/air-actions-s2-air-strike-core`     | An airborne fighter commits an air move and lands it for points (or whiffs), then lands into recovery                       | neutral (fixture-only)        |
| 2   | `feat/air-actions-s2-air-routing`         | Wrong-context air/ground actions degrade with a typed reason; exactly one air strike per jump; `self.posture` reads {0,1,2} | neutral (fixture-only)        |
| 3   | `feat/air-actions-s2-air-defense`         | A grounded defender can block/parry/trade/stuff/finish an air strike (and throws can't grab it)                             | neutral (fixture-only)        |
| 4   | `feat/air-actions-s2-canonical-tobi-geri` | `tobi-geri` + `jumpXSpeed` land in `CANONICAL_RULES` — a bot can jump-in for an aerial ippon                                | **version bump + spec regen** |
| 5   | `feat/air-actions-s2-tobi-geri-readers`   | Bots can `rule("moves.tobi-geri.*")` / `rule("jumpXSpeed")` to read the air frame data                                      | neutral (no bump)             |

Slices 1–3 keep `CANONICAL_RULES` untouched ⇒ `npm run fight` byte-identical ⇒ no
`INPUT_HASH` flip (the C9/C10 "mechanic-first, canonical wiring as a promoted unit"
pattern). Slice 4 flips it on with one bump; Slice 5 adds readers (no bump).

## Slices

Every slice follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR. No production code
without a failing test. Before code changes, load `tdd`, `testing`,
`mutation-testing`, and `refactoring`. Read `.claude/CLAUDE.md` + the testing rules.
Present each slice's acceptance criteria to the human and **confirm before writing
any code**.

### Slice 1: An airborne fighter lands an air strike (the walking skeleton)

**Value**: The headline capability's core — a bot jumps and connects an aerial
technique for points. Burns the biggest architecture risk (the air-attacking
two-clock state + §11 integration) that Story 1 deliberately left standing.

**Path**: bot (airborne, from a Story-1 jump) returns `{type:"attack", move, band}`
where `rules.moves[move].air` is true → a **new intake route** (placed BEFORE the
generic non-neutral "locked" return at `sim.ts:454`) starts an **air-attacking**
state `{ kind:"air-attacking", vy, vx, spec, band, elapsed:0, scored:false, extra }`
(carrying the launch arc velocities + the move frames), spends stamina + gas `extra`
like a ground commit → `advance` integrates BOTH clocks each tick (`x = clamp(x+vx)`,
`y += vy`, `elapsed++`) → **landing (`y ≤ 0`) is master**: convert to a grounded
recovery for `spec.recovery` (+ gas `extra`), then neutral → `computeStrike`
recognises the air-attacking state as an active striker (widen the `st.kind !==
"attacking"` guard at `sim.ts:636`, read `spec`/`band`/`elapsed`/`scored` from either
shape) and resolves band + reach + occupancy exactly like a ground strike →
`applyStrike` sets `scored` on the air-attacking state (`sim.ts:746`) → `postureOf`
already reports `airborne` for the air-attacking kind (vacates `low`, feeds the
posture perception). Observable: the striker's `points` (connect) / no-change
(whiff), and the landed recovery frames. **Intentionally skipped:** wrong-context
degrade + one-per-jump (Slice 2), block/parry/trade/finish (Slice 3), any canonical
move (Slice 4). Fixture `Rules` with an `air:true` move; test bots trigger the strike
by tick timing (`clock.tick`) — no `self.posture` needed yet.

**Required implementation skills**: load `tdd`, `testing`, `mutation-testing`,
`refactoring`. (`finding-seams` if the two-clock `advance` needs isolating.)

**Acceptance criteria**: table happy-path (connect for `spec.score`/`scoreByBand`;
whiff out of reach; **high air strike whiffs a croucher** via occupancy; **mid**
connects vs standing + crouching); **AC-2.2** (the last airborne active tick CAN
connect off the pre-advance snapshot, THEN landing happens in `advance`); **AC-2.7**
(after landing the fighter serves `spec.recovery` grounded — cannot guard — so a
whiffed air strike is punishable on landing); startup outlasting the airtime ⇒ pure
whiff (active never opens). Absent any `air` move ⇒ byte-identical.

**RED** — failing behaviour tests via `runFight` (mutation-aware): airborne strike
connects for the move's score; whiff when `|Δx| > reach`; **high whiffs a croucher,
mid connects both stances** (occupancy composes); **connect-on-the-landing-tick**
then next tick is grounded recovery (AC-2.2 ordering); **landing recovery is
punishable** — an opponent strike lands on the recovering fighter (AC-2.7);
**startup > airtime ⇒ whiff**; `scored`-once (no multi-hit across the active window);
a config with no `air` move is byte-identical to baseline; replay + swap-symmetry of
a connecting air strike. Pre-empt mutants: the active-window bound (`>=`/`<`), the
`y ≤ 0` landing boundary, the widened `computeStrike` kind guard, `scored` set.

**GREEN** — minimum code: `MoveSpec.air?: boolean` (types.ts, pure data); the
`air-attacking` `MoveState` variant (sim.ts) + its `startAirAttack` constructor; the
intake air-route; the `advance` air-attacking branch (two clocks + landing-is-master
→ grounded recovery); widen `computeStrike`'s attacker guard + read via a small
shared accessor; `applyStrike` sets `scored` for the air-attacking shape;
`postureOf`/throw-immunity/perception left for later slices only where not needed to
connect.

**MUTATE / KILL / REFACTOR**: mutation on the changed intake + advance + computeStrike
regions (target changed-line 100%); kill active-window/landing-boundary survivors;
assess extracting a shared `activeAttack(state)` accessor if computeStrike branching
grows (only if it adds clarity).

**Done when**: the AC above are met, mutation report reviewed, typecheck + lint clean,
full suite green (byte-identical existing tests), human approves commit.

### Slice 2: Wrong-context actions degrade, one air strike per jump, `self.posture`

**Value**: Routing completeness + the read a real bot needs to time the strike — the
DSL contract around air actions becomes total and legible (telemetry never drifts).

**Path**: intake gains the full state×action routing — an `air` move while grounded,
or a ground move / any non-attack while airborne, degrades with a **new typed
`DegradeReason`** (extend the `sim.ts:70` union; e.g. `"wrong-context"`), the fighter
staying committed to its arc (idle-ride); a second `attack` while already
air-attacking degrades (`locked`) ⇒ exactly one air strike per jump; a jump costs no
stamina (launches even gassed) while an **unaffordable** air strike degrades
(existing affordability gate) and the fighter rides to landing. A new static
`self.posture` `FIELD_READER` (0 standing / 1 crouching / 2 airborne, mirroring
`opponent.posture`) lets a bot gate its air strike. The `format.ts` CLI read-out
renders the new degrade reason (the S8 telemetry surface).

**Required implementation skills**: `tdd`, `testing`, `mutation-testing`,
`refactoring`.

**Acceptance criteria**: **AC-2.8** (each wrong-context path records the typed reason,
surfaced in the CLI); **AC-2.9** (non-attack airborne ⇒ idle-ride; second air strike
⇒ degrade); **AC-2.4** (jump launches gassed; unaffordable air strike degrades, no
spend, rides to landing); `self.posture` reads {0,1,2} live, sentinel 0 when grounded
/ no arc, `dsl.ts` interpreter stays 100% (satisfies the posture portion of AC-3.1;
`self.y`/`self.vy` remain Story 3). Absent `air` move / no jump ⇒ byte-identical.

**RED**: wrong-context degrade for each path (air-grounded, ground-airborne,
non-attack-airborne) asserting the exact reason string + CLI text; second-air-strike
degrade; gassed jump launches; unaffordable air strike degrades + no stamina spent +
lands; `self.posture` reads 2 mid-arc / 1 crouching / 0 standing / 0 with no physics;
a posture-gated bot == a plain bot when posture is unused. Mutants: the reason-string
literal, the routing booleans, the `?? 0` sentinel, the interpreter branch.

**GREEN**: the extended `DegradeReason` + intake routing arms; the `self.posture`
`FIELD_READER` + `format.ts` case. **MUTATE / KILL / REFACTOR** as standard.

**Done when**: AC met, mutation reviewed, checks clean, human approves commit.

### Slice 3: A grounded defender can answer an air strike (defense composes)

**Value**: The air strike is a fair, reactable technique — it blocks, parries,
trades, gets cleanly stuffed on a mistimed startup, can finish okizeme, and can't be
grabbed. Proves the §11 "air-attacking is just an active striker" claim end to end.

**Path**: three small production changes make the composition total — the perception
feed (`frameOf`: `attacking`/`attackBand` include the air-attacking kind via the
existing `activeAttack` accessor, so a defender reads the incoming strike on `L_act`),
the throw immunity (`sim.ts:871`: extend `def.state.kind === "airborne"` to the
air-attacking kind), AND `postureOf` (`sim.ts:665`: extend the same `kind ===
"airborne"` guard so an air-attacking fighter reports `airborne` throughout the arc —
mirroring the `y ≥ lowClearance` gate) — after which block / parry / counter / trade /
clean-stuff / okizeme finish all fall out of the existing `computeStrike`/`applyStrike`
union. The `postureOf` widening (a deviation from the original 2-change scope, approved
2026-07-05) delivers AC-2.1's `opponent.posture: airborne` pre-read "for the whole arc"
faithfully and keeps occupancy physically coherent (an air-attacker vacates `low`,
exactly like the pure-airborne jumper). The rest of the slice is **characterization**:
proving the emergent behaviour and pinning it against regression.

**Required implementation skills**: `tdd`, `testing`, `mutation-testing`,
`refactoring`, `characterisation-tests`.

**Acceptance criteria**: **AC-2.1** (a matching-band guard blocks; a FRESH guard
parries ⇒ `parryRecovery` + counter window ⇒ the air striker is counter-punishable on
landing; the reactability invariant `startup ≥ lAct+1` holds; `opponent.posture:
airborne` is a bonus pre-read); **AC-2.3** (two aligned air strikes trade,
swap-symmetric; air-vs-ground resolves swap-symmetrically; a grounded strike active
while the jumper is still in startup cleanly stuffs — only the grounded strike
scores; both active same tick ⇒ trade); **AC-2.5** (air strike lands the okizeme
finish on a downed foe in its `finishWindow` — via `computeStrike`'s finish branch,
free once Slice 1 widened the guard); **AC-2.6** (yame does NOT fire while
air-attacking — `isNeutral` requires neutral — but jogai DOES reset a mid-arc
out-zone, points persist); throws can't grab an air-attacking fighter.

**RED**: block, fresh-guard parry + counter-punish-on-landing, trade (both score),
clean-stuff (grounded-only scores when the jumper is mid-startup), okizeme finish by
an air strike, yame-suppressed-mid-arc + jogai-resets-mid-arc, throw-whiffs-an-
air-attacker; each swap-symmetric where applicable. Mutants: the widened perception
`||`, the widened throw-immunity `||`.

**GREEN**: the three `||` widenings (`frameOf`, throw-immunity, `postureOf`).
**MUTATE / KILL / REFACTOR** as standard — most value is in the characterization
assertions.

**Done when**: AC met, mutation reviewed, checks clean, human approves commit.

### Slice 4: Canonical `tobi-geri` + `jumpXSpeed` wiring (consolidated)

**Value**: The mechanic becomes **bot-reachable in the benchmark** — an LLM can
author a jump-in aerial ippon, and the spec teaches it. Consolidated per find-gaps
decision 4: `jumpXSpeed` (deferred from Story 1) and `tobi-geri` land together in one
`INPUT_HASH` flip ⇒ one `BENCHMARK_VERSION` bump.

**Path**: `CANONICAL_RULES` gains `jumpXSpeed` and `moves["tobi-geri"]` (`air:true`,
bands `[high, mid]`, `scoreByBand {high:3, mid:2}`, pure scoring — no `knockdown`,
gas-locked `staminaCost > gasThreshold 30`, with reach / startup / active / recovery
tuned as relationship-tested values — jump-in closes distance so reach can be
moderate; startup modest since the ~7-tick arc telegraphs on `L_act`) → the no-Pareto
property test (`rules.test.ts`) treats `air:true` as an **incomparable context**
(mirroring `throw`'s `grab` band) so `tobi-geri` never Pareto-compares with ground
moves → `INPUT_HASH` flips ⇒ `BENCHMARK_VERSION` bump → `npm run gen:spec`
regenerates `docs/spec.md` (teaches the air move + `jumpXSpeed`). `.gitattributes`
already LF-pins `docs/spec.md` + bots.

**Required implementation skills**: `tdd`, `testing`, `mutation-testing`,
`refactoring`.

**Acceptance criteria**: a canonical fight where a jumping bot lands `tobi-geri`
scores 3 (high) / 2 (mid) / whiffs high vs a croucher; the no-Pareto property test
passes with `air` as an incomparable island (and a companion assertion proves a
ground move CANNOT dominate `tobi-geri`); `BENCHMARK_VERSION` bumped + `INPUT_HASH`
updated (drift test green); `docs/spec.md` regenerated and its drift test green.
`npm run fight` output changes (new canonical surface) — this is expected and the one
slice that does.

**RED**: canonical `tobi-geri` scoring by band + crouch-dodge; the no-Pareto island
assertion; the version/hash drift tests; the spec drift test. **GREEN**: the
`CANONICAL_RULES` entries + property-test projection tweak + regen. **MUTATE / KILL /
REFACTOR** on `rules.ts` (target 100%, per the arsenal pattern).

**Done when**: AC met, mutation reviewed, checks clean, human approves commit.

### Slice 5: `rule("moves.tobi-geri.*")` + `rule("jumpXSpeed")` readers (reads-only)

**Value**: Bots can read the air frame data to author smarter air logic — the last
DSL surface for the mechanic. Reads-only ⇒ no scoring-input change ⇒ **no version
bump** (the Batch-1 reads-only pattern).

**Path**: add the `RULE_READERS` leaf entries for `moves.tobi-geri.*` (incl.
`scoreByBand.high` — needs the roundhouse-style inner-`?.` guard test to kill the
Stryker survivor) and `jumpXSpeed`. No `CANONICAL_RULES` / scoring change ⇒
`INPUT_HASH`/`BENCHMARK_VERSION` unchanged.

**Required implementation skills**: `tdd`, `testing`, `mutation-testing`,
`refactoring`.

**Acceptance criteria**: each new `rule(path)` returns the configured value; the
`scoreByBand.high` reader is guarded (inner-`?.`) and mutation-covered;
`INPUT_HASH`/`BENCHMARK_VERSION` unchanged; `dsl.ts` interpreter stays 100%.

**RED**: a bot reading each new path drives its decision to the configured value; the
`scoreByBand.high` guard test. **GREEN**: the `RULE_READERS` entries. **MUTATE / KILL
/ REFACTOR** as standard.

**Done when**: AC met, mutation reviewed, checks clean, human approves commit.

## Pre-PR Quality Gate (every slice)

1. Mutation testing — `mutation-testing` on the changed regions (100% changed-line;
   equivalent mutants documented).
2. Refactoring assessment — `refactoring`.
3. `npm run typecheck` + `npm run lint` clean; `npm test` green.
4. Slices 1–3, 5: confirm `CANONICAL_RULES` / `BENCHMARK_VERSION` UNCHANGED
   (`npm run fight` byte-identical). Slice 4: confirm the version bump + hash + spec
   drift tests are green and the change is intentional.

## Risks / notes

- **Slice 1 is the largest** — the air-attacking state is an irreducible coupled core
  (new state + intake route + two-clock advance + `computeStrike`/`applyStrike`
  integration); a subset is dead code. If it proves too big in TDD, the one clean
  sub-split is **1a: connect + land→neutral** then **1b: landing-lag recovery
  (AC-2.7)**. Flagged, not pre-split.
- **`canAct` stays neutral-only** (`sim.ts:313`); a bot times the air strike off
  `self.posture == 2` (Slice 2), not `canAct`. The intake air-route is what lets an
  airborne fighter act despite `canAct = 0`.
- **§11 spine untouched in spirit** — the only resolution-path change is widening two
  `kind` guards (`computeStrike`, perception) + one throw-immunity `||`; no new
  resolution machinery.

---

_When every slice is merged, **archive** this plan (and the shared air-actions
design records) under `docs/archive/` with a `README.md` entry — **do NOT delete**
(project convention overrides the planning skill's delete footer)._
