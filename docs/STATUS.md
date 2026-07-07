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
- DONE (**Batch-1 arsenal expansion — `uraken` (backfist), move #1/6, PRs #117–#118**): the first real-karate
  roster expansion (design source `docs/move-roster.md` — balance law + 6 resolved Batch-1 frame blocks). `uraken`
  is the **cheapest** (`staminaCost 12`, gas-proof) + **shortest** (`reach 200000`) hand strike and the **first
  `high`-only** technique (`bands:["high"]` ⇒ whiffs a croucher) — a 1-point _yuko_ snap. Because the `sim.ts`
  resolver is fully **generic** (`rules.moves[action.move]` + `bandLegal` + `affordable`), the move is **pure data +
  TCB allowlist**, no resolver code. **Slice 1 (#117)** wires it in: `MoveId`/`Rules.moves` types, the `MOVES`
  allowlist entry, the `CANONICAL_RULES` spec, regenerated `spec.md`; wiring a move into `CANONICAL_RULES` flips the
  benchmark `INPUT_HASH` ⇒ `BENCHMARK_VERSION v4 → v5`. **Slice 2 (#118)** adds the 6 `rule("moves.uraken.*")`
  field-readers (`dsl.ts` TCB) so bots introspect its frames — a **reads-only** change (no `CANONICAL_RULES` edit) ⇒
  `INPUT_HASH` stable ⇒ **no version bump**. 895 tests; both slices 100% mutation on changed lines. Plan archived at
  `docs/archive/uraken-backfist.md`. **Next Batch-1 move: `shuto`.**
- DONE (**Batch-1 arsenal expansion — `shuto` (knife-hand), move #2/6, PRs #120–#121**): the **longest-reach
  hand** — it **out-ranges the reverse punch** (`reach 260000` > `gyaku-zuki` 240000) despite scoring only 1
  (_yuko_), a `high·mid` gas-proof poke (`staminaCost 22 ≤ gasThreshold 30`). The no-Pareto trade made concrete:
  reach up, paid with score down (1 < 2), cost up (22 > 20), startup down (8 > 7) — dominance-free vs both existing
  hands. Same **pure data + TCB allowlist** shape as `uraken` (the generic `sim.ts` resolver is untouched). **Slice 1
  (#120)** wires it in (`MoveId`/`Rules.moves` types, `MOVES` entry, `CANONICAL_RULES` spec, regenerated `spec.md`)
  ⇒ `BENCHMARK_VERSION v5 → v6` (`INPUT_HASH` flip). **Slice 2 (#121)** adds the 6 `rule("moves.shuto.*")` readers
  (`dsl.ts` TCB) ⇒ reads-only, `INPUT_HASH` stable ⇒ **no version bump**. 918 tests; both slices 100% mutation on
  changed lines. Plan archived at `docs/archive/shuto-knife-hand.md`. **Next Batch-1 move: `yoko-geri`.**
- DONE (**Batch-1 arsenal expansion — `yoko-geri` (side kick), move #3/6, PRs #123–#124**): the **first kick** of
  the expansion and the **longest reach in the game** — a **beyond-neutral zoning thrust** whose `reach 315000`
  out-reaches even the roundhouse (300000) _and_ the neutral `startGap` (300000), so it connects at a gap where every
  existing move whiffs. Scores **2** (_waza-ari_, `mid`-only), **gas-locked** (`staminaCost 48 > gasThreshold 30` ⇒ a
  gassed fighter loses it — the mirror image of the gas-proof hands), and a cancel **target** as well as a source:
  `gyaku-zuki.cancelInto` grows to `["mae-geri", "mawashi-geri", "yoko-geri"]` (the "reverse → any kick" policy). The
  no-Pareto trade — reach up, paid with the slowest-but-one startup (12), longest-but-one recovery (20), highest cost
  (48), a single band, and no ippon — dominance-free vs the roundhouse on five axes. Same **pure data + TCB allowlist**
  shape (the generic `sim.ts` resolver is untouched). **Slice 1 (#123)** wires it in (`MoveId`/`Rules.moves` types,
  `MOVES` entry, the `CANONICAL_RULES` spec + the grown cancel edge, regenerated `spec.md`) ⇒ `BENCHMARK_VERSION v6 →
v7` (`INPUT_HASH` flip). **Slice 2 (#124)** adds the 6 `rule("moves.yoko-geri.*")` readers (`dsl.ts` TCB) ⇒
  reads-only, `INPUT_HASH` stable ⇒ **no version bump**. 941 tests; both slices 100% mutation on changed lines. Plan
  archived at `docs/archive/yoko-geri-side-kick.md`. **Next Batch-1 move: `ushiro-geri`.**
- DONE (**Batch-1 arsenal expansion — `ushiro-geri` (back kick), move #4/6, PRs #126–#127**): the **reach apex**
  (`reach 330000` — now the **longest technique in the game**, past `yoko-geri` 315000 and `startGap` 300000) and the
  expansion's **first jodan-ippon _kick_** — `scoreByBand {high: 3}` scores **3** (_ippon_) at head height / **2**
  (_waza-ari_) at chudan, mirroring the roundhouse. The **highest-commitment** move in the roster: the slowest startup
  (13), longest recovery (22), and priciest cost (`staminaCost 52 > gasThreshold 30` ⇒ gas-locked). Dominance-free vs
  both `yoko-geri` (out-commits it on every tempo/cost axis for +15k reach and the ippon) and `mawashi-geri` (same
  jodan bonus, +30k reach traded for slower/costlier). A cancel **target** too: `gyaku-zuki.cancelInto` grows to
  `["mae-geri", "mawashi-geri", "yoko-geri", "ushiro-geri"]`. Same **pure data + TCB allowlist** shape (the generic
  `sim.ts` resolver is untouched). **Slice 1 (#126)** wires it in (`MoveId`/`Rules.moves` types, `MOVES` entry, the
  `CANONICAL_RULES` spec + the grown cancel edge, regenerated `spec.md`) ⇒ `BENCHMARK_VERSION v7 → v8` (`INPUT_HASH`
  flip). **Slice 2 (#127)** adds the **7** `rule("moves.ushiro-geri.*")` readers — the 6 standard plus
  `scoreByBand.high` (the jodan bonus, mirroring `mawashi-geri`) ⇒ reads-only, `INPUT_HASH` stable ⇒ **no version
  bump**. 967 tests; both slices 100% mutation on changed lines (a `scoreByBand.high` inner-`?.` guard test, mirroring
  the roundhouse, kills the lone survivor). Plan archived at `docs/archive/ushiro-geri-back-kick.md`. **Next Batch-1
  move: `empi`.**
- DONE (**Batch-1 arsenal expansion — `empi` (elbow), move #5/6, PRs #129–#130**): the **first close-range strike**
  and the **shortest reach in the game** (`reach 95000` — below even the throw's 120000), the new infighting **floor**
  that connects only point-blank. It scores a **flat 2** (_waza-ari_) at `high·mid` — the deliberate close-range
  exception to the hand score-cap (no `scoreByBand`, unlike `ushiro-geri`/`mawashi-geri`) — is gas-locked
  (`staminaCost 38 > gasThreshold 30`), and is a cancel **source only** (`empi → gyaku-zuki`; **not** a reverse-punch
  target, so `gyaku-zuki.cancelInto` is unchanged — the smaller `uraken`/`shuto` footprint, no cancel-edge growth).
  Dominance-free vs `mae-geri` (also score 2): it trades ~175k of reach down for point-blank access, so neither
  dominates. Same **pure data + TCB allowlist** shape (the generic `sim.ts` resolver is untouched). **Slice 1 (#129)**
  wires it in (`MoveId`/`Rules.moves` types, `MOVES` entry, the `CANONICAL_RULES` spec, regenerated `spec.md`) ⇒
  `BENCHMARK_VERSION v8 → v9` (`INPUT_HASH` flip). **Slice 2 (#130)** adds the **6** `rule("moves.empi.*")` readers
  (no `scoreByBand` ⇒ a clean 6-reader add, no guard test) ⇒ reads-only, `INPUT_HASH` stable ⇒ **no version bump**.
  990 tests; both slices 100% mutation on changed lines. Plan archived at `docs/archive/empi-elbow.md`.
- DONE (**Batch-1 arsenal expansion — `hiza-geri` (knee), move #6/6 — COMPLETES BATCH 1, PRs #132–#133**): the
  **only mid-band _standing_ knockdown → okizeme** technique. A clean point-blank `mid` knee (`reach 110000` —
  between `empi` 95000 and the throw 120000, the infighting floor's second rung) scores **0** but **downs** the foe
  (`knockdown: true`); the points live in the **okizeme finish** (`hiza-geri → gyaku-zuki` inside `finishWindow` ⇒
  `finishScore` 3) — the sweep's low-band knockdown game lifted to a standing mid angle, reusing the **built C8
  knockdown + `finishWindow` machinery verbatim (no new engine field, no `sim.ts` change)**. Gas-locked
  (`staminaCost 40 > gasThreshold 30`), cancel **source only** (no `gyaku-zuki.cancelInto` growth — the smaller
  `empi` footprint). Same **pure data + TCB allowlist** shape (the generic `sim.ts` resolver is untouched).
  **Slice 1 (#132)** wires it in (`MoveId`/`Rules.moves` types, `MOVES` entry, the `CANONICAL_RULES` spec,
  regenerated `spec.md`) ⇒ `BENCHMARK_VERSION v9 → v10` (`INPUT_HASH` flip). **Slice 2 (#133)** adds the **6**
  `rule("moves.hiza-geri.*")` readers ⇒ reads-only, `INPUT_HASH` stable ⇒ **no version bump** — but with a **novel
  mutation finding**: as the only **hyphenated** move with `score 0`, its bracket-notation reader
  (`r.moves["hiza-geri"]`) carries a `StringLiteral` `""` mutant the score-0/0 row cannot kill (unlike the
  dot-accessed `sweep`), so a targeted key-guard test (a non-zero-score fixture) was added ⇒ **6 readers + 1 guard
  test**. 1014 tests; both slices 100% mutation on changed lines. Plan archived at `docs/archive/hiza-geri-knee.md`.
  **Batch-1 grounded arsenal COMPLETE (6/6) — next: the roster-wide no-Pareto-dominance property test + the owed
  `vulture`/`sweeper` gauntlet rebalance.**

- DONE (**gauntlet modernization + rebalance — S1: `vulture` parry→counter**, PR #135): the first
  slice of the gauntlet **modernization + rebalance** feature (parent split
  `plans/gauntlet-modernization-stories.md`) — re-authoring the frozen benchmark gauntlet, one bot
  per PR, so it (a) lands all 6 members in the `[25%, 75%]` round-robin band and (b) collectively
  exercises the full arsenal. **Lever: bot-document redesign only** (no `CANONICAL_RULES` change ⇒
  `npm run fight` byte-identical). S1 gives the pure-reactive `vulture` the counter it never had:
  ONE rule — `self.counterWindow > 0 → attack uraken high` (gas-proof `uraken` cost 12 so a
  chip-drained blocker can still counter; the defensive core — throw-break, block-by-band,
  gassed-punish — untouched). Because the generic `sim.ts` resolver already rewards a parry
  (`parryRecovery +12` punish window → `counterWindow` → `counterBonus` a startup-7 strike lands in
  time), the fix is **pure data + a behavioral characterization**, no engine change. Round-robin
  re-measure (v10 → **v11**): `vulture` **16 → 60%** (fixed), and the round-robin coupling pulls
  `sweeper` **82 → 67%** in-band with **no `sweeper` edit** — the predicted "bargain" (`sweeper` was
  the D1 out-of-band-high finding). Two original outliers → one: the counter feasts on startup-7
  punch-spam, so `jabber` fell **28 → 19% (out low)** — **accepted and deferred** to a new `jabber`
  slice per the escalation ladder (redistribute, don't nerf `vulture`). Coverage 5/11 → **6/11**
  (`uraken`). Wiring a gauntlet bot flips `INPUT_HASH` ⇒ `BENCHMARK_VERSION v10 → v11`; dogfood
  characterization 16W → 18W; `docs/spec.md` regenerated (it embeds `vulture` as its example bot).
  1017 tests; `benchmark-config.ts` mutation 100% (the JSON bot is data — Stryker doesn't mutate it;
  effectiveness is structural — the RED tests distinguish old-vs-new `vulture` + reject the
  over-broad counter rule). Plan archived at `docs/archive/gauntlet-s1-vulture-parry-counter.md`.
  **Next slices:** `zoner` long-range, `grappler` close-range, the added `jabber` rebalance, then
  the calibration lock (CI band + coverage acceptance tests + final gauntlet doc).

- DONE (**gauntlet modernization + rebalance — S-jabber: `jabber` block+counter**, PR #137): the
  slice added by S1 (the counter feast had knocked `jabber` out low). Same lever — bot-document
  redesign only (no `CANONICAL_RULES` change ⇒ `npm run fight` byte-identical). The planned `shuto`
  **range-poke failed the re-measure** (poking at range stopped `jabber` advancing, breaking its ONLY
  winning matchup `zoner` → 0%); **pivoted (user-approved) to a reactive block + counter**: keep the
  advance + close jab, add block-on-reaction (`opponent.attackBand` → block that band) + a counter
  (`self.counterWindow > 0 → shuto high`, the same generic parry→`counterWindow` reward the engine
  already pays). Round-robin re-measure (v11 → **v12**), all 6 back in band: `jabber` **19 → 31%**
  (flipped `rekka` 0→11/20, held `zoner` 19→20/20); `rekka` 52 → 41, others steady. Tradeoff accepted:
  `jabber` gains a reactive layer partly overlapping `vulture` (still distinct — `jabber` advances +
  pressures). Coverage 6/11 → **7/11** (`shuto`, via the counter ⇒ reassigned off S2). `BENCHMARK_VERSION
v11 → v12` (`INPUT_HASH` re-pinned); dogfood record unchanged (18W/102L — already losing its `jabber`
  matchup); `docs/spec.md` regenerated. 1025 tests; `benchmark-config.ts` mutation 100% (10/10); RED
  verified by stashing the bot to v11 (5 fail, 3 fences pass). Plan archived at
  `docs/archive/gauntlet-s-jabber.md`. **Next slices:** `zoner` long-range (`yoko-geri`, `ushiro-geri`),
  `grappler` close-range (`empi`, `hiza-geri`) ⇒ 11/11 coverage, then the calibration lock.

- DONE (**gauntlet modernization + rebalance — S2: `zoner` beyond-neutral long kicks**, PR #139): arms
  `zoner` with `yoko-geri` (reach 315k) + `ushiro-geri` (reach 330k), covering two more moves. Same
  lever — bot-document only (no `CANONICAL_RULES` change ⇒ `npm run fight` byte-identical). **Finding:**
  these slow (startup 12/13), heavily-punishable kicks have **no healthy niche** in the frozen roster —
  fired broadly (their natural >300k bands) they cost `zoner` its `vulture` matchup (`zoner` 35 → 26,
  `vulture` 60 → 70, wider dispersion). So (user-approved) they are **narrow-gated** to the top sliver
  (`yoko` 310–320k, `ushiro` 320–330k, the 300–310k gap falling through to walk-forward): the two moves
  are genuinely referenced + reachable (decision-contract), so coverage 7/11 → **9/11** by the "every
  move referenced" bar, while the **v13 board = v12 board** — calibration untouched (sweeper 67, grappler
  66, vulture 60, rekka 41, zoner 35, jabber 31; nets shift a few points as the kicks fire rarely, no
  outcome flips). `BENCHMARK_VERSION v12 → v13` (`INPUT_HASH` re-pinned); dogfood unchanged (18W/102L);
  `docs/spec.md` regenerated. 1031 tests; `benchmark-config.ts` mutation 100% (10/10); RED verified by
  stashing the bot to v12 (3 long-kick cases fail, 3 fences pass). Plan archived at
  `docs/archive/gauntlet-s2-zoner.md`. **Lesson for S4:** condition (C)'s "all 12 moves collectively
  exercised" can conflict with tight calibration for niche moves — narrow-gating satisfies the coverage
  bar without degrading the band. **Next:** `grappler` close-range (`empi`, `hiza-geri`) ⇒ 11/11, then lock.

- DONE (**gauntlet modernization + rebalance — S3: `grappler` close-range knee + elbow**, PR #141):
  arms `grappler` with `empi` (elbow, gated ≤85k) + `hiza-geri` (knee, 85–95k → knockdown → `gyaku-zuki`
  okizeme finish, the sweeper's C8 pattern), the throw kept as the ippon at the 95–120k contact band.
  Same lever — bot-document only (no `CANONICAL_RULES` change ⇒ replay byte-identical). **Completes
  coverage 9/11 → 11/11 — the full arsenal is now exercised by the gauntlet.** **Full real integration**
  (user-approved, no fallback): the moves fire for real (100-fight count `empi` 102 / `hiza-geri` 161 /
  `gyaku-zuki` 157 — the knee confirms into a finish every time). v14 board (all 6 ∈ `[25,75]`): sweeper
  67, vulture 68, grappler 58, rekka 41, zoner 35, jabber 31. **Finding (extends the S2 lesson):** the
  close moves are throw-dominated with **no naturally-rare band** (unlike zoner's far sliver), so real
  integration DOES perturb the round-robin — but via the **parry→counter coupling**, not grappler's own
  win-rate: a broad strike layer (empi ≤95k) fed `vulture`'s counter to 80% (OUT-high, as grappler's
  best matchup — beating vulture by _throwing_ — flipped to its worst). The fix: keep the **throw**
  owning the 95–120k contact band (throw the spacer vulture, strike the rushers that close inside 95k);
  no guard/counter-readiness tell exists in the perceived snapshot, so this had to be done by **range,
  not read**. `BENCHMARK_VERSION v13 → v14` (`INPUT_HASH` re-pinned); dogfood unchanged (18W/102L);
  `docs/spec.md` regenerated. 1037 tests; `benchmark-config.ts` mutation 100% (10/10); RED verified vs
  the old all-throw bot. Plan archived at `docs/archive/gauntlet-s3-grappler.md`. **Next:** the S4
  calibration lock — both end-state conditions (all-6-in-band + 11/11 coverage) now hold.

- DONE (**gauntlet modernization + rebalance — S4: calibration lock + feature close-out**, PR #143):
  **the final slice — the feature is COMPLETE.** Landed the CI lock
  (`src/cli/gauntlet-calibration.test.ts`): a band test (all 6 members' round-robin win-rate ∈
  `[0.25, 0.75]`) + a coverage test (all 11 `moves` keys referenced), each with a committed "guard
  bites" proof (a fabricated pushover falls below band; a roster missing `grappler` leaves
  `empi`/`hiza-geri` uncovered). Both GREEN on the frozen v14 roster ⇒ a **certification pass, not a
  rebalance** — no bot/rules change, `BENCHMARK_VERSION` stays `v14`. Also bundled a robustness fix
  discovered while verifying: the frozen bot texts are now LF-pinned via `.gitattributes`
  (`bots/*.json text eol=lf`) and `INPUT_HASH` re-pinned to the canonical all-LF value
  (`5bae2d64 → 5a503468`) — the old pin was a fragile mixed-ending state (grappler LF, others CRLF)
  that broke the hash guard on a fresh Windows checkout under `core.autocrlf`; line endings don't
  affect parsing/fights ⇒ scores byte-identical, version unchanged; `docs/spec.md` regenerated.
  Final board + coverage map: `docs/benchmark-gauntlet-v14.md` (all 6 ∈ band: vulture 68, sweeper 67,
  grappler 58, rekka 41, zoner 35, jabber 31; coverage 11/11). 1046 tests; `benchmark-config.ts`
  mutation 100% (10/10). Plans archived at `docs/archive/gauntlet-s4-calibration-lock.md` +
  `docs/archive/gauntlet-modernization-stories.md`; `plans/` now empty.

- DONE (**roster-wide no-Pareto-dominance + distinctness property** — PRs #145–#146): the Batch-1
  arsenal **close-out** — a pure-data guard in `src/engine/rules.test.ts` asserting the full
  **12-move roster** (10 named `attack` moves + `sweep` + `throw`, enumerated DYNAMICALLY off
  `CANONICAL_RULES.moves` so future moves auto-enroll) is free of **Pareto-dominance** (rule 2) AND
  **near-duplicates** (rule 4) on the 7 strategic axes — `reach`↑, effective `score`↑ (folds
  `scoreByBand`), `startup`↓, `recovery`↓, `staminaCost`↓, `bands` by set-inclusion (⊇),
  `knockdown`↑ — the move-roster balance law's long-standing "Verification hook", resolved via
  `grill-me` → `find-gaps` → `planning`. The detector + adapter are **test-local** (Stryker excludes
  `*.test.ts`, config `!src/**/*.test.ts`), so their comparison logic is pinned by an explicit
  **directional fixture matrix** (one per axis + the "all axes" AND-guard + the strict-`>`
  existential + incomparable bands + a "guard bites" fabricated dominator) rather than a mutation
  score. Heterogeneous moves are projected into the common vector: `throw` (a `ThrowSpec`) → its own
  incomparable **`grab`** band + implicit `knockdown` (that band-incomparability alone stops `throw`
  dominating `hiza-geri`, so no `cancelInto` axis is needed), `sweep` → its mechanical **`{low}`**
  (it declares no `bands`), and the axis set stays MINIMAL (each extra axis is an escape hatch that
  weakens the guard — `active`/`cancelInto` deliberately excluded). **S1 (#145)** the dominance
  property (ordered pairs, self-pairs excluded); **S2 (#146)** the distinctness companion (unordered
  `i<j`; same 7 axes ⇒ a move distinguishable only by the excluded `active`/`cancelInto` is
  non-distinct and flagged — the deliberate `find-gaps` decision) + this close-out. **Test-only** ⇒
  no `CANONICAL_RULES`/engine change ⇒ `INPUT_HASH`/`BENCHMARK_VERSION` unchanged, `npm run fight`
  byte-identical, `gen:spec` no diff. 1075 tests; `rules.ts` mutation 100% (72/72), no regression.
  Design trail: `docs/archive/no-pareto-dominance.md`. **The Batch-1 grounded arsenal is now fully
  closed out (6/6 moves + the roster-wide balance guard).**
- DONE (**jogai benchmark + spec adoption — item 3 (jogai slice), v15, PRs #147–#149**): folds the built
  §7 **jogai** (ring-out penalty, Capability A) into the LLM benchmark's frozen manifest, teaches it in
  `docs/spec.md` (taught == scored), and CI-locks that it both **fires** and is **field-read** on the
  gauntlet — the first of the three deferred officiating mechanics (passivity / overtime still pending under
  item 3). Three PRs. **PR 1 (#147, telemetry)**: `FightResult.fouls: { a, b: { jogai, passivity } }` — a
  per-cause split threaded through a `cause` param on `applyPenalty`, read only at the terminal return ⇒
  **byte-identical**, no version bump; the observable the "fires" guard needs. **PR 2 (#148, the v15 flip)**:
  the atomic `INPUT_HASH` change — `MATCH += jogai: { margin: 100000 }`, `BENCHMARK_VERSION v14 → v15`;
  `generateSpec` gains a gated jogai rule bullet + a primer "stay in the ring" clause (naming `self.x`-vs-edge
  - `self.penalties`/`opponent.penalties`); the **zoner** made ring-aware (both retreat rules gate on
    `self.x ∈ (110000, 490000)` ⇒ rings out 0 — the field-read carrier) and the **sweeper** re-authored as the
    naive over-retreating **victim** (panic-flees a shut-out passive foe ⇒ a decisive `draw → vulture` flip on
    all seeds — decision-10 escalation, since the ring-aware zoner alone leaves zero fires); board rebalanced via
    the zoner-guard lever (δ 30000 → 10000) to keep all 6 ∈ `[25,75]` (vulture 73, grappler 60, sweeper 60, rekka
    41, zoner 35, jabber 31); `gauntlet-calibration.test.ts` gains the **fires** + **field-read** guards (each
    with a "guard bites" companion + a directional matrix pinning the test-local near-edge predicate); dogfood
    18W/102L unchanged; `docs/benchmark-gauntlet-v15.md` added (`v14` kept intact). **PR 3 (#149, CLI read-out)**,
    VERSION-NEUTRAL: `BenchmarkResult` gains an `officiating` tally (`endedBy` per `endReason` + a bot-centric
    `jogai: { bot, opp }` split) that the CLI renders under the headline — `ended: gap N / time N / senshu N /
overtime N   jogai fouls: bot=N opp=N`; ranking keys untouched (decision 7), no `INPUT_HASH` change,
    `npm run fight` byte-identical. 1099 tests; PR 2 `benchmark-config.ts` mutation 100%, PR 3 `benchmark.ts` +
    `run-benchmark.ts` mutation 100% (188/188). Design trail: `docs/archive/jogai-benchmark-adoption.md` (shared
    decisions in `plans/item3-officiating-adoption-decisions.md`). **The jogai adoption is COMPLETE; passivity
    (v16) + overtime (v17) remain deferred under item 3.**
- DONE (**passivity benchmark + spec adoption — item 3 (passivity slice), v16, PRs #151–#153**): folds the built
  §7 **passivity** (non-engagement clock ⇒ yame-style reset + shared category-2 penalty, Capability B) into the LLM
  benchmark's frozen manifest, teaches it in `docs/spec.md` (taught == scored), and CI-locks that it is **exercised**
  and **field-read** on the gauntlet — the second of the three deferred officiating mechanics (overtime still pending).
  The mechanic + its `FightResult.fouls.*.passivity` telemetry shipped in Capability B / the jogai PR #147, so this is
  a **scoring-config flip + prose + a CLI read-out — NO engine/DSL/TCB change** (`npm run fight` byte-identical
  throughout). **Structural finding (a durable item-3 lesson, distinct from jogai):** a **decisive** passivity fire is
  infeasible on the all-aggressive frozen roster — a passivity foul needs ~480 idle ticks (2× the limit) in a CLOSE
  bout, but 480/600 idle ticks lose on points regardless ⇒ not close ⇒ not decisive; jogai's ring-out is naturally
  decisive (it hands a point directly), passivity is slow + self-defeating. So the "fires" bar was **relaxed to
  EXERCISED** (user-confirmed): a real bot CONFERS a penalty point (≥2 passivity fouls in a bout), with
  conferral-decisiveness left proven by the Capability-B engine unit tests. **Two PRs + close-out. S1 (#151, the atomic
  v16 flip)**: `MATCH += passivity: { limit: 240 }`, `BENCHMARK_VERSION v15 → v16`, `INPUT_HASH` re-pinned;
  `generateSpec` gains a gated passivity rule bullet + a primer "don't stall" clause (naming `self.passivityRemaining`
  - `opponent.passivityRemaining`); the **jabber** made the field-read carrier (a `self.passivityRemaining > 0 AND ≤ 10`
    last-ditch re-engage — the `> 0` lower gate excludes the **sentinel-0 that reads when passivity is OFF**, keeping the
    rule inert off-benchmark) and the **vulture** shaped into the standoff **victim** (an `attackBand == 0 ∧ distance >
200000 → idle` rule ⇒ commits ≥2-foul conferring bouts); the calibration lock gains the **exercised** + **field-read**
    guards (each with a "guard bites" companion), all 6 ∈ `[25,75]`, and the v15 jogai fire re-verified to SURVIVE the
    pooled ladder; dogfood re-pinned 18W → **13W/107L** (the re-authored jabber + vulture flip those two matchups);
    `docs/benchmark-gauntlet-v16.md` added. **Calibration finding:** `limit 120` mis-flagged the jabber's legitimate
    patient counter-game (its only non-turtle win is out-pointing the zoner by blocking — exactly what passivity punishes);
    **240** self-calibrates the board while a pure turtle still fouls 80× (user-confirmed). **S2 (#152, CLI read-out)**,
    VERSION-NEUTRAL: the `OfficiatingTally` gains a bot-centric `passivity: { bot, opp }` split rendered alongside the
    jogai one — `… jogai fouls: bot=N opp=N   passivity fouls: bot=N opp=N`; ranking keys untouched, no `INPUT_HASH`
    change, `npm run fight` byte-identical. 1108 tests; S1 `benchmark-config.ts` mutation 100%, S2 `benchmark.ts` +
    `run-benchmark.ts` mutation 100% (0 survivors — mirror idle-vs-attacker fixtures kill the accumulator + attribution
    mutants). Design trail: `docs/archive/passivity-benchmark-adoption.md` (shared decisions in
    `plans/item3-officiating-adoption-decisions.md`). **The passivity adoption is COMPLETE; only overtime (v17) remains
    deferred under item 3.**
- DONE (**overtime benchmark + spec adoption — item 3 (overtime slice), v17, PR #154 — CLOSES ITEM 3**): folds the
  built §7 **overtime** (_encho-sen_ sudden death ⇒ one `ticks 300` period, first to a 1-point gap, Capability C2)
  into the LLM benchmark's frozen manifest, teaches it in `docs/spec.md` (taught == scored), and CI-locks that it
  both **fires** and is **field-read** on the gauntlet — the **last** of the three deferred officiating mechanics, so
  **item 3 is now COMPLETE** (jogai v15 + passivity v16 + overtime v17). The **thinnest** of the three: the mechanic,
  `endReason:"overtime"`, and the `OfficiatingTally.endedBy.overtime` bucket all shipped in Capability C2 / the jogai
  read-out, so this is a **scoring-config flip + prose + one bot rule — NO engine/DSL/TCB change** (`npm run fight`
  byte-identical), one **atomic PR** (unlike jogai's telemetry PR / passivity's CLI PR — neither needed here).
  **Structural finding (distinct from passivity):** overtime is **inherently decisive** — it resolves an
  otherwise-level bout — so the clean `endReason:"overtime"` "fires" bar holds, NO passivity-style "exercised"
  relaxation. **The v17 flip**: `MATCH += overtime: { ticks: 300 }`, `BENCHMARK_VERSION v16 → v17`, `INPUT_HASH`
  re-pinned; `generateSpec` extends the win-condition cascade to `winGap → overtime → senshu → draw` + a primer
  sudden-death **all-in** clause (naming `clock.overtime`), both gated on `match.overtime`; the **jabber** made the
  field-read carrier (**MULTI-READS** — a `clock.overtime == 1 ∧ distance ≤ 260000 → shuto` all-in ALONGSIDE its
  passivity re-engage; inert in regulation ⇒ perturbs only OT bouts, near-zero band risk); the calibration lock
  gains the **fires** (≥1 board bout ends `endReason:"overtime"`) + **field-read** (jabber reads `clock.overtime`)
  guards, each with a "guard bites" companion; dogfood record **unchanged** (13W/107L — one bout enters OT, winner
  unchanged, net −1786 → −1785); `docs/benchmark-gauntlet-v17.md` added. **Measured (no victim shaping needed —
  natural fires):** the frozen board yields **7 overtime bouts**, all resolve on a 1-point gap (none exhaust to
  senshu), **5 flip the winner** vs senshu; all 6 ∈ `[25,75]` (rekka 61, sweeper 60, grappler 52, jabber 47, zoner
  40, vulture 40 — the flips shift the grappler↔vulture level bouts from grappler to vulture). 1114 tests;
  `benchmark-config.ts` mutation 100%, `gen-spec.ts` 99.46% (**0 survivors in the new overtime lines** — the 2 new
  ones killed + 2 pre-existing primer survivors bonus-killed; the 3 remaining are pre-existing & production-equivalent
  since `MATCH` always carries every key). Design trail: `docs/archive/overtime-benchmark-adoption.md` (+ the now-archived
  shared decisions `docs/archive/item3-officiating-adoption-decisions.md`). **Item 3 (the deferred jogai / passivity /
  overtime officiating adoption) is now fully CLOSED.**
- DONE (**air-actions — the last combat capability**, PRs #158–#167): the fighter leaves the ground.
  Built `grill-me → story-splitting → find-gaps → planning → TDD`, PR-per-slice, across four stories.
  **Story 1 — aerial mobility** (#158): `Rules.jumpXSpeed?` + a `vx` on the airborne state; `advance`
  applies `x = clamp(x + vx, 0, width)` each airborne tick, so a horizontal `jump dir` finally
  **displaces** (validated-but-inert since C4). **Story 2 — air strikes** (5 slices, #159/#161/#162/
  #163/#164): the `air-attacking` MoveState merges the airborne arc with an attack — two clocks
  (`x+=vx`/`y+=vy` AND move `elapsed++`), landing is master (converts to a grounded recovery past the
  active window ⇒ one strike per jump); intake routes an airborne `attack` (the one commitment
  exception alongside cancel) with a typed `wrong-context` degrade + air-commit `spend`/`gasRecovery`
  (a bare jump costs 0 stamina); three `|| air-attacking` widenings make the strike **perceivable**
  (`frameOf`), airborne for the whole arc (`postureOf`) and un-grabbable (`computeThrow`) — block /
  parry / trade / okizeme-finish all emergent on the C5 union (`computeStrike` already handled it);
  the **single version-bump slice** (#163, **v17→v18**) wires the canonical `tobi-geri`
  `{ startup 4, active 3, recovery 14, score 2, scoreByBand {high 3, mid 2}, reach 250000, bands
[high,mid], staminaCost 50, air:true }` + `jumpXSpeed 10000` into `CANONICAL_RULES` (the ~7-tick arc
  IS the tell, so `startup 4 < lAct+1` is intentional; a no-Pareto `air`-island keeps it incomparable
  with ground); the reads-only readers slice (#164, no bump) adds 8 `rule("moves.tobi-geri.*")` +
  `jumpXSpeed` leaves. **Story 3 — precise air timing** (#165, no bump): `self.y` (live height, on the
  fighter) + `self.vy` (`(airborne||air-attacking) ? st.vy : 0`; sign = motion, sentinel 0 grounded)
  close the air-perception surface (`self.posture` shipped in Story 2). **Story 4 — the gauntlet
  exercises aerial combat** (3 slices, #166/#167 + this close-out): a characterization pins that a
  **connecting** air strike zeroes the passivity clock (engagement) while a bare / whiffed one does not
  — emergent, no engine change (#166); then rekka's reachable-but-dormant `tobi-geri` jump-in is
  **weaponized** (jump gate `300000 → 250000`) so it connects for a jodan ippon in **100/100** of its
  bouts, locked by a new **tobi-geri adoption lock** + **v18→v19** bump (#167 — board
  37/59/40/64/60/40, all 6 ∈ `[25,75]`, every officiating lock still green, coverage 12/12);
  `docs/benchmark-gauntlet-v19.md` records the board. 1211 tests; each mechanic slice byte-identical
  absent its config, mutation 100% on changed regions (S1 air path 2 documented equivalents; the
  tobi-geri lock's move-specificity clause is equivalent-for-rekka — ground scores credit on idle
  frames, only tobi-geri re-emits its attack action through the arc). **TCB untouched throughout** (no
  new host / network / fs / time / randomness op). **Air-actions is COMPLETE — the last combat
  capability; only the platform layer (KotH ladder / HTTP API / Pixi viewer) remains unbuilt.**

- DONE (**platform HTTP API — S1 (`GET /spec`), PRs #171–#174**): the **first platform-layer
  feature** (the combat tree is complete). A greenfield Vercel deployment serves the engine's
  self-describing bot-authoring spec at **`https://modelkombat.club/spec`** — the front door of the
  online LLM bot-authoring loop. Built `grill-me → story-splitting → find-gaps → planning → TDD`,
  PR-per-slice, across four slices. **Slice 1 — `GET /spec` live** (#171): a Vercel serverless
  function `api/spec.ts` (Web-standard `fetch` handler, **no `@vercel/node` runtime dep**) imports
  `generateSpec()` from `src/` (NodeNext ESM) and returns it as `text/markdown`; non-GET → `405`
  RFC 9457 `problem+json`; a dedicated `tsconfig.api.json` extends typecheck over `api/`. **Slice 2
  — game overview** (#172): a version-neutral `## What ModelKombat is` intro in `generateSpec()` so
  a cold model learns the domain (an LLM writes a data-not-code bot → WKF match on points → scored
  vs a frozen gauntlet, no feedback loop) before the DSL mechanics — trimmed to the
  authoring-relevant minimum (no render flavor / engine internals). **Slice 3 — serve-time API
  envelope** (#173): the handler appends a `## API endpoints` block listing only LIVE endpoints
  (S1: just `GET /spec`) as absolute URLs derived per-request (`x-forwarded-host` / `-proto` behind
  Vercel's proxy, else the request origin) — composed at serve time so it stays OUT of the
  byte-hashed, drift-tested core (no dead URLs advertised). **Slice 4 — `model` provenance field**
  (#174): an optional inert `model?: string` on `BotDoc` (what authored the fighter, 1..64 chars
  when present) — validated like `name`, **never read by the interpreter** (determinism-safe,
  invariant #1) and adding **no DSL op** (TCB untouched, invariant #2). 1232 tests; mutation 100% on
  changed regions; every spec change keeps `INPUT_HASH` / `BENCHMARK_VERSION` unchanged (the spec is
  not a scoring input, and the 6 frozen `bots/*.json` stay without `model`). **S1 (`GET /spec`) is
  COMPLETE.** Design source of truth: `plans/platform-http-api-{decisions,stories}.md`; the finished
  S1 plan is archived at `docs/archive/platform-http-api-s1-spec.md`. Remaining platform work: **S2
  `POST /validate`**, **S3 `POST /fight`** (gauntlet gate → title fight vs the version-scoped KotH
  throne), the **KotH ladder** (stateful), and the **Pixi viewer**.
- DONE (**platform HTTP API — S2 (`POST /validate`), PRs #176–#177**): the validator gate — the online
  loop's second endpoint, letting an LLM author pre-check a bot document **without spending a fight**.
  Pure transport over the engine's TCB: the handler composes `safeParse` (prototype-pollution-safe
  intake) + `validate` (the allowlist validator) **directly** — not `parseBotDoc`, which flattens every
  failure into one issue list and so can't drive per-failure HTTP status — so there is **no DSL op and
  the TCB is untouched** (invariant #2). Errors are RFC 9457 `application/problem+json`. Two slices.
  **Slice 1 — the walking skeleton** (#176): `api/validate.ts` (Web-standard `fetch` handler, **no
  `@vercel/node` dep**) + a `vercel.json` rewrite → `200 {ok:true}` (valid) · `422 /problems/invalid-bot`
  carrying an `errors` member = the validator's `{path,reason}` issues **verbatim** (structurally invalid,
  incl. a forbidden-key prototype-pollution reject) · `400 /problems/malformed-request` (unparseable JSON)
  · `405 /problems/method-not-allowed` + `Allow: POST` (non-POST); `GET /spec` advertises `POST …/validate`
  via a new `LIVE_ENDPOINTS` row (still no `/fight`). **Slice 2 — transport hardening** (#177): an over-cap
  body → `413 /problems/payload-too-large` via a single pre-`safeParse` guard reusing the engine's exact
  `text.length > LIMITS.maxBytes` predicate + constant (one boundary, no second magic number). **Decision 2
  revised to parse-first — 415 dropped**: empirically a header-less `fetch` auto-sends `text/plain` and
  `curl -d` sends form-urlencoded, so a content-type gate would `415` the two most common JSON-posting
  clients and contradict the curl smoke test; `/validate` therefore does not gate on content-type (a valid
  JSON body is accepted on its merits regardless of declared type). 1240 tests; mutation **100%** on
  `api/validate.ts` (44/44) + the `api/spec.ts` envelope diff; typecheck (base + `tsconfig.api.json`) / lint
  / format clean. Every change keeps `INPUT_HASH` / `BENCHMARK_VERSION` unchanged (the endpoint is not a
  scoring input; the `docs/spec.md` drift test stays green). Design source of truth:
  `plans/platform-http-api-{decisions,stories}.md`; the finished S2 plan is archived at
  `docs/archive/platform-http-api-s2-validate.md`. **S2 (`POST /validate`) is COMPLETE.** Remaining platform
  work: **S3 `POST /fight`** (gauntlet gate → title fight vs the version-scoped KotH throne), the **KotH
  ladder** (stateful), and the **Pixi viewer**.
- DONE (**platform HTTP API — S3 (`POST /fight`), PRs #178–#181**): the **stateless gauntlet gate** —
  the online loop's compute endpoint. An LLM author POSTs a bot and learns, in one synchronous response,
  whether it **cleared the frozen gauntlet** (won `> 0.5` vs each of the 6 members) plus a compact,
  leak-free per-member report to iterate on. Pure transport + orchestration over the already-built TCB
  (invariant #2 — **no DSL op, `dsl.ts` untouched throughout**): the handler runs the canonical
  `benchmark()` over the frozen manifest (`SEEDS` [1..10], `MAX_TICKS` 600, `MATCH`, `GAUNTLET_NAMES`,
  `BENCHMARK_VERSION` "v19", `CANONICAL_RULES`) and reshapes the result. Four slices. **Slice 1 — walking
  skeleton** (#178): `api/fight.ts` + a pure `src/http/fight-report.ts` reshaper + the gate predicate
  `cleared` ⇔ **every one of the 6 `GAUNTLET_NAMES` present in `perOpponent` AND won `> 0.5`** (strict;
  a byte-clone skipped by `benchmark()`'s no-mirror rule is absent ⇒ can never clear). The RFC 9457
  envelope (`problem()` + `readValidatedBot()`) is **extracted into a shared `src/http/` module**
  (DRY-by-knowledge, the S2-deferred trigger) and `api/validate.ts` rewired to consume it — behavior
  unchanged (its suite is the characterization guard). Error paths byte-identical to `/validate`
  (405+Allow / 413 / 400 / 422+errors, parse-first). Deployed **unadvertised** (reachable at `/api/fight`
  for dogfood; no `/spec` row, no `/fight` rewrite yet). **Slice 2 — per-opponent `endReasons`** (#179):
  `OpponentScore.endReasons: EndReasonTally` (`{gap,time,senshu,overtime}`) tallied in `summarize()` +
  surfaced per report entry, so the author sees HOW each matchup ended; refactor extracted
  `tallyEndReasons` shared by `summarize` + `tallyOfficiating` (a new endReason would force both inits
  in lockstep — genuine knowledge dedup). **Slice 3 — `diagnostics.degrade`** (#180): `benchmark()`
  aggregates the **submitted bot's** degraded frames (both sides × all seeds × all opponents) into
  `BenchmarkResult.degrade: DegradeTally` (`unaffordable`/`out-of-band`/`locked`/`inert`/`wrong-context`)
  — the highest-signal coaching line ("your kicks were `locked` N frames"); a per-key hand-sum masked
  mutants, so it was reworked to a flat reason-list roll-up (`botDegradesOf` null-skipping + `tallyDegrade`)
  that makes every arithmetic + null-skip mutant killable. **Slice 4 — harden & go public** (#181): the
  `POST /fight` row added to `LIVE_ENDPOINTS` (so `GET /spec` advertises it) + the `/fight` → `/api/fight`
  public rewrite, gated on a **per-IP rate-limit (20 req/min, Vercel platform WAF** — a soft brake against
  title-variance-farming, applied out-of-band on the account + smoke-checked; the PR merge was HELD until
  the rule was live, so `/spec` never advertised an unprotected endpoint). Slices 2–3 add **additive,
  version-neutral** result fields (result shape, not a scoring input) ⇒ `INPUT_HASH` / `BENCHMARK_VERSION`
  unchanged and the `benchmark-config.ts` guard + `docs/spec.md` drift test stay green throughout. 1259
  tests; mutation 100% on changed regions each slice (`fight-report.ts`, the `benchmark.ts` tallies,
  `api/spec.ts` 49/49). Design source of truth: `plans/platform-http-api-{decisions,stories}.md`; the
  finished S3 plan is archived at `docs/archive/platform-http-api-s3-fight.md`. **S3 (`POST /fight`) is
  COMPLETE.** Remaining platform work: the **KotH throne + ladder** (stateful) and the **Pixi viewer**.
- DONE (**platform HTTP API — S4 (the version-scoped KotH throne), PRs #184–#188**): the **first stateful
  platform piece** — a challenger that clears the gauntlet earns a **title shot**, and winning a fresh-seeded
  title fight against the reigning champion **crowns** it King. Transport + orchestration + a platform-layer
  store adapter over the already-built engine (invariant #2 — **no DSL op, `dsl.ts` untouched throughout**);
  the `title` block is a response field, not a scoring input ⇒ `INPUT_HASH` / `BENCHMARK_VERSION` ("v19")
  unchanged. Five slices, each RED→GREEN→MUTATE→REFACTOR, PR per slice. **S1 — the stateful walking skeleton**
  (#184): the `ThroneStore` port (`read` + `compareAndSwap`) + in-memory fake (`src/http/throne-store.ts`),
  the injectable `handleFight(req, deps)` seam (`src/http/handle-fight.ts`), `api/fight.ts` rewired to a thin
  prod wire, and the empty-throne **bootstrap crown** (`title.outcome: "throne-empty-crowned"`, `generation 1`
  plus one lineage entry). **S2 — the title fight** (#185): an occupied throne triggers a 20-bout fresh-seeded
  `benchmark({ gauntlet: [champion] })`; dethrone iff top-level `winRate > 0.5` (the singleton gauntlet makes
  it the head-to-head rate), else `king-retained`; a mirror clone → `winRate 0` → retained. Fresh seeds are
  Web-Crypto entropy at the transport layer, recorded so the title fight replays byte-identically (invariant #1
  intact). **S3 — atomic CAS** (#186): concurrent crownings serialize through one `crown()` helper on an opaque
  monotonic `generation` — a lost race returns `409 /problems/throne-moved` (RFC 9457, shared envelope); the
  throne ends holding exactly one winner. **S4 — incumbent identity + author handle** (#187): `title.incumbent` (the King's `name` / `model` / `handle` — identity only, **never** the champion doc) lets a challenger scout the King; the
  optional `X-Author-Handle` header (≤ 64, control-chars → `400` via a code-point predicate — undici Headers
  already block NUL/CR/LF, so the guard covers DEL + the other C0 controls) is persisted into the crown record.
  **S5 — durable Upstash Redis** (#188): `upstashThroneStore` behind the same port over the Upstash REST API via
  raw `fetch` (**no SDK — `dependencies` stays `{}`**), one atomic Lua `EVAL` doing compare-generation + `SET`
  pointer + `RPUSH` lineage; an error reply **THROWS, never read as "empty"** (a transient failure must not let a
  challenger bootstrap-crown over a live King); `selectThroneStore(env)` at the composition root picks the durable
  store iff both `UPSTASH_*` vars are set, else the in-memory fake. A shared `runThroneStoreContract` spec pins
  the port for both stores (fake in the ordinary suite; live Upstash in an env-gated smoke on throwaway UUID keys plus cleanup — live Redis is not exercised in CI). 1311 tests; mutation 100% on the changed regions each slice
  (`handle-fight.ts`, `throne-store.ts`, `throne-store-upstash.ts`, `throne-store-select.ts`). Design source:
  `plans/platform-http-api-{decisions,stories}.md`; the finished S4 plan is archived at
  `docs/archive/platform-http-api-s4-throne.md`. **S4 is CODE-COMPLETE.** _Live-durability verification
  (provision the Upstash Marketplace integration on Vercel so the env vars land, then run the env-gated smoke
  against the deploy) is a dashboard action, not repo code — until then prod runs the in-memory fake fallback._
  Remaining platform work: the **KotH ladder** (multi-champion / tournament bracket beyond the single throne),
  **`/replay`** + a champions-history read surface, and the **Pixi viewer**.

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

1. **Batch-1 grounded arsenal expansion — ✅ COMPLETE (6/6)** — the real-karate move roster
   (`docs/move-roster.md`: balance law + 6 resolved frame blocks), one PR per technique. All shipped:
   **`uraken`** (#117 → v5, #118), **`shuto`** (#120 → v6, #121), **`yoko-geri`** (#123 → v7, #124),
   **`ushiro-geri`** (#126 → v8, #127), **`empi`** (#129 → v9, #130), and **`hiza-geri`** (#132 → v10,
   #133) — each a wiring PR (bumps `BENCHMARK_VERSION` via the `INPUT_HASH` flip) + a reads-only
   `rule()`-readers PR (no bump). **The roster-wide no-Pareto-dominance + distinctness property is
   now SHIPPED too** (PRs #145–#146 — a test-local guard over the full 12-move roster on the 7
   strategic axes; see the build-log entry above), so the Batch-1 arsenal is **fully closed out**.
   Air (`tobi-geri`) is Batch 2, gated on the unbuilt air-strike capability (item 5).
2. **Gauntlet modernization + rebalance — ✅ COMPLETE (v14, PRs #135–#143).** Re-authored the
   frozen gauntlet one bot per PR until all 6 landed in `[25%,75%]` AND the roster collectively
   exercised the full 11-move arsenal, then CI-locked both. **S1 `vulture` parry→counter (v11)**
   fixed the low tail (16 → 60%) and pulled `sweeper` 82 → 67% via the coupling (knocking `jabber`
   28 → 19%); **S-jabber block+counter (v12)** restored `jabber` 19 → 31%; **S2 `zoner` (v13)**
   added `yoko-geri` + `ushiro-geri` narrow-gated ("no healthy niche"); **S3 `grappler` (v14)**
   wove in `empi` + `hiza-geri` okizeme as full real integration ⇒ coverage 11/11; **S4 (v14, PR
   #143)** landed the calibration lock (`src/cli/gauntlet-calibration.test.ts`: band + coverage
   guards) + LF-pinned the bot texts for a byte-stable `INPUT_HASH` — a certification pass, no
   scoring change. **Final board (all 6 ∈ `[25,75]`):** vulture 68, sweeper 67, grappler 58, rekka
   41, zoner 35, jabber 31; coverage 11/11. Record: `docs/benchmark-gauntlet-v14.md`; design trail:
   `docs/archive/gauntlet-*.md`. **Durable findings:** the coupled round-robin can't be
   precision-dialed (band = dispersion, mean pinned ~50%); niche moves conflict with tight
   calibration (S2 far kicks narrow-gated; S3 close moves fed `vulture`'s parry→counter until the
   throw kept the contact band — distinguish by range, not read, as no guard tell exists).
3. **Deferred officiating benchmark + spec adoption — ✅ COMPLETE (item 3 CLOSED).** Capability D
   was scoped to senshu only; folding the remaining officiating mechanics into the benchmark `MATCH`
   (+ `INPUT_HASH` / `BENCHMARK_VERSION`) and teaching their prose in `generateSpec` was deferred
   (each forces its own gauntlet re-characterization / possible rebalance). All three now shipped,
   one PR-slice each: **jogai (v15, PRs #147–#149)** — ring-aware zoner + naive-victim sweeper;
   **passivity (v16, PRs #151–#153)** — jabber field-read carrier + vulture standoff victim, limit
   240, "fires" relaxed to EXERCISED; **overtime (v17, PR #154)** — jabber multi-reads
   `clock.overtime`, `overtime.ticks = 300`, 7 natural fires (no victim shaping), inherently
   decisive. See the build-log entries + the archived design trail
   (`docs/archive/{jogai,passivity,overtime}-benchmark-adoption.md`, and the shared decisions
   `docs/archive/item3-officiating-adoption-decisions.md`). **Item 3 is fully closed.**
4. **Rest of §7 — rounds — ✅ RESOLVED BY REFRAME (no engine work).** `docs/DESIGN.md`
   §7 established that **WKF kumite is single-round** and dropped **best-of-N** as a
   non-WKF import. The genuine gap — _breaking a level bout at the time cap_ — was
   reframed as **tie resolution**, which is fully **built** (Capability C: senshu C1 /
   sudden-death overtime C2 / senshu perception C3, PRs #104–#110) and **adopted** into
   the benchmark (senshu `v4`/Capability D, overtime `v17`/item 3). So there is no
   engine-level "rounds" mechanic left to add. The only WKF-authentic sense of "rounds"
   still unbuilt is the **tournament bracket** — that is the **KotH ladder** in the
   platform layer below, not a §7 combat piece.
5. **Air-actions — ✅ COMPLETE (the last combat capability, PRs #158–#167).** The fighter
   leaves the ground: horizontal jump displacement (`jumpXSpeed` + `vx`, Story 1); the
   `air-attacking` strike mechanic + air defense + the canonical `tobi-geri` jump-in
   (Story 2, **v18**); the `self.y` / `self.vy` / `self.posture` air-perception surface
   (Stories 2–3); and the gauntlet weaponization that makes the frozen board actually
   **exercise** aerial combat (Story 4, **v19** — rekka's jump-in connects 100/100 for a
   jodan ippon, all 6 ∈ `[25,75]`). Unblocked + shipped Batch 2 of the arsenal (`tobi-geri`,
   item 1). See the build-log entry above; board `docs/benchmark-gauntlet-v19.md`; design
   trail archived under `docs/archive/` (`aerial-mobility`, `air-strikes`,
   `precise-air-timing`, `air-actions-{decisions,stories}`, `gauntlet-aerial-rebalance`).
6. **Platform HTTP API — 🏗️ IN PROGRESS; S1 (`GET /spec`) + S2 (`POST /validate`) + S3 (`POST /fight`) +
   S4 (the version-scoped KotH throne) ✅ COMPLETE (PRs #171–#188).** The first platform-layer feature — the
   online LLM bot-authoring loop's front door, now whole end-to-end: one URL → self-describing `GET /spec`
   (**LIVE** at `https://modelkombat.club/spec`, layered byte-stable core + serve-time API envelope + the
   inert `model?` provenance field) → `POST /validate` (pre-check: `200 {ok:true}` or RFC 9457 `problem+json`,
   parse-first) → `POST /fight` (stateless gauntlet gate: clear the frozen `v19` gauntlet, `> 0.5` vs each of
   6, for a compact leak-free report) → a **title shot vs the version-scoped KotH throne** (S4): bootstrap
   crown → fresh-seeded title fight → dethrone on `> 0.5` (else king-retained), atomic-CAS'd (`409`
   throne-moved), incumbent identity + `X-Author-Handle`, **durably persisted on Upstash Redis** (raw `fetch`,
   no SDK; in-memory fake fallback when `UPSTASH_*` unset). TCB / `INPUT_HASH` / `BENCHMARK_VERSION` ("v19")
   untouched throughout. See the build-log entries above. Design source: `plans/platform-http-api-{decisions,
stories}.md`; finished S1–S4 plans archived under `docs/archive/platform-http-api-s{1,2,3}-*.md` +
   `platform-http-api-s4-throne.md`. **S4 live-durability pending a dashboard action** (Upstash Marketplace
   provisioning + post-deploy smoke). **Next platform work: the KotH ladder** (multi-champion / tournament
   bracket beyond the single throne), **`/replay`** + a champions-history read surface, and the **Pixi
   viewer** — each `grill-me`/`find-gaps` → `planning` → TDD, PR per slice.

**The deep-karate combat tree is COMPLETE, and the platform layer is well underway.** The HTTP API's
**`GET /spec` (S1) + `POST /validate` (S2) + `POST /fight` (S3) + the KotH throne (S4)** are all shipped
(PRs #171–#188; `/spec` LIVE at `https://modelkombat.club/spec`, `/fight` advertised + rate-limited, the
title fight persisted on Upstash Redis). Remaining in the platform layer: the **KotH ladder** (the
tournament-_bracket_ sense of "rounds" beyond the single throne), **`/replay`** + a champions-history read
surface, and the **Pixi viewer**.
