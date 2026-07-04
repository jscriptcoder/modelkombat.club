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
     count floor and no victim-identity constraint; the field's availability to _submitted_
     bots is already guaranteed by turning the rule on — the board fire only proves the
     mechanic is reachable on the frozen roster.
     - **passivity (v16) — RELAXED to "EXERCISED" (2026-07-04, MEASURED & user-confirmed).**
       A _decisive_ passivity fire (winner-flip) is **structurally infeasible** on the frozen
       roster: a decisive foul needs a bot idle ~480 ticks (foul ≥2× to confer past the free
       warning) in a bout that stays _close_ — but 480/600 idle ticks lose the bout on points
       anyway (not close ⇒ the foul isn't the decider). The only close+low-scoring bout a foul
       could flip is a MUTUAL standoff, which the all-aggressive roster doesn't produce (its one
       patient bot, the vulture, is too strong to lose the bouts it stalls in). Unlike jogai (a
       ring-out _directly_ hands a point in an already-close bout ⇒ naturally decisive), passivity
       is slow + self-defeating. So passivity's board bar is **EXERCISED**: ∃ a board bout where a
       real gauntlet bot commits **≥2 passivity fouls** (i.e. the ladder actually _confers_ a
       penalty point on the frozen roster — a warn + a conferral, not merely reachable). The
       DECISIVENESS of a conferred passivity point (it awards the opponent +1 and can decide
       scoring) stays proven by the built Capability-B engine unit tests — exactly as move
       _coverage_ proves the board exercises a technique while unit tests prove its scoring.
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
   - **passivity → jabber (field-read carrier); victim → vulture** — MEASUREMENT-REVISED
     (2026-07-04; carrier was `vulture`, victim was TBD). At limit 120 the **jabber is the sole
     staller** (79 fouls vs the spacing zoner; the vulture never stalls — its counters reset its
     own clock), REFUTING the "vulture is the natural staller" premise. But 120 mis-flags the
     jabber's legitimate patient game (decision 5) ⇒ limit revised to **240**, at which the board
     self-calibrates and NO bot naturally fouls. So the roles split: the **jabber carries the
     field-read** (a light `self.passivityRemaining ≤ 10` re-engage that keeps it ∈ band ~31%),
     and the **vulture is SHAPED into the exercised victim** (a standoff-idle rule ⇒ it commits
     ~23 passivity fouls on the board, incl. ≥2-foul bouts that CONFER a penalty point; see
     decision 10). Trigger + read on different bots (decision 3), WKF-faithful.
   - **overtime → jabber (MULTI-READ) — RESOLVED 2026-07-04 by measurement + user.** The jabber
     multi-reads: its existing `self.passivityRemaining ≤ 10` re-engage PLUS a new
     `clock.overtime == 1` all-in rule. Chosen because the board-level "fires + pays off" bar is
     ALREADY met by 7 natural OT bouts (4 flipping winners) with zero bot changes, so the
     field-read is a lighter surface-reachability guard — and the jabber is in only 1 of the 7 OT
     bouts, so the edit touches ~1 bout ⇒ near-zero band risk (measured: all 6 stay ∈ [25,75]),
     leaving grappler/vulture shaping untouched. The read evaluates TRUE on the board (the
     vulture-vs-jabber seed-3 bout enters OT), so it is an exercised read, not an inert one.

   **Read scope — self-side only for the CI guard.** The field-read guard requires only the
   self-side read per carrier (above). The _also-inert_ opponent-side reads
   (`opponent.penalties` live; `opponent.passivityRemaining` L_act-delayed) are **not**
   gauntlet-exercise-required, but the spec primer still NAMES them for parity with senshu
   (decision 11) — they go LIVE for submitted bots the moment the rule is on; the frozen
   gauntlet being inert on them is acceptable (same guarantee the self fields give submitted
   bots). jogai's opponent surface (`opponent.x`) is generic and overtime's `clock.overtime`
   has no opponent variant, so this asymmetry mainly concerns passivity.

5. **Parameters — principled constants, held FIXED; bots do the balancing.**
   - `jogai.margin = 100000` — legal region `[100000, 500000]` in the 600000 ring;
     fighters start centered (~150000/450000), 50000 inside their wall.
   - `passivity.limit = 240` ticks — MEASUREMENT-REVISED (2026-07-04; was `120`). The v16 TDD
     calibration (the "verify against the live economy" hook below) showed `120` mis-flags the
     **jabber's legitimate patient counter-game** vs the spacing zoner (it acts periodically,
     just not within every 120 ticks) — it is NOT a pure staller, yet 120 craters it to 12%
     (out of band), and no bot edit recovers it (its only non-turtle winning matchup does not
     exist). A limit sweep (120/150/180/210/240/300) found `240` self-calibrates the whole board
     (jabber 31 / zoner 35 / all 6 ∈ band, ≈ the v15 balance) while a pure turtle still fouls
     80× — i.e. paced fighters safe, pure stallers flagged (decision 5's OWN stated intent).
     240 = 40% of the 600-tick cap. Still FIXED (bots don't dial it); the param moved once, by
     measurement, then re-froze.
   - `overtime.ticks = 300` — half of `MAX_TICKS`; OT usually ends on the first 1-point
     gap, so the length mainly bounds the rare exhaust-to-senshu fallback.
   - **Rebalance lever if the board exits `[25,75]`:** (1) re-author the carrier bot →
     (2) re-author one coupled bot → (3) _last resort_ revisit the param. The param is
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
    carrier reads _to avoid_ its foul, a _different_ bot must trigger for the board "fires"
    guard to hold. If measurement shows no trigger survives on the frozen board without a
    contrived / out-of-band bot, the escalation is: re-author a **non-carrier** gauntlet
    bot into a plausibly-naive victim that reliably triggers the foul (over-retreats into
    jogai / over-turtles into passivity) while staying in `[25,75]`. We do NOT drop the rule
    to thin or fall back to synthetic-only — the thick "fires on the real board" bar is
    preserved. (Victim-shaping is an additional round-robin perturbation to absorb per
    decision 5's rebalance ladder.)
    - **jogai (v15) — RESOLVED 2026-07-04 by measurement.** With `jogai:{margin:100000}` on the
      frozen v14 roster, the **zoner is the sole ring-out source (47/47 fouls; every other bot 0)**. So the ring-aware zoner alone leaves **zero** fires ⇒ escalation IS required. **Victim
      = sweeper** (67%, the most band headroom to absorb self-inflicted losses; a non-carrier, so
      never re-touched by v16/v17). Refinement the measurement surfaced: the fire must be
      _decisive_ via a **conferred point** — the victim must ring out **≥2×** (the shared ladder's
      1st foul is free) in a **close** bout; ring-outs in lopsided/drawn bouts (as the zoner's
      were) do not satisfy the bar.
    - **passivity (v16) — RESOLVED 2026-07-04 by measurement (multi-step).** (1) At limit 120 the
      **jabber is the sole staller** (79 fouls vs the zoner), refuting "vulture is the natural
      staller." (2) But 120 mis-flags the jabber's legitimate patient game and craters it to 12%
      unrecoverably ⇒ **limit revised to 240** (decision 5), at which the board self-calibrates and
      no bot naturally fouls. (3) **The grappler is a BAD victim** — it's an aggressive close-range
      bot; every opponent engages it within 240 ticks, so it can't accumulate a foul without idling
      so hard its band collapses (and it pushes the vulture out). (4) **The vulture is the natural
      victim** (lowest-offense bot, 73% ⇒ huge downward headroom): a standoff-idle rule makes it
      commit ~23 passivity fouls (incl. ≥2-foul conferring bouts) with the whole board still ∈ band.
      (5) But NO passivity foul is **decisive** on this roster (a 480-tick stall loses the bout on
      points regardless) ⇒ the passivity board bar is **RELAXED to EXERCISED** (decision 3): a real
      bot confers a penalty point on the board; decisiveness stays engine-unit-tested. **Final:
      carrier = jabber (field-read), victim = vulture (exercised, ≥2-foul conferral), limit = 240.**
      The jogai fire (sweeper→vulture) SURVIVES the pooled ladder (≥10 decisive jogai fires).

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
  Caps A/B/C; only the _value_ goes live.
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

- **Reader/trigger circularity.** The carrier reads _to avoid_ its foul, so on the frozen
  board a _different_ bot must actually trigger for the "fires" guard to hold. Must MEASURE
  which frozen bots ring out (jogai) / stall past 120 (passivity) / reach level-at-cap
  (overtime) once the carriers avoid — and ensure at least one trigger survives.
  - **jogai: MEASURED & resolved (2026-07-04)** — zoner sole ring-out source ⇒ victim = sweeper.
  - **passivity: MEASURED & resolved (2026-07-04)** — jabber sole staller (vs zoner) ⇒ carrier =
    jabber (reads-to-avoid), victim = vulture (shaped standoff-idle). See decision 10.
  - **overtime: MEASURED & resolved (2026-07-04)** — the frozen board yields 7 natural OT bouts
    with NO bot change, so no victim/trigger shaping is needed (the carrier does not "read to
    avoid" — it reads to go all-in, and the OT bouts arise from other bots reaching level at cap).
    See the overtime-fires precondition risk below.
- **`passivity.limit` calibration — MEASURED & REVISED to 240 ✓ (2026-07-04).** `120` mis-flags
  the jabber's legitimate patient counter-game (not a pure staller) ⇒ 12%, unrecoverable by bot
  edits. A limit sweep found **240** self-calibrates the board (jabber 31 / zoner 35 / all 6 ∈
  band) while a pure turtle still fouls 80× — decision 5's own "paced safe, stallers flagged"
  intent. Param moved once by measurement, then re-froze. See decision 5 (revised).
- **Per-PR board re-characterization.** Each adoption shifts the round-robin (resets perturb
  trajectories; penalties/OT re-decide bouts). Expect to re-author the carrier (± one coupled
  bot) to keep all 6 ∈ `[25,75]`, per the gauntlet-modernization findings (band = dispersion;
  the coupled round-robin can't be precision-dialed).
- **Pooled-ladder coupling (v16) — MEASURED ✓ (2026-07-04).** passivity feeds the SAME
  `penaltyCount` as jogai, so a bot's jogai + passivity fouls compose. Confirmed the v15 jogai fire
  (sweeper→vulture) SURVIVES the pooled ladder: 10 decisive jogai fires with passivity on. (Still
  re-verify after the carrier/victim edits, which perturb the board.)
- **overtime re-decides Cap D's senshu bouts — MEASURED ✓ (2026-07-04).** Adopting overtime
  routes the 7 level bouts through sudden death first. **4 flip the winner** — all 4 are
  grappler↔vulture, shifting from grappler (senshu first-blood) to vulture (OT winner). Board
  impact: grappler .56→.52, vulture .35→.39; **all 6 stay ∈ [25,75]** ⇒ no coupled rebalance.
- **overtime-fires precondition (v17) — MEASURED & RESOLVED ✓ (2026-07-04).** The v16 board has
  **7 level-at-cap bouts** (grappler↔vulture ×4, grappler↔rekka ×2, vulture↔jabber ×1), all
  currently senshu-resolved. With `overtime:{ticks:300}` on, **all 7 resolve via
  `endReason:"overtime"`** (a 1-point gap opens in sudden death every time; none exhaust to the
  senshu/draw fallback) ⇒ the "fires" guard is met with margin 7, NO board-shaping / victim
  required (decision 10's overtime escalation is moot). Overtime is inherently DECISIVE (unlike
  passivity — 4 of the 7 even flip the winner vs senshu) ⇒ NO "exercised" relaxation needed;
  the `endReason:"overtime"` "fires" bar (decision 3) is met cleanly.
