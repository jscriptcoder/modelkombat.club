# ModelKombat — build status & roadmap

The authoritative, detailed record of what's built and what's next.
**`.claude/CLAUDE.md` keeps only a short summary and points here.** Design rationale
lives in `docs/DESIGN.md` (combat + platform) and the generated `docs/spec.md` (bot
API). Every completed vertical-slice **plan** and its resolved-decisions /
acceptance-criteria records are archived under **`docs/archive/`** (see its
[`README.md`](archive/README.md) index) — including the §7 match-structure record
`s7-match-structure.md`.

Naming: roadmap capabilities are **C1–C8** (the `C` prefix avoids colliding with
`slice/N` git branch names) — C1 = walking skeleton (branches `slice/1`–`slice/5`),
C2 = perception keystone, C3 = height bands, C4 = vertical axis + occupancy, C5 =
parry windows, C6 = on-contact cancel combos, C7 = throw triangle + knockdown, C8 =
sweeps + limited okizeme. Later capabilities (C9 arsenal, C10 stamina, the LLM
benchmark, match structure) are named inline below.

## Build log

- DONE (design): the deep-karate combat tree + bot API resolved →
  `docs/DESIGN.md`, `docs/spec.md`.
- DONE (walking skeleton — PRs #1–#5, all 6 ACs): the headless deterministic core.
  `src/engine/dsl.ts` (validator + interpreter — the TCB), `src/engine/types.ts`
  (`State`/`Action`/`Rules` contract), `src/engine/sim.ts` (fixed-timestep `runFight`
  loop). It validates a JSON bot, runs two bots for N ticks, replays
  **byte-identically**, and resolves 1D approach + one _mid_ strike that can score,
  be **blocked** (guard negates; a committed fighter can't guard), or **trade**
  (simultaneous in-range strikes both score, swap-symmetric). 130 tests; `sim.ts`
  mutation ~95%, `dsl.ts` interpreter 100%. The five-slice plan is done and its file
  deleted (per the planning workflow); the record lives in git history (PRs #1–#5).
- DONE (perception-latency keystone — PRs #7–#10): the distinctive mechanic. The
  opponent is a **coherent delayed snapshot** served from a per-fighter history
  buffer — positional fields by `L_pos`, the `opponent.attacking` tell by `L_act`
  (invariant #4) — with dead-reckoned `opponent.predictedDistance` (+ `opponent.vx`)
  and **seeded, clamped per-tick jitter** on the latencies (mulberry32 in
  `src/engine/prng.ts`, the sim's first PRNG consumer — integer `uint32` only, replay-stable).
  This derives the master inequality **reaction-block iff `S ≥ L_act + 1`** (the `+1`
  is the structural observe-after-commit tick; explicit block startup `B` still
  deferred). 149 tests; `prng.ts` mutation 100%, `sim.ts` ~95%. `perception` is
  optional in `Rules`; absent ⇒ `L=0` ⇒ **byte-identical** to the skeleton.
- DONE (height bands — C3, PRs #15–#16): the core read/counter game. A strike
  carries a `high/mid/low` **band**; a guard blocks **only** at its own band — a
  wrong-height guard (or none) is hit (Slice 1). The opponent's incoming band is
  perceivable as **`opponent.attackBand`** — a height-ordered numeric enum
  (`0` none, `1` low, `2` mid, `3` high) on the **same `L_act`-delayed layer** as
  the `attacking` tell (invariant #4) — so a counter-bot can read the height and
  raise the matching guard (Slice 2). 161 tests; `sim.ts` mutation ~95%. The §11
  effects machinery (compute-then-apply union, HIT/BLOCK/WHIFF taxonomy, pre-intake
  frozen snapshot) was deliberately **deferred** to its first consumer (C5 parry /
  throws): C3 stays self-targeted (score on attacker, guard on self), so resolution
  is still trivially order-independent. No per-move legal-band restriction yet.
- DONE (vertical axis + occupancy — C4, PRs #17–#21): the low/high game made physical.
  A `crouch` vacates `high`; a `jump` launches a fixed-point gravity arc (`y += vy;
vy -= gravity`), committed (`canAct=0`) until it lands at `y=0`, and an airborne fighter
  vacates `low` once past `lowClearance` — so a high strike whiffs a croucher and a sweep
  whiffs a jumper (the §11.3 step-3 **occupancy gate**, no longer hardwired open). Occupancy
  is a `posture→vacated-band` table **read-only on the defender**, so resolution stays
  single-`resolveHit` (the §11 effects machinery still waits for C5). The read game:
  `opponent.y` on the **`L_pos`** layer (anti-air by height) and `opponent.posture`
  (`0` standing, `1` crouching, `2` airborne) on the **`L_act`** layer (read a croucher,
  invisible to the height read). 191 tests; `sim.ts` mutation ~95%.
  `jumpImpulse`/`gravity`/`lowClearance` are optional in `Rules`; all absent ⇒
  **byte-identical** to C3. `self.y`/`self.vy`/`self.posture` deferred (no consumer until
  air-actions); horizontal jump `dir` validated but applies no displacement (vertical-only).
- DONE (parry windows — C5, PRs #23–#25): the predict-vs-react skill gradient. The opening
  `parryWindow` ticks of a matching-band guard **deflect** an absorbed strike (no score) and
  throw the attacker into `parryRecovery` extra recovery, where a guard held past the window
  only **blocks** (Slice 1); a parry also opens a **counter window** on the parrying fighter —
  a strike it lands within `counterWindow` ticks scores an extra `counterBonus` (Slice 2); the
  live window is perceivable as **`self.counterWindow`** so a bot can time its counter (Slice 3).
  This is the **first consumer of the §11 effects machinery**: the counter is the first
  **cross-fighter** effect (it lands on the defender), so resolution graduates to the
  **compute-then-apply union** — `resolveHit` splits into a pure `computeStrike` (returns a
  hit/parry outcome from the frozen snapshot) + `applyStrike` (both directions applied
  atomically), keeping the tick swap-symmetric. Guard age is persisted on the Fighter (like C4's
  posture). 206 tests; `sim.ts` mutation ~97%. `parryWindow`/`parryRecovery`/`counterWindow`/
  `counterBonus` are optional in `Rules`; all absent ⇒ **byte-identical** to C4. **The union is
  adopted deliberately at the first cross-fighter effect — not strictly test-forced** (a guarding
  fighter is never simultaneously attacking, so the counter never collides same-tick; **throws**
  are the union's test-forcing consumer). The frozen snapshot is taken **post-intake**; §11.1's
  pre-intake step-dodge refinement stays deferred, as does parry-aware `phaseRemaining`.
- DONE (on-contact cancel combos — C6, PRs #26–#28): within-exchange score escalation with the
  **no-feint** property. A strike that **connects** opens a cancel window on the attacker;
  returning an `attack` in the striking move's `cancelInto` set within `cancelWindow` ticks
  **interrupts the recovery** into the follow-up (Slice 1 — on **hit**; Slice 2 widens the trigger
  to a stale-guard **block**, a first-class connect alongside hit — **parry and whiff never open
  it**, so you can only cancel something the opponent already perceived connect). The live window is
  perceivable as **`self.cancelWindow`** so a bot can **hit-confirm** (Slice 3). This is the **first
  consumer of the §11.3 `CancelEnable` insertion point** — a **self-targeted** effect on the C5
  compute-then-apply union, so it slots in with **no restructuring**: `intake` gains the one
  deliberate cancel exception to commitment, and a `block` `StrikeOutcome` joins hit/parry — block
  opens the window but is **not** marked resolved, preserving the block-then-guard-drop edge. 222
  tests; `sim.ts` mutation ~95%, `dsl.ts` interpreter 100%. `MoveSpec.cancelInto` +
  `Rules.cancelWindow` are optional; absent ⇒ **byte-identical** to C5. Self-cancel
  (`strike→strike`) demonstrates the mechanic; a multi-move arsenal + distinct routes is a later
  additive slice. **Throws** (C7) are the union's genuine test-forcing consumer — now shipped.
- DONE (throw triangle + knockdown — C7, PRs #29–#33): the §11.4 anti-turtle mind-game and the
  compute-then-apply union's genuine **test-forcing** consumer. A committed `throw` (startup →
  grab-active → recovery) GRABS a grounded, non-downed defender in `reach` — beating any guard/parry
  (it is **unbanded**) — scoring `throw.score` (3) and knocking them **down** (`canAct=0`,
  untargetable) for `knockdownDuration` ticks (Slice 1). The full precedence **`strike > throw >
guard`** then resolves _in_ the union: an opposing active in-range strike (a HIT) **stuffs** the
  throw — voided + marked `stuffed`, thrower left committed (punishable) — which also **interrupts
  throw startup** (Slice 2); a defender's **`throw-break`** on a grab-active tick defeats the grab the
  same way (`throw-break > throw`), and a break is a per-tick **non-guard** action so a strike still
  hits it (the anti-break-spam balance, Slice 3); two live grabs **clash** — both whiff — one of only
  two swap-symmetric outcomes in §11.4 (the other is the strike∥strike trade, Slice 4). The incoming
  grab is perceivable as a bare **`opponent.throwing`** boolean on the **`L_act`** layer (invariant #4,
  like `attacking`/`attackBand`/`posture`), making `throw-break` a **reaction** skill-gradient —
  escapable iff `S ≥ L_act + 1` (Slice 5). This is the union's **strictly-forced** consumer: throws
  create the first same-tick **cross-fighter mutual dependencies** (a throw mutates the _defender_ via
  knockdown while a strike mutates the _attacker_ via score), which the frozen-snapshot
  **compute-then-apply** split (`computeThrow`/`applyThrow` alongside `computeStrike`/`applyStrike`,
  live since C5) resolves order-independently. (The "926 tests" once recorded here was a
  `.stryker-tmp` pollution artifact — the real suite is **287** after C8.) `sim.ts` mutation ~95%,
  `dsl.ts` interpreter
  100%. The `throw`/`throw-break` actions are allowlisted in `src/engine/dsl.ts`; `Rules.throw` (a
  `ThrowSpec`) + `knockdownDuration` are optional ⇒ a `throw` is inert when unconfigured ⇒
  **byte-identical** to C6. Deferred to **C8**: sweeps, the one guaranteed **finish window** (okizeme),
  wake-up i-frames, and `opponent.knockdown`.
- DONE (sweeps + limited okizeme — C8, PRs #35–#38): the ground game on the throw triangle. A `sweep`
  is a **low-band STRIKE variant** (reusing `computeStrike` + the §11.4 precedence) that on HIT
  **knocks down** (score 0) instead of scoring — so a low guard blocks/parries it, it whiffs a jumper
  (low occupancy) and hits a croucher, trades with strikes, and stuffs throws, **all precedence
  emergent** ("a sweep is a strike", Slice 1). One **uniform knockdown lifecycle** (throw _and_ sweep),
  `downed{ elapsed, finish }`: the opening `finishWindow` ticks of ANY knockdown are a guaranteed
  **FINISH** window — an opposing active in-range strike scores once, **ignoring band/guard/occupancy**
  (the target is prone) — then the window closes (**exactly one** finish; never re-downs or extends
  `knockdownDuration`); the untargetable tail is the wake-up **i-frames** (Slice 2). The okizeme read is
  split across the two perception layers: the finish window is read **live** as **`self.finishWindow`**
  (= the live opponent's `downed.finish`, like the counter/cancel windows, Slice 3), while the grounded
  state is a delayed **`opponent.knockdown`** boolean on the **`L_act`** layer (like `throwing` —
  invariant #4 — `1` for the _whole_ knockdown incl. i-frames, Slice 4) — so `knockdown ∧ finishWindow>0`
  ⇒ go for the finish, `knockdown ∧ finishWindow==0` ⇒ reset against an invulnerable prone foe. **No new
  resolution machinery**: sweep + okizeme slot onto the C5 compute-then-apply union (`StrikeOutcome`
  gains a `finish` variant; the `hit` and throw outcomes carry the finish window to grant on knockdown).
  287 tests; `sim.ts` mutation ~95% (changed-line 100%), `dsl.ts` interpreter 100%. `MoveSpec.knockdown`
  - `Rules.finishWindow` + `moves.sweep` are optional ⇒ a `sweep` is inert and a knockdown is
    unfinishable when unconfigured ⇒ **byte-identical** to C7. Deferred: deeper okizeme wake-up mind-games
    (multi-option oki), air-actions, _yame_/match structure.
- DONE (canonical frame table — PRs #44–#49): the authoritative `Rules` the platform fights on.
  `src/engine/rules.ts` exports **`CANONICAL_RULES`** — every number proven by a behavioral
  `runFight` test in `rules.test.ts` (the design inequalities + WKF scoring, not literals in
  isolation), built additively across 6 slices: Slice 1 a small additive `finishScore` engine knob;
  Slices 2–5a build + behaviorally verify the table (strike read-game core → parry/counter/cancel/
  crouch defenses → throw triangle → sweep + okizeme finish); Slice 5b the jump arc + anti-air
  occupancy; Slice 6 wires the runner + refreshes docs. The CLI runner (`npm run fight`) now fights on
  it and the provisional `src/cli/demo-rules.ts` is **deleted** (single source of truth). The knife-
  edges, all proven: every committed startup = `lAct(6)+1` (reactable), recoveries ≥ `lAct +
strike.startup` (whiff-punishable), reach hierarchy `throw(120k) < sweep(180k) < strike(240k)`, a
  finish = ippon (3) inside `finishWindow(10) < knockdownDuration(30)`, the jump arc apex 24000
  returning to exactly 0. 354 tests; `rules.ts` mutation 100%. Absent optional fields ⇒ byte-identical
  to the pre-table engine; the engine `getMockRules` mocks stay independent.
- DONE (stamina economy — C10 Story 1, PRs #51–#53): the self-side conditioning meter — the light
  layer that paces the fight, **never a win condition**. A fighter carries an integer `stamina`
  meter (`Rules.stamina.max`): a committed `attack`/`throw`/`sweep` **spends `staminaCost` on
  commit** (whiff still costs), recorded in `FighterFrame.stamina` and exposed as the **live
  `self.stamina`** DSL field so a bot can pace itself (Slice 1, PR #51). A costed commit happens
  **iff `stamina ≥ staminaCost`** — the last affordable move empties to exactly 0, one short
  **degrades to idle** (no spend, no startup, no score); that `≥` is the `[0]` lower bound, so no
  Slice-1 floor is needed (Slice 2, PR #52). An **uncommitted** fighter (neutral ∧ not guarding —
  idle / move / **crouch**) recovers `+regen`/tick clamped to `max`, evaluated **post-intake, before
  `advance`** so a commit / guard / in-move / knockdown tick recovers 0 (the **B2** refinement) — a
  guarding fighter does NOT regen (Slice 3, PR #53). **No new resolution machinery** —
  `spend`/`affordable`/`regen` are self-targeted helpers in `intake` + the advance step. 370 tests;
  `sim.ts` mutation ~96% (changed-line 100%), `dsl.ts` interpreter 100%. `Rules.stamina` (a
  `{ max; regen? }` block), `MoveSpec.staminaCost`, `ThrowSpec.staminaCost` are optional ⇒ absent ⇒
  no meter simulated, `self.stamina` reads the sentinel `0` ⇒ **byte-identical** to the pre-stamina
  engine. **Deferred — C10 Stories 2–4**: the guard contact-chip
  (cross-fighter, rides the §11 union via `applyStrike`), the stepped gas penalty + `self.gassed`
  (emergent special-lockout via `specialCost > gasThreshold ≥ basicCost`), and
  `opponent.stamina`/`gassed` on the `L_act` layer; plus `CANONICAL_RULES` stamina wiring (tuned once
  against gas + the C9 arsenal — inert in `npm run fight` until then). C9 (multi-move "real karate"
  arsenal) is the resolved sibling capability (`docs/DESIGN.md` §P7), sequenced after C10.
- DONE (guard stamina chip — C10 Story 2, PRs #54–#55): the first **cross-fighter** stamina effect —
  a defending fighter's guard bleeds stamina **on contact**. A matching-band guard that ABSORBS an
  active strike (a **block**) draws `blockChip` from the **defender** on each contact tick (per-tick:
  a block never resolves the strike — the C5/C6 block-then-guard-drop edge); a fresh guard that
  DEFLECTS it (a **parry**) draws a strictly larger `parryChip` **once** (the deflect sets `scored`).
  **No new resolution machinery** — both ride the §11 compute-then-apply union: `computeStrike` folds
  the chip onto the `block`/`parry` `StrikeOutcome`, `applyStrike` draws it from `def` via a shared
  `drawChip` helper. The chip is the **first consumer of the `[0]` floor** (`Math.max(0, …)`) — unlike
  a costed commit (guarded by Story 1's affordability `≥`), a defender cannot decline the hit. Read
  through the existing **`self.stamina`** field ⇒ **no new DSL allowlist entry** (the TCB is unchanged).
  379 tests; `sim.ts` mutation ~98% (changed-line 100%), `dsl.ts` interpreter 100%.
  `Rules.stamina.blockChip`/`parryChip` are optional ⇒ absent ⇒ no draw ⇒ **byte-identical** to the
  Story 1 meter (and no `Rules.stamina` ⇒ byte-identical to pre-stamina). **Deferred — C10 Stories
  3–4**: the stepped gas penalty + `self.gassed`, `opponent.stamina`/`gassed` on the `L_act` layer,
  plus `CANONICAL_RULES` stamina wiring.
- DONE (gassing penalty — C10 Story 3, PRs #56–#58): the stepped conditioning mind-game — the **light**
  layer that punishes over-extension without ever being a win condition. A fighter at/below a single
  `Rules.stamina.gasThreshold` is **GASSED**: (Slice 3a, PR #56) its just-committed move recovers slower
  by a flat `gasRecoveryPenalty` (recovery-only), applied **post-spend at commit** via the existing
  `extra` accumulator — equivalent to recovery-entry since stamina is static through a move, and it
  **composes additively with a parry's extra**. **No new resolution machinery** — a `gassed(f, rules)`
  boolean predicate + a pure `gasRecovery` returning the penalty-or-0, applied at the attack/sweep commit
  sites; `startAttack`'s return narrowed to `AttackingState` so the fresh move's `extra` is read without
  a redundant kind-check. (Slice 3b, PR #57) the derived tell is exposed as the live **`self.gassed`**
  (1 iff `stamina ≤ gasThreshold`, else 0) — the **first new DSL allowlist entry since Story 1's
  `self.stamina`**, on the static `FIELD_READERS` map (the TCB boundary can't depend on `Rules`; only the
  value is config-gated), so the **`dsl.ts` interpreter stays 100%**. (Slice 3c, PR #58) the **special-
  lockout is EMERGENT, not a flag** — it falls out of Story 1's affordability gate the moment the numbers
  satisfy **`specialCost > gasThreshold ≥ basicCost`** (a gassed fighter can't afford throw/sweep while
  its basic strike still commits); proven by a guarantee/characterization relationship test over a fixture
  (no production code — the affordability comparison it rides on is 9/9 mutants killed). 387 tests; `sim.ts`
  mutation changed-line 100% (one documented equivalent: the TS-required `?.` on `gasRecoveryPenalty`),
  `dsl.ts` interpreter 100%. `Rules.stamina.gasThreshold`/`gasRecoveryPenalty` are optional ⇒ absent ⇒
  never gassed ⇒ **byte-identical** to the Story 2 meter; `self.gassed` reads the sentinel `0` unconfigured.
  **Deferred — Story 4** (`opponent.stamina`/`gassed` on the `L_act` layer) + the consolidated
  `CANONICAL_RULES` stamina wiring (the numbers — `gasThreshold`/`gasRecoveryPenalty`/per-move costs —
  live in test fixtures until then, re-tuned against gas + the C9 arsenal).
- DONE (opponent stamina read — C10 Story 4, PRs #60–#61): the delayed conditioning tell that completes
  the two-player read game (bait the gas, punish a gassed foe) — closing C10's **behavioral** economy.
  **`opponent.stamina`** (Slice 4a, PR #60) rides the **`L_act` action layer** (the coherent delayed
  snapshot, invariant #4) like `attacking`/`throwing`/`posture`/`knockdown`: `frameOf` records `f.stamina`
  into the per-fighter history ring buffer, `perceiveOpponent` serves it from the **`oppAct`**
  (lAct-delayed) frame — so it reads `tick − L_act` (the structural observe-after-commit tick at
  `L_act = 0`), live at `L_act = 0`, sentinel `0` unconfigured. **`opponent.gassed`** (Slice 4b, PR #61)
  is **derived from that delayed stamina** vs the shared `gasThreshold` — observably identical to a
  separately-recorded delayed boolean (the threshold is a static `Rules` constant ⇒
  `delayed(gassed(s)) == gassed(delayed(s))`), so **no new `Frame` field**: the gas line is extracted as a
  pure **`isGassedAt(stamina, rules)`** shared by the self meter (`gassed` now delegates to it) and
  `perceiveOpponent` (gains a `rules` param). Both are **new static `FIELD_READERS` allowlist entries**
  (`? 1 : 0` like the other boolean tells; the TCB boundary can't depend on `Rules`, only the value is
  config-gated), so the **`dsl.ts` interpreter stays 100%**. 400 tests; `sim.ts` changed-line mutation
  100% (4a 5/5, 4b 11/11), `dsl.ts` reader region 100% (16/16, 17/17). `OpponentState.stamina`/`gassed`
  are additive ⇒ absent stamina config ⇒ sentinel `0`/`0` ⇒ **byte-identical** to the pre-Story-4 engine.
  **Then shipped — the consolidated `CANONICAL_RULES` stamina wiring** (the last C10 unit; see the next
  entry).
- DONE (canonical stamina wiring — C10 final unit, PRs #63–#65): the proven stamina economy promoted into
  **`CANONICAL_RULES`** so the platform (`npm run fight`, the future API / viewer) fights with conditioning
  — **C10 is now fully canonical**. Three additive slices, every number proven by a `runFight`
  _relationship_ test in `rules.test.ts` (no literals-in-isolation), the full pre-existing suite kept green
  under the live meter (numbers chosen so the short canonical fights never hit the affordability wall):
  Slice 1 (PR #63) the **economy core** — `stamina { max 100, regen 10 }` + per-move `staminaCost`
  (basic strike 20 < special throw / sweep 40); spend-on-commit (a whiff still costs), regen offsets a paced
  poke while a free spammer floors the meter to exactly 0 and the next commit degrades to idle. Slice 2
  (PR #64) the **guard contact-chip** — `blockChip 5 < parryChip 15`; a matching guard that ABSORBS a strike
  bleeds the DEFENDER (a held block per contact tick, a fresh deflecting parry the larger chip once),
  non-lethal vs the 100 reserve so a parried defender can still counter. Slice 3 (PR #65) the **gas line** —
  `gasThreshold 30` / `gasRecoveryPenalty 6` at `basic 20 ≤ 30 < special 40`: a gassed fighter's throw /
  sweep degrade to idle (the EMERGENT special-lockout riding Story 1's affordability gate) while its strike
  still commits, and a move committed while gassed eats +6 recovery; with `gasThreshold` wired,
  `self.gassed` / `opponent.gassed` go live on canonical. 411 tests; `rules.ts` mutation 100% (the data
  values are pinned by structural-shape `toBe` assertions + proven by the relationship tests — the only
  Stryker-generated mutant is the `ObjectLiteral` `stamina: {}`, killed by the meter tests). `sim.ts` /
  `dsl.ts` unchanged (data + tests only). The per-move cost MAGNITUDES are provisional against today's
  single-strike arsenal — re-tuned additively when C9 spreads costs across the 4-strike roster; the
  structural INEQUALITIES (basic < special; the gas band) survive C9. **C10 (the stamina economy) is
  COMPLETE** — both C10 plan files (`c10-canonical-stamina.md`, `c10-stamina-split.md`) deleted.
- DONE (**C9 multi-move "real karate" arsenal** — PRs #67–#76): the abstract `strike` is RETIRED into
  four named WKF techniques, shipped across **7 additive slices** (band-legality gate #67 → `kizami-zuki`
  jab #68 → `gyaku-zuki` reverse #70 → `mae-geri` front kick #71 → `mawashi-geri` roundhouse +
  band-dependent `scoreByBand` #72 → cross-move cancels #73 → the S7 finale #74–#76). Each technique
  declares `MoveSpec.bands?` (an out-of-band `attack` ⇒ idle via `bandLegal` in `sim.ts` intake), is
  admitted to the `dsl.ts` `MOVES` allowlist (the TCB), and is an optional `Rules.moves` key (an attack
  naming an **unconfigured** move ⇒ inert via `spec !== undefined`). `mawashi-geri` added the one new
  resolver line — `MoveSpec.scoreByBand?` (jodan 3 / chudan 2, overriding the flat `score`). **The S7
  finale:** S7.1 (#74) killed the deferred `sim.ts:365` cancel·knockdown survivor (a fighter downed the
  same tick it lands a cancelable hit can't cancel-attack while prone); S7.2 (#75) wired all 4 into
  **`CANONICAL_RULES`** — reach `throw 120k < sweep 180k < jab 210k < reverse 240k < front 270k <
roundhouse 300k`, startups 7/7/9/11 (all ≥ `lAct+1`), punch cost 15/20 ≤ `gasThreshold 30` < kick 35/45
  (so a gassed fighter keeps its punches but loses its kicks — the emergent special-lockout), and the
  rekka cancel web — every number proven by a `runFight` _relationship_ test in `rules.test.ts`; S7.3
  (#76) **retired `strike`** — removed from `MoveId` / `Rules.moves` (`gyaku-zuki` took its required slot)
  / the `MOVES` TCB allowlist / `CANONICAL_RULES`, migrated every fixture + the `bots/` demos onto
  `gyaku-zuki`, and reconciled `docs/BOT-DSL.md` + `docs/DESIGN.md` §P7. 468 tests; `dsl.ts` MOVES +
  `rules.ts` mutation 100%. The `sim.ts` resolver was **unchanged throughout** (generic
  `rules.moves[action.move]`). **C9 is COMPLETE** — both C9 plan files deleted.
- DONE (**benchmark WKF match structure** — §7 partial, PRs #87–#93): the roadmap's deferred **match
  structure**, pulled forward and scoped to _yame_ + the win condition (NO jogai / passivity / rounds —
  later) so the **LLM benchmark** scores match OUTCOMES, not raw 600-tick point farming. Realized as one
  optional `runFight` `match?: { winGap }` cfg param (yame resets + the 8-point-gap early-stop together;
  **NOT** in `Rules`/`CANONICAL_RULES` — match mode is a _scoring_ concept, so `npm run fight` is
  unaffected); absent ⇒ **byte-identical**, and **no DSL surface** (the `dsl.ts` TCB is untouched
  throughout — the only outcome-path change is `sim.ts`'s `runFight` orchestration). 6 additive slices:
  **S1** (#88) `winGap` 8-gap early-stop + additive `FightResult.endReason "gap"|"time"` + `ticks` =
  executed; **S2** (#89) **yame** — after a _scored_ exchange fully resolves (both `neutral`, no open
  counter/cancel windows) both bodies reset to the neutral start (position / posture / guard / windows)
  while **points, stamina, mem PERSIST**, the gap checked _at_ the yame boundary (a combo is never
  amputated; a scoreless stretch never resets; perception history is not reset); **S3** (#90) the
  benchmark adopts match mode and ranks **win-rate primary / net-points tiebreak** (`compareSubmission`
  keys swapped), `MATCH = { winGap: 8 }` folded into `INPUT_HASH`, `BENCHMARK_VERSION → v2`; **S6** (#91,
  the conditional rebalance) `knockdownDuration 30→18` — de-walls the sweeper's
  `sweep→knockdown→finish→sweep` okizeme loop that _starved_ the both-neutral yame trigger (it farmed the
  full cap; **legal DSL ⇒ a RULES fix, not a bot-swap**), the unique single-knob balance (sweeper
  100→69%, 5/6 gauntlet members in `[25,75]`, keeps `finishWindow 10 < kd 18`), `BENCHMARK_VERSION → v3`;
  **S4** (#92) post-fix validation — the dogfood re-characterized under match mode (15W/104L/1D) +
  `docs/benchmark-gauntlet-v3.md`; **S5** (#93) `docs/spec.md` **teaches match mode** (the win condition
  - yame + corrected win-rate-primary metric, all manifest-sourced) via a `generateSpec(rules, match)`
    param. 733 tests; each engine slice proved byte-identical absent-`match` + match-mode replay-stability;
    `gen-spec.ts` / `rules.ts` / `benchmark-config.ts` mutation 100% on changed regions. **Deferred:** the
    rest of §7 (jogai / passivity / rounds); a two-sided yame-starvation fix (mutual okizeme-loop matchups
    still farm the cap — but ranking is by the discriminating win-rate, not net); and the **`vulture`
    gauntlet-rebalance follow-up story** (16% win-rate, out the low band — needs a deliberate parry→counter
    redesign; a naive offense buff backfired 16→7%). The `plans/benchmark-match-structure.md` plan is
    deleted (record in git / PRs #87–#93 + `docs/benchmark-gauntlet-v3.md`).
- DONE (**LLM one-shot bot-authoring benchmark v1** — the offline CLI, PRs #79–#86 + #95): the platform's
  headline capability — score an LLM-authored bot deterministically against a **frozen, versioned gauntlet**,
  so the spec is the measuring instrument and the DSL isolates strategy from transcription noise. `npm run
benchmark -- <bot.json>` (or `--from-reply <reply.txt>`) loads a bot through the validator gate and fights
  it over the frozen 6-bot gauntlet (`jabber/rekka/zoner/grappler/sweeper/vulture`, spanning the strategic
  axes), seeds `1..10`, `maxTicks 600`, **each matchup twice (bot as A and as B)** to cancel start-side /
  PRNG-draw-order bias, then ranks **win-rate primary / Σ net-points tiebreak** (post match-structure). Built
  across 8 additive slices: **S1** (#79) the scoring walking skeleton + a versioned `benchmark-config.ts`
  manifest (`BENCHMARK_VERSION` + an `INPUT_HASH` guard test failing CI on any scoring-input change); the
  three mutually-independent **DSL-expressiveness** slices (additive to the `dsl.ts` TCB) — **S2** (#80)
  integer arithmetic (`add/sub/mul/min/max/div/neg/abs`, int32-saturating / div-trunc / ÷0:=0), **S3** (#81)
  unified **`rule(path)`** symbolic ruleset reads (`RULE_READERS` over every numeric `Rules` leaf;
  unconfigured ⇒ sentinel `0`; validator rules-agnostic by SHAPE ⇒ validate-once-run-on-any-rules), **S4**
  (#82) live **`opponent.points`** (a zero-delay scoreboard read, NOT the perception ring buffer); the **spec
  instrument** — **S5a** (#83) the pure `generateSpec()` → committed **`docs/spec.md`** + a byte-match drift
  test (`.prettierignore`d, LF-pinned), **S5b** (#84) the embedded arity-precise JSON Schema + an `ajv`
  agreement test (test-only devDep, never in the engine/TCB), **S6** (#85) the interpolated strategic primer +
  three validated example bots + the dogfood (which surfaced & FIXED a real spec defect — the frame table's
  missing `cancels into` cancel routes); **S7** (#86) lenient `extractBotJson` (`--from-reply`) +
  hard-zero-distinct invalid ranking (an invalid bot never fights — ranked below every valid one, carrying its
  structured `ValidationError` issues; one-shot, no repair loop); **S8** (#95) typed **degrade telemetry** — a
  per-frame `FighterFrame.degrade` (`unaffordable`/`out-of-band`/`locked`/`inert`, threaded out of `intake` as
  a by-product of the outcome-deciding control flow ⇒ can't drift from the physics) + a CLI stamina/reason view
  (`move +1 (locked)`), pure-additive ⇒ **byte-identical outcomes**. 751 tests; the changed
  `gen-spec.ts`/`benchmark`/`submission`/`dsl.ts`-interpreter regions at ~100% mutation, and for S8 `format.ts`
  100% / `sim.ts` 96% (the 4 survivors on pre-existing verbatim lines — 3 equivalent, 1 the sweep-branch
  gas-recovery reachable only under a non-canonical config, its attack twin killed). **No DSL op touches host /
  network / filesystem / time / randomness** (the TCB boundary held throughout; `ajv` is test-only). The
  gauntlet-balance + metric-vs-match follow-ups the S6 dogfood surfaced became the separate **benchmark match
  structure** feature (entry above — win-rate metric + _yame_ + the sweeper de-wall). **LLM benchmark v1 is
  COMPLETE** — `plans/llm-benchmark-v1.md` deleted (record in git / the PRs / `docs/spec.md` +
  `docs/benchmark-gauntlet-v3.md`). Still-deferred: the **KotH ladder** (a separate later feature, not this
  fixed gauntlet), the **HTTP API** (`/spec` / `/validate` / `/fight`), the `vulture` parry→counter
  gauntlet-rebalance story (carried by the match-structure entry), and a true cold-model dogfood (the
  implementing agent has codebase knowledge, so its "cold" authoring is an imperfect proxy).
- DONE (**senshu first-blood tiebreak — Capability C story C1, PRs #104–#105**): the WKF _senshu_ rule
  that decisively resolves a LEVEL bout at the tick cap, closing the benchmark's `"draw"` gap. Behind an
  optional `FightConfig.match.senshu?: boolean` — a **scoring-layer** param, NOT in `Rules`/`CANONICAL_RULES`
  (so `npm run fight` is unaffected); absent ⇒ **byte-identical**. **No DSL/TCB surface** (`dsl.ts`
  untouched — `self`/`opponent.senshu` perception is the deferred C3); **no `docs/spec.md` change** (the
  win/draw prose + `Match` extension are deferred to Capability D). Two additive slices: **C1a** (PR #104)
  the first-blood **latch** — a bout-level `senshuHolder: "undecided" | "A" | "B" | "none"` as a `runFight`
  local (outside `resetToNeutral`'s scope ⇒ survives every yame/jogai/passivity reset, no new per-fighter
  field), decided the first tick a fighter's **technique** points rise; reads the pre-existing per-tick
  technique delta (`a.points > aPointsBefore`) **before** the jogai/passivity penalty blocks ⇒ a penalty
  point never confers; a solo first-scorer holds senshu, a simultaneous first ⇒ `none` (permanent, not
  transferred); the terminal tally rewrites a `"draw"` → the holder with `FightResult.endReason "senshu"`
  — only when the bout is LEVEL (a points/gap winner is untouched); 818 tests, `sim.ts` mutation 39/40.
  **C1b** (PR #105) the WKF **revocation** coupling — a holder that commits its OWN jogai or passivity
  foul (incl. the free 1st warning) loses senshu → `none` (not transferred); a non-holder's foul leaves it
  intact; four guarded lines added to the existing jogai + passivity penalty blocks right after
  `applyPenalty`, so the combat-phase latch precedes the penalty-phase revoke (⇒ a same-tick score+foul
  latches then revokes → `none`); penalty-never-confers falls out of C1a's pre-penalty latch placement
  (characterized, not newly coded); killing the passivity Conditional/Logical mutants required an
  **isolated** (non-mutual) passivity foul fixture (`ATTACKER` vs a `scoreThenBlock` guard — the B2
  attacker-only-reset isolation), since natural both-idle fixtures only produce _mutual_ fouls where
  `&&`/`||` and the holder-check are indistinguishable; 832 tests, `sim.ts` revocation-line mutation 24/28.
  The mutation survivors across both slices are the **same equivalent class**: the `"none" → ""` StringLiteral
  — `senshuHolder` is only ever read via `=== "undecided"/"A"/"B"` (the latch guard + terminal tally), so
  `""` is observationally indistinguishable from `"none"`; every dangerous mutant is killed (always-revoke,
  drop-holder-check, wrong-fighter, `&&`→`||`, statement-removal). All absent-config invariants hold:
  `match.senshu` absent ⇒ byte-identical; jogai/passivity configured but no foul ⇒ byte-identical;
  swap-symmetric; replay-stable.
- DONE (**sudden-death overtime — Capability C story C2, PRs #107–#108**): the WKF _encho-sen_ that
  decisively resolves a LEVEL bout when senshu alone won't — one fixed sudden-death period, first to a
  1-point gap. Behind an optional `FightConfig.match.overtime?: { ticks }` — a **scoring-layer** param,
  NOT in `Rules`/`CANONICAL_RULES` (so `npm run fight` is unaffected); absent (or `ticks ≤ 0`) ⇒
  **byte-identical**. Model X (**OT-first**): overtime is tried BEFORE C1's terminal senshu override, which
  is reused untouched as the exhaust-still-level fallback. **C2a** (PR #107, officiating) — the `runFight`
  loop cap goes dynamic: at the END of the last regulation tick, if the bout is LEVEL (`a.points ===
b.points`) and one period is configured, `cap` extends to `maxTicks + ticks`, `inOT` flips, and both
  bodies `resetToNeutral` (fresh engagement; **points / stamina / penaltyCount / mem / senshuHolder
  persist**). The winGap threshold then drops to `1` at the THREE EXISTING check-sites (`gap = inOT ? 1 :
winGap` at yame / jogai / passivity) — so the first fighter to a 1-point gap (a scored technique OR a 2nd+
  penalty — **penalties are fully live in OT**) wins with `endReason "overtime"`; a same-tick trade stays
  level; OT exhausting level falls to the senshu/draw fallback (a holder's OT foul still forfeits senshu →
  draw); `FightResult.ticks` counts OT. The OT-entry block runs AFTER the officiating blocks, so a same-tick
  winGap / jogai / passivity gap-stop pre-empts it (a decided bout is never level). No DSL surface. 848
  tests; scoped `sim.ts` mutation 92.31% — the **4 survivors are documented equivalents**: the `otTicks ≤ 0`
  OT-entry guards fire an _unobserved_ last-tick `resetToNeutral` (after `events.push`, `cap == maxTicks`, no
  next frame recorded), and the `scored = false` reset is a harmless same-tick spurious yame (both bodies
  already at the neutral start). **C2b** (PR #108, perception — folds in C4) — a bot can now perceive sudden
  death: **`clock.overtime`** (a new `ClockState` view field, `inOT ? 1 : 0` — 0 in regulation, 1 from the
  first OT tick) via a new static `clock.overtime` FIELD_READER (**the only new TCB surface**; value
  config-gated ⇒ `dsl.ts` interpreter stays 100%), and **`clock.ticksRemaining`** now counts the CURRENT
  period's budget (`cap − tick`: `maxTicks − tick` in regulation, the OT-extended `cap − tick` once sudden
  death begins — K on the first OT tick, 1 on the last, **never negative**). `docs/spec.md` regenerated: one
  whitelist bullet + one JSON Schema enum entry (both auto-derived from `ALLOWED_FIELDS`) — **no OT semantic
  prose** (win/draw + `Match` extension deferred to Capability D). 853 tests; scoped Stryker **100%** on the
  changed `sim.ts` clock line + `dsl.ts` reader (Stryker emits no `ConditionalExpression` mutant for
  `X ? 1 : 0` literal ternaries, so **both arms of `inOT ? 1 : 0` were hand-verified killed** — always-0 by
  the RED placeholder, always-1 by a manual mutation → 2 failing tests). **C4 (`clock.overtime`) is now
  shipped inside C2.**
- DONE (**senshu perception — Capability C story C3, PR #110**): the first-blood tells that let a bot play
  to protect its own senshu or bait a holder into fouling it away — closing Capability C's read surface. Two
  **live, egocentric** DSL reads off the bout-level `senshuHolder`: **`self.senshu`** (1 iff I hold senshu) and
  **`opponent.senshu`** (1 iff the foe holds it), both `? 1 : 0`, with `undecided` and `none` collapsing to
  `0/0` (the "still-winnable" availability nuance deferred as additive YAGNI). They ride the **LIVE scoreboard
  layer** in `viewFor` (zero delay, like `opponent.points`/`penalties`) — NOT the `L_act` ring buffer: senshu
  is a public referee call derived from the live per-tick point delta, so a delayed tell would contradict the
  zero-delay `opponent.points` it's computed from, and `senshuHolder` isn't in the `Frame` ring buffer at all.
  **Single slice** (both readers share one change): `senshuHolder` (the `runFight` local, untouched since C1) is
  threaded into `viewFor`, and each per-fighter call site computes `senshuHolder === "A"/"B" ? 1 : 0` — the
  `===` living at the call site so it is mutation-covered (unlike C2b's bare `inOT ? 1 : 0`, the comparison form
  DOES generate `ConditionalExpression` mutants, killed both-arms by the swap + undecided fixtures). Two new
  static `FIELD_READERS` (`SelfState.senshu`/`OpponentState.senshu`, the only new TCB surface; value
  config-gated ⇒ `dsl.ts` interpreter stays **100%**), plus a mechanical `gen:spec` regen (2 field-whitelist
  bullets + 2 JSON Schema enum entries — **no** senshu win/draw prose, deferred to Capability D, and **no**
  `BENCHMARK_VERSION`/`INPUT_HASH` change: C3 touches no scoring input). 867 tests; scoped Stryker **100%**
  (18/18: `dsl.ts` 2/2, `sim.ts` 16/16) on the changed `viewFor` assigns + call-site ternaries + readers.
  `SelfState.senshu`/`OpponentState.senshu` are additive ⇒ absent `match.senshu` ⇒ `senshuHolder` stays
  `undecided` ⇒ `0/0` all bout (and existing bots don't reference the fields) ⇒ **byte-identical** +
  replay-stable + swap-symmetric. **Capability C is COMPLETE** (C1 senshu + C2 overtime + C3 perception).
- DONE (**Capability D — benchmark + spec senshu adoption, PRs #113–#114**): the downstream adoption that wires
  the built §7 **senshu** first-blood tie-break (C1/C3) into the LLM benchmark's frozen manifest and teaches it
  in `docs/spec.md` — **NO new engine behavior** (senshu shipped in C1/C3; D flips a scoring-config flag + writes
  prose). **Scoped to senshu only** (jogai/passivity/overtime adoption DEFERRED — they'd force a gauntlet
  rebalance / mislead authors with fields that read `0` all match). Two slices. **D1 (PR #113, benchmark scores
  under senshu)**: widen `BenchmarkConfig["match"]` → the shared `FightConfig["match"]` (senshu carried typed;
  the aggregator already keys off the resulting `winner`, so it propagates with NO logic change),
  `MATCH = { winGap: 8, senshu: true }`, `BENCHMARK_VERSION v3 → v4`, `INPUT_HASH` re-pinned (guard forced-RED →
  GREEN). A level-at-cap **solo-first-blood** bout now tallies a WIN for the holder (proven by a synthetic
  `benchmark.test.ts` SCORER/DELAYED pair on `MOCK_RULES`, both sides), with **net-points invariant** (senshu
  never moves a score). Dogfood re-pinned `15W/104L/1D → 16W/104L/0D` (the lone draw → first-blood win). Added
  `docs/benchmark-gauntlet-v4.md` (senshu re-characterization; `v3` kept intact) — **report-only, NO rebalance**:
  senshu SHARPENS the ranking (0 draws everywhere; net unchanged), so `sweeper` rises 69% → **82% (now out-of-band
  HIGH — a NEW senshu-surfaced observation)** and `vulture` stays 16% (out low) → 4/6 in `[25%,75%]`; both DEFERRED
  (sweeper new, vulture the existing parry→counter follow-up). **D2 (PR #114, spec teaches senshu)**,
  VERSION-NEUTRAL: `generateSpec`'s `Match` gains `senshu?`; the `benchmarkSection` win-condition prose teaches the
  `winGap → senshu → residual-draw` cascade and the primer "play the match" bullet gains the actionable senshu
  clause naming `self.senshu`/`opponent.senshu` — both **gated on `match.senshu`** (taught == scored: a senshu-off
  manifest renders the original prose) — `docs/spec.md` regenerated (2 prose regions only). **NO new DSL/TCB
  surface** (senshu reads shipped in C3 ⇒ field-whitelist / JSON Schema enums unchanged; the `dsl.ts` TCB is
  untouched throughout D); `npm run fight` unaffected (`match` is benchmark-only, not in `Rules`/`CANONICAL_RULES`).
  872 tests; D1 `benchmark-config.ts` + `benchmark.ts` mutation 100% (65/65), D2 `gen-spec.ts` changed-region 100%
  (6/6). Non-goals honored: no `endReason` surfacing, no jogai/passivity/overtime, no gauntlet rebalance.
  **Capability D is COMPLETE.**

### §7 match structure built between C9 and Capability D

Capabilities A (jogai), B (passivity), and C (tie resolution) — the WKF officiating
mechanics — were built after C9 and before Capability D's benchmark adoption. Their
per-slice detail (PRs #97–#110) and the full resolved-decisions / acceptance-criteria
records live in **`docs/archive/s7-match-structure.md`**:

- **Capability A — jogai (ring-out penalty), PRs #97–#99**: A1 out-zone detection +
  reset, A2 warning-ladder penalty (shared per-fighter `penaltyCount`), A3 penalty
  perception (`self.penalties` / `opponent.penalties`, live scoreboard reads).
- **Capability B — passivity (non-engagement penalty), PRs #100–#103**: B1 clock +
  reset-on-contact + re-engage reset, B2 passivity feeds the shared penalty ladder,
  B3 self read (`self.passivityRemaining`, live), B4 opponent read
  (`opponent.passivityRemaining`, `L_act`-delayed).
- **Capability C — tie resolution, PRs #104–#110**: C1 senshu first-blood tiebreak,
  C2 sudden-death overtime (+ C4 `clock.overtime` folded in), C3 senshu perception
  (`self.senshu` / `opponent.senshu`) — see the C1/C2/C3 build-log entries above.

## Next in the pipeline

All remaining items need `grill-me` → `planning` → TDD, **PR per capability**. Flow:
`grill-me` / `planning` → TDD. The §11 combat-resolution spine (two-phase
compute-then-apply, live from C5, strictly forced by C7's throws; S1 posture → S2
intake → S3 compute → S4 apply → S5 advance; `strike > throw > guard` precedence,
HIT/BLOCK/WHIFF gate) is pinned in `docs/DESIGN.md` §11. The §7 officiating design
records for the deferred adoption work are in `docs/archive/s7-match-structure.md`.

1. **Gauntlet rebalance** — the `vulture` parry→counter follow-up (16%, out the low
   `[25%,75%]` band; a naive offense buff backfired 16→7%), now joined by a NEW D1
   finding: **`sweeper` 82% (out-of-band HIGH under senshu)**. Both are report-only in
   `docs/benchmark-gauntlet-v4.md`; neither is rebalanced (D was adoption-only). A
   rebalance is a separate capability.
2. **Deferred jogai / passivity / overtime benchmark + spec adoption** — Capability D
   was scoped to senshu only; folding jogai / passivity / overtime into the benchmark
   `MATCH` (+ `INPUT_HASH` / `BENCHMARK_VERSION`) and teaching their prose in
   `generateSpec` was deliberately deferred (each would force its own gauntlet
   re-characterization / possible rebalance). The jogai + passivity + overtime
   MECHANICS are already built (Capabilities A / B / C2); only their benchmark+spec
   adoption remains.
3. **Rest of §7** — **rounds** (the last unbuilt match-structure piece, beyond the
   benchmark's yame + win condition + tie resolution).
4. **Air-actions** — air strikes / horizontal jump displacement (a separate roadmap
   capability; `self.y`/`self.vy`/`self.posture` are the deferred perception surface).

Also unbuilt (platform layer, later): the KotH ladder, the HTTP API
(`/spec` / `/validate` / `/fight`), and the Pixi viewer.
