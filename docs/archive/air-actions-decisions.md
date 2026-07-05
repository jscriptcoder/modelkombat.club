# Air-actions capability — resolved design decisions (grill-me, 2026-07-05)

The last combat capability before the platform layer. Adds **horizontal jump
displacement + air strikes** to the built vertical jump arc, plus the canonical
**`tobi-geri`** (Batch-2 air move) and a gauntlet rebalance. Feeds
`story-splitting` → `planning` → TDD, PR per slice.

Groundwork already in place (C4): the vertical jump arc (`jumpImpulse 12000` /
`gravity 4000` / `lowClearance 8000` in `CANONICAL_RULES`), the committed
`airborne` state (`{ kind:"airborne"; vy }`, `canAct=0`), the `posture→vacated-band`
occupancy table (airborne vacates `low`), and the `opponent.y` (`L_pos`) /
`opponent.posture` (`L_act`, 0/1/2) reads. Today a jump is **purely defensive** —
no offense, no horizontal travel — and `self.y`/`self.vy`/`self.posture` don't
exist.

## Scope (decided)

**Full air-actions capability, displacement first** — mechanic + canonical
`tobi-geri` + benchmark adoption + gauntlet rebalance, in one capability across
these slices:

- **S1 — horizontal jump displacement** (engine + fixtures, benchmark-neutral)
- **S2 — air-strike mechanic** (engine + fixtures, benchmark-neutral)
- **S3 — air perception** (`self.y`/`self.vy`/`self.posture`; engine + fixtures)
- **S4 — canonical wiring** (`jumpXSpeed` + `tobi-geri` into `CANONICAL_RULES`
  together ⇒ **one** `BENCHMARK_VERSION` bump + `spec.md` regen; + reads-only
  `rule("moves.tobi-geri.*")` readers as a no-bump sub-slice, per the Batch-1
  pattern)
- **S5 — gauntlet rebalance** (rekka carries `tobi-geri`) + calibration-lock update

Slicing keeps the **mechanic slices (S1–S3) fixture-proven and
benchmark-neutral** (no `CANONICAL_RULES` change ⇒ no `INPUT_HASH` flip ⇒
byte-identical `npm run fight`), consolidating **all** canonical/benchmark surface
into S4 (one version bump) + S5 (rebalance) — mirroring the C9/C10
"mechanic-first, canonical wiring as a promoted unit" pattern.

## S1 — Horizontal jump displacement

- **Velocity model:** constant horizontal velocity, **locked at launch**.
  `vx = jumpXSpeed × dir × facing`, captured at launch and stored on the airborne
  state (`{ kind:"airborne"; vy; vx }`), applied unchanged every airborne tick via
  `x = clamp(x + vx, 0, ring.width)`. No air control (the fighter issues no
  steering mid-air — preserves jump commitment), no air friction/decay. `dir`
  semantics unchanged (+1 toward foe, −1 away, 0 = pure vertical = today's
  behavior).
- **New `Rules.jumpXSpeed?: number`** — absent ⇒ 0 ⇒ vertical-only ⇒
  byte-identical to the current engine. Wired into `CANONICAL_RULES` in **S4**
  (not S1), so S1 is fixture-proven and benchmark-neutral.
- **Jogai:** **no special-casing** (emergent). Jogai reads `x` per tick regardless
  of how the fighter got there, so a forward jump arcing into the out-zone triggers
  a ring-out foul (and its `resetToNeutral` drops the fighter to grounded neutral,
  interrupting the arc). Authentic to WKF (jumping out of bounds IS jogai),
  height-agnostic, zero new code. The bot avoids it by reading `self.x` before a
  forward jump. (Jogai is benchmark/match-mode only, not in `CANONICAL_RULES`.)

## S2 — Air-strike mechanic

- **Initiation:** reuse the `{ type:"attack"; move; band }` family — **no new
  action type, TCB untouched**. A new **`MoveSpec.air?: boolean`** (pure data)
  marks a move air-only. Routing by state + flag (air moves and ground moves are
  **disjoint sets** — the move id already discriminates): air move while airborne ⇒
  air-attack; air move while grounded (or ground move while airborne, or any
  non-attack while airborne) ⇒ **degrade to idle** (fighter stays committed to the
  arc), mirroring how `bands`/affordability already gate.
- **State composition:** a dedicated **air-attacking** state carrying `vy`, `vx`,
  the move `spec`, and `elapsed` — integrates the arc AND ticks move frames each
  tick. Keeps the grounded `attacking` state untouched (no arsenal regression risk).
- **Timing — landing is master.** The move contributes **startup + active** as its
  connect window (elapsed-based, resolved by `computeStrike` exactly like a ground
  strike). **Landing (`y ≤ 0`) is terminal:** transition to a grounded recovery,
  then neutral. If startup outlasts the airtime, active never happens ⇒ pure whiff.
- **Landing lag = the move's own `recovery`** (+ the C10 gas `extra`, composing
  exactly like a ground strike) — no new Rules knob; a heavier air move lands with
  a longer punish window. The airborne tail between active-end and landing is
  "committed, falling" — hittable by mid/high anti-air.
- **Reach — horizontal-only** (consistent with the whole engine). Connect iff
  `|x_a − x_b| ≤ reach` AND the defender occupies/fails-to-guard the attacked band.
  `y` is **never** a reach axis. Height stays modeled by bands + occupancy — a high
  air strike is an **emergent overhead** (only a high guard stops it; but note
  crouch vacates high ⇒ a high air strike whiffs a croucher — see tobi-geri
  identity).
- **Anti-air — trade; cleanliness via timing** (more realistic + spine preserved).
  Air-strike vs grounded-strike is a normal **trade** (both score, swap-symmetric,
  §11 spine untouched). A **clean stuff is earned by timing** — hit the jumper
  while it's still in startup (active window not yet open) and only your strike
  connects; both active the same tick = trade (_aiuchi_). No asymmetric
  strike-vs-strike precedence added. Anti-air early = clean; anti-air late = trade.
- **Throws can't grab an air-attacking fighter** — extend the existing airborne
  throw-immunity (`def.state.kind === "airborne"`) to the air-attacking state.
- **Air strikes are OUT of the C6 cancel web** — no `cancelInto` on air moves, air
  strikes open no cancel window, no ground move cancels into an air move. Keeps
  "one air action per jump / landing is master" clean. (Separate: knockdown →
  `finishWindow` → okizeme still composes for free if an air move sets
  `MoveSpec.knockdown` — but `tobi-geri` doesn't; see below.)
- **Window:** **anytime airborne (post-launch), exactly one air strike per jump.**
  The launch tick is consumed by the jump; earliest air strike is the tick after.
  Once committed, the fighter rides to landing. Timing IS the skill (strike too
  early ⇒ active at altitude ⇒ likely whiff; well-timed ⇒ active overlaps the
  descending approach). `canAct` + `self.posture` disambiguate "can still
  air-strike" vs "committed"; a second attempt degrades to idle.

## S3 — Air perception

- **Three new live self-reads:** `self.y` (height), `self.vy` (vertical velocity —
  sign = rising/falling), `self.posture` (0 standing / 1 crouching / 2 airborne,
  mirroring `opponent.posture`). Live (zero delay), mirroring the existing
  `opponent.y`/`posture`/`vx`. Three new static `FIELD_READERS` (value config-gated
  ⇒ `dsl.ts` interpreter stays 100%). Matches the DESIGN §P6 sketch.
- **No new opponent fields** — the incoming air-strike tell composes for free from
  existing `opponent.posture == airborne` + `opponent.attacking` +
  `opponent.attackBand`. Implementation must ensure the **air-attacking state feeds
  the existing `attacking`/`attackBand` perception** (like grounded `attacking`
  does).

## S4 — Canonical `tobi-geri` + wiring

- **Identity:** bands **`[high, mid]`**, **`scoreByBand { high: 3, mid: 2 }`** — the
  airborne jodan-kick with a real read: aim high for the **ippon (3)** but risk a
  crouch-dodge (crouch vacates high), or aim mid for the safe **waza-ari (2)** that
  can't be ducked (both standing + crouching occupy mid). Mirrors
  `mawashi-geri`/`ushiro-geri`'s jodan-ippon/chudan-waza-ari, but as the only
  airborne technique.
- **Pure scoring, NO knockdown** — keeps the roster's score-vs-knockdown separation
  (knockdown moves score 0 and rely on okizeme); avoids a score-3-AND-okizeme
  monster. Its risk/reward is self-contained: reward = the ippon, risk = the
  telegraphed committed jump + landing lag.
- **`air: true`, gas-locked (special class,** `staminaCost > gasThreshold 30` — the
  most athletic technique). Exact **reach / startup / active / recovery / cost** are
  TBD in planning/TDD as relationship-tested tuning (the jump-in closes distance via
  `jumpXSpeed`, so the move's own reach can be moderate; startup can be modest since
  the ~7-tick jump arc already telegraphs the strike on `L_act`).
- **No-Pareto law — air moves are an incomparable island.** `tobi-geri` (modest
  reach, jodan-ippon) would be Pareto-dominated by `ushiro-geri` (reach 330k, same
  jodan-ippon) on the 7-axis property test. Fix mirrors `throw`'s incomparable
  `grab` band: **`air: true` becomes an incomparable context** in the property
  test's projection, so air moves never Pareto-compare with ground moves (they're
  genuinely non-substitutable — no jump, no air move). `tobi-geri` then only needs
  distinctness from other air moves (none yet ⇒ trivially satisfied).
- **`jumpXSpeed` + `tobi-geri` wired into `CANONICAL_RULES` together** ⇒ one
  `INPUT_HASH` flip ⇒ one `BENCHMARK_VERSION` bump; `spec.md` regenerated. Plus a
  **reads-only** `rule("moves.tobi-geri.*")` readers sub-slice (incl.
  `scoreByBand.high`, needing the roundhouse-style inner-`?.` guard test) — no
  version bump (Batch-1 pattern).

## S5 — Gauntlet rebalance

- **rekka carries `tobi-geri`** — the aggressive pressure bot gains a jump-in
  approach angle (punish a spacing/retreating foe). Not overloaded with officiating
  reads (unlike jabber); air strikes are out of the cancel web ⇒ a distinct tool
  from rekka's ground cancel game.
- **Exact firing gate (broad vs narrow) is empirical** — per the S2/S3
  gauntlet-modernization lesson, a committal telegraphed move often has "no healthy
  niche" and needs narrow-gating to avoid wrecking the coupled round-robin. Tune in
  the rebalance slice to keep all 6 bots ∈ `[25%, 75%]`.
- **Calibration lock update:** the coverage guard must see `tobi-geri` **exercised**
  (referenced + reachable, ideally really firing per the S3 "full real integration"
  bar); the band guard must stay green. Add `docs/benchmark-gauntlet-v<next>.md`.

## Invariants preserved

- **Determinism / fixed-point:** `vx` in sub-units/tick (integer), constant per
  arc; all air math integer. Swap-symmetric resolution (air-strike trade inherits
  the symmetric strike∥strike rule).
- **Absent-config byte-identical:** `jumpXSpeed` absent ⇒ 0 ⇒ vertical-only; no
  `air` move configured ⇒ no air strikes; `self.y`/`vy`/`posture` read sentinels
  when no arc. Mechanic slices S1–S3 are byte-identical to the current engine.
- **TCB unchanged for the mechanic:** air strikes reuse the `attack` action (no new
  DSL op); `MoveSpec.air` is pure data. Only new DSL surface is the three static
  `self.*` `FIELD_READERS` (S3) + the `rule("moves.tobi-geri.*")` readers (S4) —
  value config-gated, interpreter stays 100%.
- **§11 spine untouched:** no new resolution machinery; air strikes ride
  `computeStrike`/`applyStrike` (active-window + band + reach + precedence), the
  air-attacking state simply registers as an active striker.
