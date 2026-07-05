// ============================================================================
// The CANONICAL frame table — the authoritative `Rules` the platform fights on.
// Engine-level single source of truth (the runner, and the future API / viewer,
// all consume this); it supersedes the provisional `src/cli/demo-rules.ts`.
//
// Every number here is PROVEN by a behavioral `runFight` test in `rules.test.ts`:
// the suite asserts the design relationships (the master inequalities + WKF
// scoring), not the literals in isolation — so the table is "balanced" in the
// structural sense (it satisfies the deep-karate read game), not the
// telemetry-tuned sense (that needs a mass-matchup harness — a later capability).
//
// Built additively, one capability slice at a time (mirroring the engine's C1–C8):
//   • Slice 2 (here): the strike read-game core — movement, the one strike, and the
//     reaction-viable perception layer. `lAct` and `strike.reach` are LOCKED here;
//     later slices respect them (every committed startup ≥ lAct+1; the reach
//     hierarchy throw < sweep < strike is filled in additively).
//   • Slices 3–5 (later): strike defenses (parry/counter/cancel windows), the throw
//     triangle, and the sweep + okizeme + air physics — each adds optional fields.
//
// Units: integer sub-units, SCALE = 1000 sub-units / world unit. The ring is 600
// units wide; fighters start 300 units apart; a strike reaches 240 units (so the
// pair starts OUT of range and must close ~60 units to threaten).
// ============================================================================
import type { Rules } from "./types.js";

export const CANONICAL_RULES: Rules = {
  tickRate: 60,
  walkSpeed: 4000, // 4 units/tick — closing the 60-unit neutral gap takes ~15 ticks
  ring: { width: 600000 }, // 600 units
  startGap: 300000, // 300 units apart; startGap > strike.reach ⇒ must close to hit
  moves: {
    // The sweep (C8 ashi-barai) — a LOW-band knockdown strike, on the canonical startup-7 timing:
    //   • score 0 + knockdown ⇒ a clean low hit DOWNS the foe (the points live in the okizeme
    //     finish, not the sweep itself). Blockable / parryable at `low`; whiffs a jumper.
    //   • startup 7 = lAct (6) + 1 ⇒ a committed move stays reactable (a low guard / jump answers it).
    //   • recovery 13 ≥ lAct (6) + jab.startup (7) ⇒ a whiffed sweep is punishable.
    //   • reach 180000 ⇒ throw (120000) < sweep < jab (210000) — the close-to-far hierarchy.
    //   • cancelInto:["gyaku-zuki"] ⇒ the knockdown is a connect that opens the cancel window, so a
    //     hit-confirm cancels into the finishing reverse punch (see finishWindow below).
    sweep: {
      startup: 7,
      active: 2,
      recovery: 13,
      score: 0,
      reach: 180000,
      knockdown: true,
      cancelInto: ["gyaku-zuki"], // the C9 reverse-punch okizeme finisher (was the retired `strike`)
      staminaCost: 40, // special move cost (C10) — twice the basic punch
    },
    // ── The C9 "real karate" arsenal (§P7): four named WKF techniques replacing the abstract
    // `strike` (retired in S7.3). Reach hierarchy throw(120k) < sweep(180k) < jab(210k) <
    // reverse(240k) < front(270k) < roundhouse(300k); every committed startup ≥ lAct(6)+1
    // (reactable) and recovery ≥ lAct + jab.startup (whiff-punishable). Punches are basic-cost
    // (≤ gasThreshold 30 ⇒ still commit when gassed); kicks are special (> 30 ⇒ lock out when
    // gassed — the emergent special-lockout). Cancel web: jab→reverse→{front|roundhouse},
    // kick→reverse; the sweep→reverse finisher is above.
    "kizami-zuki": {
      // jab — fastest, shortest, cheapest; the high·mid opener (yuko).
      startup: 7, // = lAct + 1 ⇒ reactable, but only just
      active: 2,
      recovery: 13, // = lAct + jab.startup ⇒ whiff-punishable, but only just
      score: 1,
      reach: 210000, // > sweep (180k), < reverse (240k)
      bands: ["high", "mid"],
      staminaCost: 15, // basic (≤ gasThreshold 30); the cheapest commit
      cancelInto: ["gyaku-zuki"],
    },
    "gyaku-zuki": {
      // reverse punch — the workhorse: longer reach, slightly more committed than the jab (yuko).
      startup: 7,
      active: 3,
      recovery: 14,
      score: 1,
      reach: 240000, // the locked old-strike anchor
      bands: ["high", "mid"],
      staminaCost: 20, // basic (≤ gasThreshold 30)
      cancelInto: ["mae-geri", "mawashi-geri", "yoko-geri", "ushiro-geri"], // escalate the punch into any kick
    },
    "mae-geri": {
      // front kick — chudan-only (mid) for waza-ari (2); deeper than the punches, slower, special.
      startup: 9, // slower wind-up than the punches (more telegraphed)
      active: 3,
      recovery: 16, // ≥ lAct + jab.startup ⇒ whiff-punishable
      score: 2,
      reach: 270000, // > reverse (240k), < roundhouse (300k)
      bands: ["mid"], // jodan/gedan front kicks are not WKF-scored ⇒ out-of-band degrades to idle
      staminaCost: 35, // special (> gasThreshold 30) ⇒ locks out when gassed
      cancelInto: ["gyaku-zuki"], // a punch can follow the kick
    },
    "mawashi-geri": {
      // roundhouse — the risk/reward apex: longest reach, slowest, costliest. Jodan 3 / chudan 2.
      startup: 11, // slowest wind-up ⇒ most reactable, balancing the ippon reward
      active: 3,
      recovery: 18, // ≥ lAct + jab.startup ⇒ whiff-punishable
      score: 2, // chudan fallback (waza-ari)
      scoreByBand: { high: 3 }, // jodan ⇒ ippon
      reach: 300000, // the longest in the arsenal
      bands: ["high", "mid"],
      staminaCost: 45, // special (> gasThreshold 30), the costliest ⇒ locks out when gassed
      cancelInto: ["gyaku-zuki"], // a punch can follow the kick
    },
    // ── Batch-1 expansion #1 (backfist / §move-roster). The cheapest, shortest, high-only 1-point
    // snap — gas-proof pressure + a rekka opener. It PAYS for the cheapest cost with a jodan-only
    // band and the shortest hand reach (the trade-off budget / no-Pareto-dominance law):
    //   • staminaCost 12 < jab (15) ⇒ the cheapest commit; 12 ≤ gasThreshold (30) ⇒ gas-proof
    //     (a gassed fighter keeps it). Score-1 basic per "stamina tier mirrors score tier".
    //   • bands ["high"] ⇒ jodan-only (whiffs a croucher) — the first high-ONLY technique.
    //   • reach 200000 < jab (210000) ⇒ the shortest hand strike.
    //   • startup 7 = lAct+1 / recovery 13 = lAct + jab.startup ⇒ the reactable + whiff-punishable floor.
    //   • cancelInto gyaku-zuki ⇒ the cheap rekka opener (hand → reverse, the category policy).
    uraken: {
      startup: 7,
      active: 2,
      recovery: 13,
      score: 1,
      reach: 200000,
      bands: ["high"],
      staminaCost: 12,
      cancelInto: ["gyaku-zuki"],
    },
    // shuto (knife-hand, Batch-1 expansion #2): the LONGEST-reach hand — it out-ranges the
    // reverse, the trade-off budget / no-Pareto-dominance law made concrete:
    //   • reach 260000 > gyaku-zuki (240000) ⇒ a 1-point hand reaching PAST the 2-point reverse
    //     (and past the jab 210000) — its signature. Pays with score 1 (< reverse 2), cost 22
    //     (> reverse 20), startup 8 (> reverse 7): dominance-free vs both existing hands.
    //   • bands ["high","mid"] ⇒ the conventional chudan/jodan gate (whiffs a low attack).
    //   • staminaCost 22 ≤ gasThreshold (30) ⇒ gas-proof, the priciest basic hand (> jab 15,
    //     > backfist 12). Score-1 basic per "stamina tier mirrors score tier".
    //   • startup 8 ≥ lAct+1 / recovery 15 ≥ lAct + jab.startup ⇒ the reactable + punishable floor.
    //   • cancelInto gyaku-zuki ⇒ the rekka opener (hand → reverse, the category policy).
    shuto: {
      startup: 8,
      active: 2,
      recovery: 15,
      score: 1,
      reach: 260000,
      bands: ["high", "mid"],
      staminaCost: 22,
      cancelInto: ["gyaku-zuki"],
    },
    // yoko-geri (side kick, Batch-1 expansion #3): the beyond-neutral zoning thrust — the
    // longest reach in the game, the trade-off budget / no-Pareto-dominance law made concrete:
    //   • reach 315000 > mawashi-geri (300000) AND > startGap (300000) ⇒ it connects at a gap
    //     where EVERY existing move — even the roundhouse — whiffs. Its signature. Pays with the
    //     slowest-but-one startup (12 > roundhouse 11), the longest-but-one recovery (20 > 18),
    //     the highest cost (48 > 45), a single mid band, and no ippon (score 2, no scoreByBand):
    //     dominance-free vs the roundhouse on five axes.
    //   • bands ["mid"] ⇒ chudan-only (whiffs high and low) — a spacing thrust, not a head kick.
    //   • staminaCost 48 > gasThreshold (30) ⇒ special/gas-LOCKED (a gassed fighter loses it) —
    //     the mirror image of the gas-proof hands, per "stamina tier mirrors score tier".
    //   • startup 12 ≥ lAct+1 / recovery 20 ≥ lAct + jab.startup ⇒ the reactable + punishable floor.
    //   • cancelInto gyaku-zuki ⇒ the kick → reverse finisher (situational: the 240k reverse only
    //     reaches when the kick landed within its reach). It is ALSO a cancel target — the reverse
    //     grows to cancel into it ("reverse → any kick", above).
    "yoko-geri": {
      startup: 12,
      active: 3,
      recovery: 20,
      score: 2,
      reach: 315000,
      bands: ["mid"],
      staminaCost: 48,
      cancelInto: ["gyaku-zuki"],
    },
    // ushiro-geri (back kick, Batch-1 expansion #4): the reach APEX and highest-commitment kick —
    // the trade-off budget / no-Pareto-dominance law at its extreme:
    //   • reach 330000 > yoko-geri (315000) ⇒ now the single LONGEST technique in the game (and
    //     > startGap 300000 ⇒ another beyond-neutral thrust). Its signature. Pays with the slowest
    //     startup (13 > everything), the longest recovery (22 > everything), and the highest cost
    //     (52 > everything) — the turn-away back kick is the most telegraphed, punishable commit.
    //   • scoreByBand { high: 3 } ⇒ jodan ippon / chudan waza-ari (2), mirroring the roundhouse —
    //     the expansion's FIRST jodan-scoring kick. It reaches past the side kick AND carries the
    //     ippon bonus; that dual upside is priced by the tempo/cost floor above (dominance-free vs
    //     both yoko-geri and mawashi-geri).
    //   • bands ["high","mid"] ⇒ conventional jodan/chudan gate (whiffs only low).
    //   • staminaCost 52 > gasThreshold (30) ⇒ special/gas-LOCKED, the priciest move (a gassed
    //     fighter loses it), per "stamina tier mirrors score tier".
    //   • startup 13 ≥ lAct+1 / recovery 22 ≥ lAct + jab.startup ⇒ the reactable + punishable floor.
    //   • cancelInto gyaku-zuki ⇒ the kick → reverse finisher (situational, as the other kicks). It
    //     is ALSO a cancel target — the reverse grows to cancel into it ("reverse → any kick", above).
    "ushiro-geri": {
      startup: 13,
      active: 3,
      recovery: 22,
      score: 2,
      scoreByBand: { high: 3 },
      reach: 330000,
      bands: ["high", "mid"],
      staminaCost: 52,
      cancelInto: ["gyaku-zuki"],
    },
    // empi (elbow, Batch-1 expansion #5): the first close-range strike — the trade-off budget /
    // no-Pareto-dominance law inverted from the long kicks:
    //   • reach 95000 < throw (120000) ⇒ the SHORTEST reach in the game, the new infighting FLOOR.
    //     It whiffs at spacings where every existing move (down to the throw) still connects, and
    //     only lands point-blank — the reward for braving throw range. Its signature.
    //   • score 2 (waza-ari), FLAT — no scoreByBand ⇒ a high·mid strike scoring 2 at BOTH bands.
    //     An elbow is technically an `uchi`, so this is the DELIBERATE close-range exception to the
    //     hand score-cap (close range is its own category); dominance-free vs mae-geri (also 2) —
    //     it trades ~175k of reach down for its point-blank access, so neither dominates.
    //   • bands ["high","mid"] ⇒ jodan/chudan gate (whiffs only low).
    //   • staminaCost 38 > gasThreshold (30) ⇒ special/gas-LOCKED (a gassed fighter loses it), per
    //     "stamina tier mirrors score tier".
    //   • startup 8 ≥ lAct+1 / recovery 14 ≥ lAct + jab.startup ⇒ the reactable + punishable floor.
    //   • cancelInto gyaku-zuki ⇒ the close strike → reverse finisher (situational: the 240k reverse
    //     only reaches when the elbow landed). It is a cancel SOURCE ONLY — the reverse does NOT
    //     grow to cancel into it (that "reverse → any kick" edge is the KICKS' only, above). The
    //     elbow ↔ throw mixup lives at the neutral action-choice level (a throw is not cancellable-into).
    empi: {
      startup: 8,
      active: 2,
      recovery: 14,
      score: 2,
      reach: 95000,
      bands: ["high", "mid"],
      staminaCost: 38,
      cancelInto: ["gyaku-zuki"],
    },
    // ── hiza-geri (knee, Batch-1 expansion #6) — the only MID-band STANDING knockdown → okizeme:
    //   • reach 110000 ⇒ empi (95k) < hiza-geri < throw (120k): the SECOND technique below the
    //     throw, landing only point-blank (the infighting floor's next rung). Its reach signature.
    //   • score 0 + knockdown ⇒ a clean mid hit DOWNS the foe for no score; the points live in the
    //     okizeme finish (a hit-confirmed gyaku-zuki inside finishWindow ⇒ finishScore 3), reusing
    //     the sweep's C8 machinery verbatim — the low sweep knockdown lifted to a standing mid angle.
    //   • bands ["mid"] ⇒ mid-only gate (whiffs high/low); unlike the sweep it bands via bandLegal,
    //     not occupancy. NO scoreByBand (it is a knockdown, not a scoring strike).
    //   • staminaCost 40 > gasThreshold (30) ⇒ special/gas-LOCKED, matching the throw/sweep tier.
    //   • startup 9 ≥ lAct+1 / recovery 16 ≥ lAct + jab.startup ⇒ the reactable + punishable floor.
    //   • cancelInto gyaku-zuki ⇒ the okizeme finisher. Cancel SOURCE ONLY — the reverse does NOT
    //     grow to cancel into it (that "reverse → any kick" edge is the KICKS' only). The knee ↔
    //     throw mixup lives at the neutral action-choice level (a throw is not cancellable-into).
    "hiza-geri": {
      startup: 9,
      active: 2,
      recovery: 16,
      score: 0,
      reach: 110000,
      bands: ["mid"],
      staminaCost: 40,
      knockdown: true,
      cancelInto: ["gyaku-zuki"],
    },
    // ── tobi-geri (jumping kick, Batch-2 air arsenal) — the only AIRBORNE technique. It rides the
    // C4/S1 jump arc: a bot jumps in (closing the gap via `jumpXSpeed`) and commits it mid-flight, its
    // move frames running alongside the arc until landing converts it into a grounded recovery. The
    // no-Pareto-dominance law treats `air: true` as an incomparable island (like the throw's `grab`) —
    // an airborne technique is non-substitutable for a grounded one, so it never Pareto-compares.
    //   • air: true ⇒ committed only while airborne (an airborne-`attack` route); a grounded `tobi-geri`
    //     is `wrong-context` (S2). `canAct` stays neutral-only — the jump is what unlocks the strike.
    //   • bands ["high","mid"] + scoreByBand { high: 3, mid: 2 } ⇒ the airborne read mirrors the
    //     roundhouse: aim jodan for the ippon (3) but risk a crouch-dodge (crouch vacates high), or aim
    //     chudan for the un-duckable waza-ari (2). Pure scoring, NO knockdown (keeps the roster's
    //     score-vs-knockdown separation — no score-3-AND-okizeme monster).
    //   • reach 250000 ⇒ MODERATE (jab 210k < tobi 250k < reverse... no — between reverse 240k and
    //     front 270k). The jump-in supplies the closing, not the reach: straight-up (no jumpXSpeed) it
    //     whiffs from the neutral gap; only a directional leap brings it into range.
    //   • startup 4 is DELIBERATELY below the lAct+1 (7) ground-reactability floor — the ~7-tick jump
    //     arc is itself the tell (perceived via posture/attackBand ~6 ticks ahead), so the move's own
    //     startup need not re-satisfy the ground invariant. Active 3 opens the window on the descending
    //     approach (elapsed 4–5).
    //   • recovery 14 ⇒ the LANDING recovery is punishable (≥ lAct + kizami.startup = 13), so a whiffed
    //     or blocked air strike is answered on the ground (AC-2.7). Matches the reverse's recovery.
    //   • staminaCost 50 > gasThreshold (30) ⇒ special/gas-LOCKED, the most athletic technique (a gassed
    //     fighter loses it), per "stamina tier mirrors score tier". 2nd-priciest (< ushiro 52).
    //   • NO cancelInto, and NOT a cancel target (gyaku-zuki does NOT grow to cancel into it) ⇒ air
    //     strikes are OUT of the rekka cancel web — a distinct approach tool, not a ground-combo link.
    "tobi-geri": {
      startup: 4,
      active: 3,
      recovery: 14,
      score: 2,
      scoreByBand: { high: 3, mid: 2 },
      reach: 250000,
      bands: ["high", "mid"],
      staminaCost: 50,
      air: true,
    },
  },
  // Defensive depth (C5/C6), tuned to the canonical strike's startup-7 timing:
  //   • parryWindow 2 — a matching guard's first 2 ticks (age 1–2) DEFLECT instead of block: a
  //     reaction-precise guard parries, a pre-emptive hold (older) only blocks (the read gradient).
  //   • parryRecovery 12 — a parried strike eats +12 recovery ⇒ heavily punishable / counterable.
  //   • counterWindow 10 / counterBonus 1 — after a parry, a counter strike within 10 ticks scores
  //     an extra yuko (≈ waza-ari, 2 total). 10 ≥ startup(7)+2, so a startup-7 counter lands in time.
  //   • cancelWindow 6 — a connect (hit/block) opens a 6-tick window to cancel recovery into a
  //     `cancelInto` follow-up; reaches into recovery so the rekka hit-confirms.
  parryWindow: 2,
  parryRecovery: 12,
  counterWindow: 10,
  counterBonus: 1,
  cancelWindow: 6,
  // The throw triangle (C7) — the anti-turtle option, on the same startup-7 timing:
  //   • startup 7 = lAct (6) + 1 ⇒ the grab tell is reactable: a read throw-break escapes
  //     it, but only just (symmetric with the strike's read game). One tick faster ⇒ unbreakable.
  //   • active 2 — a 2-tick grab window (forgiving enough to catch a step-in); the FIRST
  //     active frame still governs the break edge, so it does not soften the read.
  //   • recovery 14 ≥ lAct (6) + strike.startup (7) ⇒ a whiffed (or stuffed) grab is
  //     punishable — one tick past the strike's exact-13 edge, as a whiffed grab is the
  //     bigger commitment.
  //   • reach 120000 < strike.reach (240000) ⇒ a grab is close-range (the reach hierarchy
  //     throw < sweep < strike; the sweep fills the gap in a later slice).
  //   • score 3 — a clean throw is the WKF ippon.
  // knockdownDuration 18: a short knockdown; the okizeme finish / i-frame split is carved out
  // of it (finishWindow below). Deliberately short so a swept foe WAKES before an okizeme
  // sweep→finish→sweep loop can re-lock it — the loop cannot keep the foe perpetually downed,
  // so the both-neutral yame boundary still arrives (else a WKF match farms the whole cap).
  throw: {
    startup: 7,
    active: 2,
    recovery: 14,
    reach: 120000,
    score: 3,
    staminaCost: 40, // special move cost (C10) — twice the basic strike
  },
  knockdownDuration: 18,
  // Okizeme (C8): the first `finishWindow` ticks of ANY knockdown are a guaranteed FINISH —
  // an opposing strike scores `finishScore`, ignoring band / guard / occupancy (the foe is prone).
  //   • finishWindow 10 — the sweep→cancel→strike combo lands its finish at knockdown +9 (knockdown
  //     tick 7 → cancel at the first recovery frame, tick 9 → strike active tick 16); 10 lands it with
  //     a frame to spare, while an UN-cancelled strike (neutral tick 22, active 29) arrives far too
  //     late — the foe has already woken from the short knockdown (tick 25), so it lands a mere base
  //     poke, never the finish ⇒ the hit-confirm cancel is load-bearing.
  //   • finishScore 3 — a finish pays the WKF ippon, decoupled from the finishing poke's base score.
  //   • knockdownDuration (18) > finishWindow (10) ⇒ the remaining ticks are wake-up i-frames.
  finishWindow: 10,
  finishScore: 3,
  // The vertical axis (C4) — the anti-air leg of the sweep game. The arc is integrated as
  // `y += vy; vy -= gravity`, so jumpImpulse 12000 / gravity 4000 yields the deterministic
  // integer parabola 12000, 20000, 24000, 24000, 20000, 12000, 0 — a held apex at 24000 that
  // returns to EXACTLY y=0 (impulse is a whole number of gravity steps ⇒ replay-stable).
  //   • lowClearance 8000 < the launch height (12000) ⇒ the jumper vacates `low` the instant it
  //     leaves the ground, giving a 6-tick low-vacate window (launch+1 .. launch+6).
  //   • Against the sweep's 2-frame active window (ticks 7–8), that covers a 5-tick LAUNCH window
  //     (jump on ticks 2–6): the jump-over is viable but must be TIMED — too early and the arc
  //     lands before the sweep arrives, too late and it is still grounded on the first active frame.
  //   So a sweep is a read: low-guard it on reaction, or jump it on a hard read.
  jumpImpulse: 12000,
  gravity: 4000,
  lowClearance: 8000,
  // Horizontal jump displacement (air-actions S1, wired here in S4 alongside tobi-geri). A directional
  // jump travels `jumpXSpeed` sub-units/tick in its dir × facing, locked at launch. 10000 = 2.5×
  // walkSpeed (4000) — a committed leap covers ground faster than a walk, the reward for the telegraphed
  // jump. Over the ~6 airborne ticks it closes ~60000, enough to bring the moderate-reach tobi-geri
  // (250000) into range from the 300000 start gap (a straight-up jump, dir 0, does NOT ⇒ the aerial
  // strike must be a genuine jump-IN, not a free full-range poke). Absent ⇒ 0 ⇒ vertical-only.
  jumpXSpeed: 10000,
  // The perception keystone (C2): position lags 1 tick, the action tell lags 6, with
  // ±1 seeded jitter. lAct 6 with strike.startup 7 puts the read on the knife-edge
  // (S ≥ lAct + 1 holds with equality), so jitter + sharp timing decide the exchange.
  perception: { lPos: 1, lAct: 6, jitter: 1 },
  // The conditioning meter (C10) — the LIGHT layer that paces the fight, never a win
  // condition. A committed strike / throw / sweep spends `staminaCost` on commit (a whiff
  // still costs); an UNCOMMITTED fighter (neutral, not guarding) regens `regen`/tick,
  // clamped to `max`. The numbers:
  //   • max 100 / regen 10 — a full reserve that trickles back a SUB-strike amount per tick
  //     (regen 10 < strike cost 20), so a free spammer floors the meter (5 strikes empty it
  //     to exactly 0) and the next commit degrades to idle, while a fighter that paces
  //     between strikes lets regen refill the cost and never runs dry. Pacing — not the meter
  //     alone — is what sustains offense.
  //   • basic (strike 20) < special (throw / sweep 40) — the cost hierarchy the C10 gas band
  //     (a later slice) sits inside (specialCost > gasThreshold ≥ basicCost): a gassed fighter
  //     loses its specials before its strike.
  //   • blockChip 5 < parryChip 15 — the guard contact-chip (the gentle secondary anti-turtle):
  //     a matching guard that ABSORBS a strike bleeds the DEFENDER. A held block draws blockChip
  //     per contact tick; a fresh deflecting parry draws the larger parryChip once. Non-lethal vs
  //     the 100 reserve (a parried defender keeps ≥ a strike's worth, so it can still counter).
  //   • gasThreshold 30 / gasRecoveryPenalty 6 — the gas line, sitting between basic (20) and
  //     special (40): basicCost 20 ≤ 30 < specialCost 40. A fighter at/below 30 is GASSED — its
  //     throw / sweep degrade to idle (unaffordable) while its strike still commits (the EMERGENT
  //     special-lockout, riding the affordability gate), and a move it commits while gassed eats a
  //     flat +6 recovery. With gasThreshold wired, self.gassed / opponent.gassed go live here too.
  // Absent ⇒ no meter simulated ⇒ byte-identical to the pre-stamina engine.
  stamina: {
    max: 100,
    regen: 10,
    blockChip: 5,
    parryChip: 15,
    gasThreshold: 30,
    gasRecoveryPenalty: 6,
  },
};
