# Item 3 — jogai / passivity / overtime benchmark + spec adoption — resolved decisions

_Grill output (2026-07-04). Feeds `planning` → TDD, PR per capability. Not a plan yet._

Wire the already-built §7 officiating mechanics (Capabilities A jogai / B passivity /
C2 overtime) into the LLM benchmark `MATCH` config and teach their prose in
`generateSpec` / `docs/spec.md`. The mechanics exist in `sim.ts` + `FightConfig.match`;
their perception fields (`self`/`opponent.penalties`, `.passivityRemaining`,
`clock.overtime`) are already whitelisted DSL surface but read sentinel `0` all match
because the benchmark configures none of them. **This item makes them live.**

Template precedent: **Capability D** (PRs #113–#114) adopted `senshu` the same way —
flip a `MATCH` flag, re-pin `INPUT_HASH` + `BENCHMARK_VERSION`, teach `gen:spec` prose,
re-characterize the gauntlet doc.

## Resolved decisions

1. **Slicing — one PR per capability.** Three separate slices: jogai → passivity →
   overtime. Each is its own PR with its own `INPUT_HASH` flip + `BENCHMARK_VERSION`
   bump (v14 → v15 → v16 → v17), dogfood re-pin, and a new `docs/benchmark-gauntlet-vN.md`
   re-characterization. Mirrors PR-per-capability + the Cap D senshu precedent.

2. **Meaningfulness bar — THICK (wire + exercise).** Each PR does the thin work (turn the
   rule on in `MATCH`, regenerate spec prose, re-characterize) **AND** re-authors a
   gauntlet bot so the mechanic actually fires and pays off on the frozen board — a
   coverage-style bar analogous to the 11/11 move-coverage lock. Re-opens gauntlet
   authoring per capability. Rationale: the deferral reason was "fields that read 0 all
   match"; thin-only would leave the read side inert.

3. **"Exercised" = FIRES + FIELD-READ**, both CI-locked in
   `src/cli/gauntlet-calibration.test.ts` (alongside the existing `[25,75]` band guard):
   - **fires** — **≥1 decisive fire** is the bar (the board is seeded/deterministic, so one
     fire is a stable, reproducible proof-of-life — not a flaky threshold): ∃ a board bout
     whose outcome is decided by this rule's cause — `fouls.x.<cause> ≥ 1` conferring the
     deciding point (jogai/passivity, see decision 6), or `endReason === "overtime"`. No
     count floor and no victim-identity constraint; the field's availability to *submitted*
     bots is already guaranteed by turning the rule on — the board fire only proves the
     mechanic is reachable on the frozen roster.
   - **field-read** — a gauntlet bot references the newly-meaningful surface, asserted by
     walking the bot's **condition AST** (the analog of the existing `movesReferencedBy`
     action-AST walk):
     - _passivity / overtime_ — the carrier's conditions reference the **dedicated path**
       (`self.passivityRemaining` / `clock.overtime`). Direct move-key-coverage analog.
     - _jogai_ — no dedicated field, so assert the zoner's conditions contain a **`self.x`
       comparison against a constant in the near-edge zone** (within a defined band `δ` of
       `margin` / `width − margin`), proving a boundary decision, NOT generic mid-ring
       spacing. A bare `self.x` reference is explicitly insufficient.
   - Trigger and read may live on **different bots** (WKF-faithful: a skilled bot
     reads-and-avoids the foul; a naive one eats it).

4. **Carriers (the field-reader per mechanic), spread across three bots:**
   - **jogai → zoner** — becomes ring-aware: reads `self.x`, zones without walling
     itself past the margin. (jogai has no dedicated field; the read is `self.x`-vs-edge.)
   - **passivity → vulture** — the pure reactive defender is the natural staller; reads
     `self.passivityRemaining` to force a re-engage before the foul.
   - **overtime → jabber** — reads `clock.overtime` to go all-in in sudden death.

   **Read scope — self-side only for the CI guard.** The field-read guard requires only the
   self-side read per carrier (above). The *also-inert* opponent-side reads
   (`opponent.penalties` live; `opponent.passivityRemaining` L_act-delayed) are **not**
   gauntlet-exercise-required, but the spec primer still NAMES them for parity with senshu
   (decision 11) — they go LIVE for submitted bots the moment the rule is on; the frozen
   gauntlet being inert on them is acceptable (same guarantee the self fields give submitted
   bots). jogai's opponent surface (`opponent.x`) is generic and overtime's `clock.overtime`
   has no opponent variant, so this asymmetry mainly concerns passivity.

5. **Parameters — principled constants, held FIXED; bots do the balancing.**
   - `jogai.margin = 100000` — legal region `[100000, 500000]` in the 600000 ring;
     fighters start centered (~150000/450000), 50000 inside their wall.
   - `passivity.limit = 120` ticks — paced fighters safe, pure stallers flagged
     (verify against the live economy in TDD).
   - `overtime.ticks = 300` — half of `MAX_TICKS`; OT usually ends on the first 1-point
     gap, so the length mainly bounds the rare exhaust-to-senshu fallback.
   - **Rebalance lever if the board exits `[25,75]`:** (1) re-author the carrier bot →
     (2) re-author one coupled bot → (3) *last resort* revisit the param. The param is
     NOT the primary balance knob (unlike the C10 `knockdownDuration` de-wall).

6. **"Fires" observable — expose a per-CAUSE foul tally on `FightResult`.** Add an additive
   `FightResult.fouls: { a: { jogai, passivity }, b: { jogai, passivity } }`, recorded at the
   two distinct `applyPenalty` call sites (surfaced from the existing per-fighter
   `penaltyCount`; pure telemetry ⇒ **byte-identical outcomes**, the S8 `degrade`-telemetry
   precedent). Lands in the **jogai PR** (first; the `passivity` sub-counter stays `0` until
   v16). Each PR's "fires" guard asserts **its own cause** incremented AND that the conferred
   point decided a bout — self-contained, no cross-version baseline. Overtime's "fires" is
   already clean via `endReason: "overtime"` (no fouls entry needed).
   _Scope note: this is a small ENGINE change, slightly beyond pure benchmark+spec wiring._
   _Why per-cause: jogai + passivity POOL into one `penaltyCount` ladder (WKF-faithful — 1st
   free, 2+ confers), so a flat tally couldn't distinguish a passivity foul from a jogai one._
   _Bump policy: the `fouls` field alone is byte-identical telemetry ⇒ it would NOT force a
   version bump on its own; it rides the jogai PR's `MATCH` bump (v14 → v15)._

7. **Report surface — ranking untouched; add a breakdown line.** Keep the metric exactly
   as-is (win-rate primary / net-points tiebreak; the fouls tally is telemetry + CI only).
   The CLI benchmark report gains a per-bout `endReason` / foul-count breakdown so a human
   sees officiating firing. No ranking-semantics change. (Cap D deferred endReason
   surfacing; this is the minimal informative step past that.)

8. **PR order — jogai → passivity → overtime** (DESIGN §7a: passivity shares jogai's
   penalty ladder; tie-resolution last).

9. **Overtime × senshu — keep `senshu: true` on; OT-first.** `MATCH` accretes:
   `{ winGap:8, senshu:true }` → `+ jogai:{margin:100000}` → `+ passivity:{limit:120}` →
   `+ overtime:{ticks:300}`. Overtime is tried before senshu's terminal override; senshu
   is the exhaust-still-level fallback (the built C2 model, unchanged). The spec
   win-condition prose extends to the full cascade: `winGap → overtime → senshu → draw`.

10. **"Fires"-unsatisfiable fallback — author a deliberate victim bot.** Because the
    carrier reads *to avoid* its foul, a *different* bot must trigger for the board "fires"
    guard to hold. If measurement shows no trigger survives on the frozen board without a
    contrived / out-of-band bot, the escalation is: re-author a **non-carrier** gauntlet
    bot into a plausibly-naive victim that reliably triggers the foul (over-retreats into
    jogai / over-turtles into passivity) while staying in `[25,75]`. We do NOT drop the rule
    to thin or fall back to synthetic-only — the thick "fires on the real board" bar is
    preserved. (Victim-shaping is an additional round-robin perturbation to absorb per
    decision 5's rebalance ladder.)

11. **Spec-prose deliverable per PR — full parity with the senshu adoption.** Each rule
    gets BOTH, all gated on its `MATCH` sub-key (taught == scored):
    - a **`benchmarkSection` rule bullet** — the mechanic + consequence (jogai: ring-out ⇒
      yame-style reset + shared-ladder penalty; passivity: non-engagement clock ⇒ reset +
      shared-ladder penalty; overtime: the `winGap → overtime → senshu → draw` cascade).
    - a **primer "play the match" clause** naming the now-live field(s) + the actionable
      strategy (avoid ringing out via `self.x` vs. the edge; don't stall — watch
      `self.passivityRemaining`; go all-in when `clock.overtime`).
    Mirrors the senshu win-condition prose + primer clause exactly. `docs/spec.md`
    regenerated per PR via `gen:spec`.

## Non-goals

- **Rounds** (roadmap item 4) — the last unbuilt §7 piece; stays deferred.
- **No `Rules` / `CANONICAL_RULES` change** — `match` is scoring-only ⇒ `npm run fight`
  byte-identical throughout.
- **No new DSL / TCB surface** — every officiating perception field already shipped in
  Caps A/B/C; only the *value* goes live.
- **Dogfood character bot** left behaviorally as-is (re-pin its W/L record per version).
- **No officiating-aware ranking metric** (rejected option C in decision 7).

## Definition of done (item 3)

Item 3 is COMPLETE when:
- All three PRs are merged: jogai (v15), passivity (v16), overtime (v17).
- The `docs/STATUS.md` "deferred jogai / passivity / overtime benchmark + spec adoption"
  entry (roadmap item 3) is closed.
- This decisions doc is archived under `docs/archive/` (per the archive-plans-not-delete
  policy) with a `README.md` index entry.
- `plans/` is empty again.

## Open risks to resolve in planning / TDD

- **Reader/trigger circularity.** The carrier reads *to avoid* its foul, so on the frozen
  board a *different* bot must actually trigger for the "fires" guard to hold. Must MEASURE
  which frozen bots ring out (jogai) / stall past 120 (passivity) / reach level-at-cap
  (overtime) once the carriers avoid — and ensure at least one trigger survives.
- **`passivity.limit = 120` calibration.** Confirm a paced poker (regen 10/tick, move costs
  15–52) is never flagged while a genuine staller is — empirically, in the jogai/passivity PR.
- **Per-PR board re-characterization.** Each adoption shifts the round-robin (resets perturb
  trajectories; penalties/OT re-decide bouts). Expect to re-author the carrier (± one coupled
  bot) to keep all 6 ∈ `[25,75]`, per the gauntlet-modernization findings (band = dispersion;
  the coupled round-robin can't be precision-dialed).
- **Pooled-ladder coupling (v16).** passivity feeds the SAME `penaltyCount` as jogai, so in
  v16 a bot's jogai + passivity fouls compose: one already-eaten (free) jogai foul makes the
  next passivity foul confer a point. The v16 re-characterization must re-verify the v15 jogai
  fires under the pooled ladder — a jogai fire in isolation may tip differently once passivity
  fouls share the count.
- **overtime re-decides Cap D's senshu bouts.** The v14 board reports 0 draws (senshu
  resolved them); adopting overtime routes those level-at-cap bouts through sudden death
  first, which may flip winners.
- **overtime-fires precondition (v17).** Overtime can only fire if ≥1 **level-at-regulation-cap**
  bout exists in the v16 board (post jogai + passivity). The v14 board had senshu-resolved
  level bouts, but the shifted v16 board must be **re-checked** — if none survive, the v17 PR
  must shape the board (per decision 10's victim/carrier levers) to produce one.
