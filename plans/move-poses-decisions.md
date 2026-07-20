# Move showcase & per-move poses — resolved design decisions

Resolved via `grill-me` (2026-07-19). Pre-planning source of truth for the next replay-viewer
arc: giving **each arsenal move its own look**, driven by a move picker in `/dojo`. The
"make it fight" arc is complete + archived (`docs/archive/replay-viewer-fight-*`); this builds
directly on its pose model. Feeds `story-splitting` → `planning` → TDD, **PR per slice**.

## The problem (why we're doing this)

The trigger: `/dojo` shipped as a pose lab, but there is no way to see what an individual
**move** looks like — because the moves do not currently have individual looks.

1. **Move identity never reaches the renderer.** `ReplayFrame` carries `attacking`,
   `attackBand`, `attackReach`, `throwing` — and no move name. So `poseFor`
   (`web/src/pages/replay/scene.ts:197`) can only draw three shapes: a strike (front hand
   `handR` at a band height), a throw (both hands grabbing at chest height), and `PRONE`.
   **Twelve strikes render as one picture**, differing only by band height and how far the
   arm telescopes. A `mawashi-geri` draws as a punch.
2. **A committed move is one frozen pose.** `attacking` is emitted `true` for the _whole_
   committed duration — startup **and** active **and** recovery. A `gyaku-zuki` is 7+3+14 =
   **24 ticks (~0.4 s) held at full extension**, every strike. Strikes read as stiff and
   snapped-out, independent of the identity problem.
3. **The control that looks like it should help, doesn't.** `SpacingControl.tsx:43` already
   renders a 13-move `<select>` — labelled "Reach preset", it only snaps the fighter gap.
   Selecting `mawashi-geri` changes the spacing and nothing else. This is almost certainly
   the control that prompted the arc.

## Facts established during grilling

Load-bearing, and expensive to re-derive:

- **Permalinks are safe.** `replayId` (`src/http/handle-replay.ts:78`) hashes the fight
  _identity_ — `challenger + defenders + seeds + version` — **not the tape**. Adding render
  frame fields cannot change an id.
- **There is no stored tape to migrate.** The server _reconstructs_ tapes on demand from the
  repro record, so archived fights gain new fields automatically and render with the new
  poses. No backfill, no tape versioning.
- **Phase data already exists in the engine.** The `attacking` state carries `spec`
  (startup/active/recovery) and `elapsed` (`src/engine/sim.ts:161-167`) — a few lines from
  where `attackReach` is already read (`sim.ts:285`).
- **Numeric render codes are a _perception_ convention, not a render one.** `BAND_CODE` /
  `POSTURE_CODE` (`sim.ts:211,216`) are numeric because **bots read them** and branch on
  literals (invariant #4, `OpponentView`). Nothing in `RenderFrame` is bot-readable — which is
  why `attackReach` is already a raw number, not a code.
- **`R` joints are the FRONT limbs.** In `STAND`, `handR`/`footR` sit at +x and `handL`/`footL`
  at −x, and local +x is forward.
- **`kizami-zuki` is the lead hand; `gyaku-zuki` is the _reverse_ (rear) hand.** Both currently
  draw with `handR`.

## Resolved decisions

| #   | Decision              | Choice                                                                                                                                                                                                                  | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Scope of effect**   | **Ships to `/watch`** — real replays get per-move poses. Not a lab-only sketchpad. The engine field lands **first, as its own slice**.                                                                                  | `/dojo`'s covenant is "what you tune is what ships" (`dojo-tape.ts:11`) — a lab whose poses never reach a real fight inverts the reason it drives the real pipeline. Tuning moves to look real only pays off if viewers see it. Sketchpad-first would pay the engine cost later anyway, plus rework.                                                                                                                                                                                                                                                                                                                                 |
| 2   | **Field shape**       | **`attackMove: string`** — the `MoveId` verbatim (`"mawashi-geri"`), `""` when idle. Mirrored as `attackMove?: string` web-side and read **defensively** (absent/non-string ⇒ generic pose), per M7.                    | The numeric-code convention belongs to perception, not rendering (see facts). A string keeps granularity in the renderer — distinguishing `yoko-geri` from `mawashi-geri` never costs an engine change. `MoveId` strings are already the vocabulary in `dsl.ts:297`, `rules.ts`, `spec.md`, and **two** web tables. A numeric code would invent a fourth vocabulary to keep in lockstep. Payload cost (~10–35 KB worst case on a `MAX_TICKS: 600` tape) is not a real constraint on a reconstructed-on-demand JSON tape.                                                                                                             |
| 3   | **Pose architecture** | **Descriptor table + one shared solver.** Each move maps to a small record (driven limb, side, bow, …); the shared solver applies it through the existing `reachTargetX` / `deriveBend` / lean machinery.               | The codebase already _is_ this pattern, arrived at the hard way: `deriveBend` (`scene.ts:137`) is one rule shared by arms and legs via a direction flag, and per S4 that shared-rule refactor is what killed the flip-constant mutant. 13 bespoke poses = 13 barely-tested authoring chunks and 13 places to touch when the body scale changes. Mechanically cheap: `footR` is just another endpoint, and the knee re-derives off `hip→footR` for free.                                                                                                                                                                              |
| 4   | **Phase**             | **`attackPhase`** — 3-state code (`0` startup / `1` active / `2` recovery), derived from `elapsed` vs `spec.startup`/`spec.active`, **in the same engine slice**. `attackProgress` (smooth interpolation) **deferred**. | A karate technique fundamentally _is_ wind-up → commit → recover; a pose model that can't express that looks wrong no matter how well the extension frame is authored. We are **certain** the renderer needs phase; we only **suspect** it needs sub-phase interpolation. Marginal cost inside an already-agreed slice is ~zero — the data is in the same object.                                                                                                                                                                                                                                                                    |
| 5   | **Showcase shape**    | **Move picker on the existing stage**, **absorbing** the "Reach preset" dropdown — picking a move poses it _and_ snaps the gap to its true reach. **Contact sheet deferred** to a later slice.                          | Tuning needs one big figure, the sliders beside it, and fast switching. A contact sheet serves _comparison_, which is worthless until poses differ — build it today and you get a grid of 13 identical stickmen. Built after 4–5 moves, it immediately earns its keep (catches "the side kick and back kick read the same").                                                                                                                                                                                                                                                                                                         |
| 6   | **Control semantics** | **Write-through.** `attackMove` becomes one more per-figure raw control; selecting stamps `attackBand` + `attackReach` + gap, then lets go. Every slider stays live. Gap snap is **last-write-wins**.                   | M10 free-combos is a documented covenant (`controls.ts:3-6`) and the engine-impossible combos are where the pose model's edges show — exactly what limb-driving moves will stress. The deviations are the useful part ("does the roundhouse read at high band? at point-blank?"). It is also the idiom already in the file (`SpacingControl.tsx:30-34`).                                                                                                                                                                                                                                                                             |
| 7   | **Arc scope**         | **All 13 moves, offense only.** Includes `throw`, `sweep`, `tobi-geri`. **Defense / uke explicitly deferred** to a later arc.                                                                                           | A picker with 13 entries where three do nothing recreates the original disappointment. Those three are the cheapest in the set (`throw` has a look, `sweep` has `PRONE`, `tobi-geri` composes with `AIR`). Defense is a genuinely separate axis — `DESIGN.md`'s technique-specific _uke_ is a parallel arsenal with its own read-game semantics and its own engine question; folding it in roughly doubles the arc.                                                                                                                                                                                                                  |
| 8   | **Slicing**           | **Walking skeleton → by family.** Slice 2 = picker + descriptor mechanism + **`mae-geri`** fully phased. Then kicks → punches → close → special.                                                                        | By-phase is the horizontal split `story-splitting` exists to prevent. The first slice's job is to **prove the architecture**, which argues against the tempting `gyaku-zuki`: driving a hand through `reachTargetX` is precisely what the code already does, so it would finish green with zero new information. The riskiest assumption is that a **foot** drives through the same solver. `mae-geri` is mid-only (no band matrix) and a straight thrust (no arc), so it tests that risk alone.                                                                                                                                     |
| 9   | **Test discipline**   | **Assert the relation, not the literal.** The descriptor table owns the tuned numbers and is free to change without touching a test. Table tested for shape/coverage, not values. Manual `/dojo` sign-off stands.       | Today `controls.test.tsx:114` pins `x: 24` — `STRIKE_FLOOR_X`, whose own comment says "tuned by eye in /dojo" (`scene.ts:302`). So **tuning breaks tests**; at 13 moves × 3 phases that friction is what makes people stop tuning. Pose constants mirror nothing external — pinning them asserts "the tuning is what it currently is", which is a snapshot of an opinion, not a behavior. Well-chosen relations still kill the mutants that matter (wrong limb, wrong direction, phases collapsed, support leg dragged). A 47→52px drift is not a bug — it is the ambiguous-value case the TDD workflow already routes to the human. |
| 10  | **Table sprawl**      | **Keep the three web move tables separate**; add **one key-set coverage test** asserting `reach-presets.ts`, `Arsenal.tsx` and the new descriptor table cover exactly the same move ids.                                | Decision 9 gives engine-mirror and aesthetic values **opposite** test disciplines — merging puts both on one structure and the pressure is to apply the looser one, which is how the reach mirror quietly stops being pinned. Merging in `Arsenal.tsx` also drags home-page editorial copy into the render path. The real risk is **membership** divergence, and one test catches it.                                                                                                                                                                                                                                                |

## Resolved mechanics (find-gaps, 2026-07-19)

Decisions that tighten the table above into something implementable without re-asking.

- **M1 — `attackPhase` encoding (`0` = none, mirroring the band codes).** `0` idle / `1`
  startup / `2` active / `3` recovery. The Q4 sketch used `0` for startup, which collides with
  the `0 = none` convention every other render code follows (`attackBand`, `guardBand` —
  `sim.ts:248-251,280`): an idle fighter would carry `attackPhase: 0` and read as "winding up".
  Mirroring the band codes means an idle fighter reads `0` for **every** action code, and no
  consumer needs `attacking` as a validity gate to interpret the field.

- **M2 — `attackMove` vocabulary + per-state coverage (TOTAL).** The field speaks the **13-id
  web vocabulary**: `MoveId | "sweep" | "throw" | ""`. Note `MoveId` has only **11** entries
  (`types.ts:38-49`) — `sweep` and `throw` are separate `Action` types (`types.ts:60-61`), so
  the arsenal's "13 moves" is 11 + 2, exactly as `Arsenal.tsx:40` and `reach-presets.ts`
  already have it. Emitting those two as ids keeps **one uniform lookup**
  (`DESCRIPTORS[frame.attackMove] ?? GENERIC`) across the descriptor table and both existing
  web tables. Extending the engine's `MoveId` union instead was **rejected**: `MoveId` is
  bot-facing (bots write `{type:"attack", move}`, `dsl.ts:297` allowlists it, `docs/spec.md`
  publishes it), so it would change the bot API and contradict "spec.md is untouched".

  Every `MoveState` emits both fields, TOTAL — no state left undefined:

  | `MoveState`                  | `attackMove`               | `attackPhase`                |
  | ---------------------------- | -------------------------- | ---------------------------- |
  | `neutral`                    | `""`                       | `0`                          |
  | `attacking` (attack action)  | the `MoveId`               | from `spec` + `elapsed`      |
  | `attacking` (sweep action)   | `"sweep"`                  | from `spec` + `elapsed`      |
  | `air-attacking`              | the `MoveId` (`tobi-geri`) | from `spec` + `elapsed`      |
  | `airborne` (jump, no attack) | `""`                       | `0`                          |
  | `throwing`                   | `"throw"`                  | from `ThrowSpec` + `elapsed` |
  | `downed`                     | `""`                       | `0`                          |

  `air-attacking` and `throwing` are covered by the **same branches `attackReach` already
  has** (`sim.ts:285-290`), so the emit site is one expression, not a new dispatch.

- **M2a — the committed state must first CARRY the move id.** `startAttack`
  (`sim.ts:434`) captures `spec` and `band` but **not which move produced them**, so the id
  is not currently recoverable at the render-frame site. Slice 1 therefore threads a `move`
  id onto `AttackingState` (and the `air-attacking` equivalent) at both call sites — the
  neutral-strike commit and the on-contact cancel. Additive and outcome-neutral (nothing in
  the resolution path reads it), but this makes slice 1 **larger than the `attackReach`
  precedent it is modelled on**: that field was a pure read of data already in the state.

- **M3 — phase → pose: authored chamber, solved extension.** A chambered technique is a
  _different shape_, not a shorter reach (`mae-geri` chambers knee-up with the foot tucked
  under the hip; a punch chambers at the ribs), so scaling the extension down is rejected — it
  reads as a weak kick, not a wind-up. The descriptor authors **one extra point**: the driven
  endpoint's chambered position. Per phase:

  | Phase        | Driven endpoint                                                 |
  | ------------ | --------------------------------------------------------------- |
  | `1` startup  | the authored `chamber` point                                    |
  | `2` active   | `reachTargetX` at the band height — **the solve is retained**   |
  | `3` recovery | the `chamber` point, per-move overridable if the eye demands it |

  Retaining the solve at phase 2 is non-negotiable: a **fixed** authored extension only
  touches at one gap, which is exactly the "strikes visibly hit the air" defect that
  `#344`–`#347` closed. Mid-joints re-derive from the endpoints at every phase (S4), so a
  chambered limb bends correctly for free.

  **Accepted limit:** only the driven endpoint moves, so whole-body kick character — a back
  kick turning away, a roundhouse coming around — is **not** expressible yet. This is the
  arc's carried "arc expressiveness" risk, and it now has a designated landing place: it is
  what forces decision 3's bespoke escape hatch, in slice 3.

- **M4 — `/dojo` shows phases via a multi-tick tape, not a phase control.** `buildDojoTape`
  currently emits a **single tick** (`dojo-tape.ts:26`), so phases 1 and 3 are unreachable and
  slice 2 would be authoring a chamber nobody can look at. Instead the builder spans the
  selected move's **real duration** (`startup + active + recovery` ticks) and the **existing S4
  transport** (`transport.ts` — play/pause, scrub, 0.5/1/2×, frame-step ◀/▶, where `seek`/`step`
  always pause) drives it. `attackPhase` is then **derived from the playhead**, not set by a
  control.

  This subsumes a static phase selector — pause on a startup tick to tune, step forward to
  check the next — and additionally answers the question a still cannot: _does the technique
  read as a movement at true engine timing?_

  Two consequences:
  - **`reach-presets.ts` gains per-move timing** (`startup`/`active`/`recovery`). It stays the
    single **engine-mirror** table — now mirroring frame data, not just reach — pinned
    value-by-value exactly as the reaches are. The descriptor table remains purely aesthetic.
    This _reinforces_ decision 10's split rather than complicating it.
  - **`attackPhase` is the one field that stops being a raw control.** Every other pose field
    keeps its write-through control (decision 6); phase is expressed through the transport
    instead. M10 free-combos is otherwise untouched — an `attacking` fighter with `attackMove`
    `""` still renders the generic fallback pose.

- **M5 — parry-extended recovery is simply a longer phase 3** _(proposed, not asked — object
  if wrong)_. The attacking state carries `extra`, additional recovery ticks accrued when a
  strike is parried (`sim.ts:166`). Phase derivation is `elapsed < startup ⇒ 1`,
  `elapsed < startup + active ⇒ 2`, **else 3** — so the else-branch absorbs `extra` with no
  new state and no special case: a parried fighter simply holds the recovery pose longer.
  **Parked opportunity:** a deflected strike _recoiling_ — a visually distinct 4th phase — is a
  real opportunity this forecloses for now. Deferred, not rejected.

- **M6 — every slice ships live to `/watch`; mixed fidelity is accepted.** No feature flag.
  Each slice is monotonically better than the state before it (today _all 13_ are generic), so
  there is no state in which the arc makes `/watch` worse — only less finished. A flag would
  add a second live render path to maintain for ~5 PRs plus a flip-and-remove slice, to
  protect a route that ships dark (no nav link, #311). Accepted consequence: for several PRs a
  real fight can show a chambered, phased kick against a generic hand-poke.

- **M7 — defaults and TOTAL-ness** _(proposed, not asked — object if wrong)_.
  - `DEFAULT_CHALLENGER_CONTROLS` gains `attackMove: "gyaku-zuki"`, matching the reach it
    already carries (`240_000`) and `DEFAULT_GAP`. `DEFAULT_KING_CONTROLS` gains
    `attackMove: ""` (idle).
  - An `attackMove` with **no descriptor entry** — a move not yet authored (slices 3–6), an
    unknown string off the wire, or `""` — falls back to today's generic pose. One
    `DESCRIPTORS[move] ?? GENERIC` lookup, no throw, no blank figure.
  - A descriptor with **no authored `chamber`** keeps the stance position at phase 1: the
    technique simply doesn't wind up. TOTAL, like the stance/band fallbacks.

- **M8 — the relational assertion floor.** Decision 9 says "assert the relation, not the
  literal", which without teeth degrades into weak tests. Every pose slice asserts at least:

  1. **Driven-endpoint identity** — the move moves the expected joint (`footR` for
     `mae-geri`), and no other _endpoint_ leaves its stance position.
  2. **Support integrity** — the non-driven foot is unchanged from stance (the fighter does
     not slide or float).
  3. **Phase distinctness** — phases 1/2/3 yield pairwise-different driven-endpoint positions
     (kills "phases collapsed into one pose").
  4. **Direction** — the phase-2 endpoint is forward of the phase-1 endpoint (the technique
     extends rather than retracts).
  5. **Solve retained** — two different opponent gaps yield two different phase-2 endpoint
     x values. This is the standing guard against silently regressing M3 back into a fixed
     authored extension.
  6. **Derivation** — the mid-joint lies off the straight endpoint-to-endpoint line at every
     phase (the limb reads jointed, not rigid).

  None of these pin a tuned number, so the descriptor stays free to retune without touching a
  test — while still killing the mutants that matter (wrong limb, wrong direction, collapsed
  phases, dragged support leg, dead solve, rigid limb).

- **M9 — the M2 lean is phase-gated, polarity deferred.** `strikeLean` (`scene.ts:180`)
  currently fires whenever a strike hand exists; leaning fully forward during the _chamber_ is
  wrong (a fighter leans **into** a technique as it extends). The lean is therefore gated to
  phase 2. Its **polarity** stays parked as one of the three questions slice 2 must answer —
  a kick plausibly counterbalances _backward_ rather than leaning in.

- **M10 — placement and a11y** _(proposed)_. The decision-10 key-set coverage test lives with
  the descriptor table (the newest of the three, so the one whose drift is likeliest). The new
  move `<select>` is named via **`aria-labelledby` from a span**, not `<label for>` — the S2
  gotcha that applies to both `<select>` and range `<input>` in this testing stack.

- **M11 — slice 1 must NOT bump `BENCHMARK_VERSION`, and must prove it.** `INPUT_HASH` pins
  `CANONICAL_RULES` + the manifest + each gauntlet bot's scoring content — **not** `sim.ts`
  source — so adding render fields cannot move the hash. But the stated policy
  (`benchmark-config.ts:13-16`) _also_ requires a bump on "any change to the engine outcome
  path (`sim.ts` / the `dsl.ts` interpreter)". `attackMove`/`attackPhase` are render-only and
  read by nothing in resolution, so **no bump is correct** — the same call `guardBand` (#313)
  and `attackReach` (#344) made, and `BENCHMARK_VERSION` has stood at `v19` across both.

  M2a makes this worth asserting rather than assuming: threading a move id onto
  `AttackingState` touches the committed-state type that resolution _does_ read. Slice 1 is
  done when the determinism/replay tests are green **and** `BENCHMARK_VERSION` is unchanged —
  if either fails, the id has leaked into the outcome path and the design is wrong.

- **M12 — the shoulder girdle: two shoulders, and a torso that rotates** _(grilled 2026-07-19,
  after S4 · slice 3's eye-check)_. `Stance` has ONE `shoulder`, so both arms hang off the same
  point and a reverse punch and a jab send their driven hand to the **identical pixel**
  (`417, −429` at the workhorse distance). The entire distinction between them lives in the
  resting hand, and slice 3 shrank that from 63px to 38px by removing the stretch artifact that
  had been accidentally carrying it. This is decision 3's expressiveness limit — the arc's
  stated main technical risk — arriving on **punches** rather than the kicks it was forecast for.

  Resolved, in dependency order:

  | #   | Question                                     | Choice                                                                                                                       | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
  | --- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | a   | Authored or derived?                         | **Derived** — `shoulder` stays as the girdle's midpoint; the ends are `shoulder.x ± SHOULDER_HALF_WIDTH`                     | Touches no authored data, so nothing is re-tuned and `PRONE`'s 11 hand-placed joints stand. Matches how the codebase already handles limb structure (`deriveBend` computes elbows and knees rather than authoring them). Cost: no pose can hunch or square its shoulders independently — no move in the roster needs it.                                                                                                                                          |
  | b   | Does the arm keep its length?                | **Yes — `ARM_BONE` unchanged at 15.65**                                                                                      | Widening someone's shoulders does not shorten their arms. The girdle relocates where an arm _starts_, not how long it is; `ARM_BONE` stops meaning "the bone the stance span implies" and starts meaning "the arm's length". Re-deriving it would shorten every arm 11% and push the reverse punch from 1.6× stretch to 2.05×, making the rubber-band problem worse on the move we are trying to fix. **Visible cost: every resting arm bows 10.7 instead of 8.** |
  | c   | Which arm hangs off which end?               | **Determined, not chosen** — `handR` (front, x +18) off `shoulderR`, `handL` (rear) off `shoulderL`                          | `poseFor` never reads `facing`; the root container flip carries it, so local +x is always forward. No facing dependency.                                                                                                                                                                                                                                                                                                                                          |
  | d   | Where is the lean's shortfall measured from? | **Each arm's own root**                                                                                                      | It is what `rootTravel` already means. Also physically right — the rear hand has further to travel. Separates the two punches at **mid range**, where the arm-span axis is weakest: at a 35px reach a jab stands upright while a reverse punch leans 10.9. Contributes nothing at the workhorse distance, where both cap.                                                                                                                                         |
  | e   | Slide or rotate?                             | **Rotate** — only the _driving_ shoulder moves forward by `lean`; the other stays                                            | See "the slide breaks `hikite`" below. Also what a reverse punch anatomically _is_, and what `Hero.tsx` already draws.                                                                                                                                                                                                                                                                                                                                            |
  | f   | Where does the head go?                      | **Follows the girdle midpoint** — `lean/2`                                                                                   | The only option that follows from the geometry rather than being picked. A torso that rotates _and_ lunges the full 16 is two motions where a body does one. **Cost: 8px of lunge instead of 16 on the most-viewed frame in the product.**                                                                                                                                                                                                                        |
  | g   | What does `PRONE` do?                        | **Both shoulders on its one authored point** — zero-length girdle bone, byte-identical rendering                             | A derived girdle offsets in **x**, but `PRONE` lies _along_ x — applying it would string the shoulders down the spine, one at the neck and one halfway to the hip. Its arms already splay in **y**. Authoring two shoulders for it is more correct and cheap, but it changes a pose we are not otherwise judging; keeping it identical means any visible change to a knockdown is a **bug, not a judgement call**, which makes the sign-off readable.             |
  | h   | What does the draw layer stroke?             | **A girdle bar.** Keep `hip→shoulder` as the spine, add `shoulderL→shoulderR` crossing it, re-root the two arms. Net +1 bone | Otherwise there is a 7px gap at each armpit. It is what `Hero.tsx` draws, and the proportion matches exactly: Hero's girdle is 20 on a 112-unit body (0.18); 7px on our 76px body is 14/76, **also 0.18**. The alternative (forking the spine into a Y) orphans the centre joint, which the head, the lean and many tests still need.                                                                                                                             |
  | i   | Hips too?                                    | **No — shoulders only**                                                                                                      | The girdle separates two moves only when they drive **different limbs**. `mae-geri` and `mawashi-geri` both drive `footR`, so a hip girdle gives them zero separation. It would pay off only if slice 6 authors the roundhouse onto the rear leg (`footL`, a new `StrikeLimb`) — an open decision. Building it now is speculative generality, and it would deepen every knee bow in the same breath as the elbows.                                                |
  | j   | Naming                                       | **`shoulderL` / `shoulderR`**; `shoulder` redefined as the **midpoint**                                                      | The convention already encodes front/rear as L/R (`handR` is the front hand). `shoulderF`/`shoulderR` would make `R` mean "rear" on shoulders and "front" on hands in the same object. Keeping `shoulder` as the midpoint makes "the head follows the midpoint" and "the spine's top" the same fact.                                                                                                                                                              |

  **The slide breaks `hikite` — the finding that reversed (e).** Under a rigid slide both
  shoulders move forward by the lean, so `gyaku-zuki`'s _front_ shoulder sits at `7 + 16 = 23`
  while its pulled fist is authored at `−8`: a span of **34.0** against a 31.3 reach, i.e. the
  stretched line slice 2 spent an eye-pass escaping. To stay legal the fist would have to move
  _forward_, making the pull read **less** on the move whose pull is the whole point. Rotation
  leaves the front shoulder at 7, putting the fist at a comfortable 20.5 and extending the
  reachable envelope back to about **−21** — near the hip, which is where slice 2 authored it
  first, found undrawable, and abandoned for the flank. Rotation is what makes `hikite`
  authorable where karate actually puts it.

  **Consequences to expect, not discover:**

  - **Rotation supersedes S4 · slice 3's hand-ride.** The resting hand's shoulder never moves,
    so the rule becomes "each hand keeps its offset from **its own** shoulder" and the resting
    arm's ride is zero. Slice 3's trailing-hand fix was a workaround for the shared shoulder;
    this removes the cause and the code goes. Slice 3's **derived lean** survives and is
    load-bearing.
  - **~8 existing tests assert `pose.shoulder` at the full `LEAN_CAP` of 16** and will need
    revising to 8 (the midpoint). Same category as the four revised in slice 3.
  - **The neutral figure changes twice over** — deeper elbow bow (b) plus a new horizontal bar
    (h). An idle fighter after this lands is noticeably different from today's.
  - `SHOULDER_HALF_WIDTH` starts at **7** (Hero's 0.18) and is eye-tuned under decision 9.
    Smaller gives more `hikite` room, larger gives more arm-span separation.

- **M13 — the close-range mid-joint strikes: the elbow / knee LEADS** _(grilled 2026-07-20, for
  S5)_. `empi` (elbow) and `hiza-geri` (knee) are the only two moves whose driven point is a joint
  the bend rule currently _computes_ rather than one the descriptor _authors_ — and they invert the
  whole pose model built so far. Every strike to date drives an ENDPOINT and lets `deriveBend`
  compute the mid-joint; these drive the MID-JOINT and the endpoint trails, folded back. They also
  land the arc's structural close-range overlap (S3 · Slice 3's finding): at `empi`'s 95k reach
  against a 240k body the two figures sit **0.40 body-heights apart** and interpenetrate.

  Resolved, in dependency order:

  | #   | Question                          | Choice                                                                                                                                                                                                     | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
  | --- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | a   | The drawn picture                 | **Mid-joint leads, trailing endpoint folds back**: `empi` = shoulder → **elbow (driven)** → fist tucked; `hiza-geri` = hip → **knee (driven)** → foot tucked                                               | The elbow / knee IS the striking surface, so it is the leading point; the forearm / shin points backward. This is the inverse of every strike authored so far, which is exactly what makes them read as their own techniques.                                                                                                                                                                                                                                                                                                                           |
  | b   | Representation                    | **Uniform** — mid-joints become first-class `StrikeLimb`s (`elbowR/L`, `kneeR/L`); one `Map`/`limbFor` lookup; the SAME `reachTargetX` solve at the band; `deriveSkeleton` skips only the driven mid-joint | Keeps decision 3's "one table, one solver, one test discipline" intact rather than forking a second render path for the inversion. The reach math genuinely applies: at `empi`'s 95k the elbow lands ~24 local px forward, stretching the upper arm ~1.6× — the same bounded rubber-band a punch arm already lives with.                                                                                                                                                                                                                                |
  | c   | Trailing endpoint (the fold)      | **Authored relative tuck** — descriptor authors `tuck: Joint` as an offset from the driven joint; `fist/foot = drivenJoint + tuck`                                                                         | Rides rigidly with the driven joint as it drives chamber → extension, so no rubber-band (the scar an ABSOLUTE tuck would reopen — M12b / S2 · Slice 3). Fits the `chamber`/`offHand` authoring idiom. The trailing bone's LENGTH is deliberately not enforced: it folds rather than reaches, so a foreshortened forearm / shin is the correct read.                                                                                                                                                                                                     |
  | d   | Which arm does `empi` drive?      | **`elbowR` (front arm)** — forced by geometry, not aesthetics                                                                                                                                              | At 95k the elbow sits ~24px forward; the front shoulder (+7) spans that in ~1.1× `ARM_BONE`, the rear (−7) in ~2.0× — and with an AUTHORED elbow there is no bend to absorb it, so a rear elbow draws a freak-length upper arm. Front lands cleanly. (Rear would carry the `gyaku-zuki` rotational-power connotation but cannot be drawn here.)                                                                                                                                                                                                         |
  | e   | Which leg does `hiza-geri` drive? | **`kneeR` (front knee)** — a freer choice than `empi`                                                                                                                                                      | Both knees root at the single `hip` (no hip girdle, M12i), so geometry is neutral; only which foot tucks vs plants changes. Front knee up over a planted REAR base reads as a stable clinch knee, and it spreads the three leg techniques across BOTH legs (`mae` front foot, `mawashi` rear foot, `hiza` front knee) — max distinctness for S7.                                                                                                                                                                                                        |
  | f   | Forward-root motion (lean / step) | **Suppressed** — hold the root; `lean` and `step` gate to 0 for a driven mid-joint                                                                                                                         | These are the shortest reaches in the game; the single reaching bone already spans the target at a bounded ~1.4–1.6× stretch (within tolerance), so the lean / step would only shave it — while shoving the torso / hip FORWARD, straight into the overlap S5 exists to confront. Consequence: the girdle stays SQUARE (rotation is `lean`-driven ⇒ 0).                                                                                                                                                                                                 |
  | g   | The close-range overlap           | **Accept it** with rationale + tripwire (no spacing change)                                                                                                                                                | Truthful fighter positions beat faked spacing (the arc's "root x is truthful; compromises are cosmetic" rule since S2 · Slice 3), and clinch range genuinely overlaps — two infighters throwing elbows ARE that close; the driven mid-joint leads INTO the opponent, which is contact. Draw-order is verified at sign-off; **tripwire:** if `/dojo` reads the clinch as a z-fighting BUG rather than infighting, escalate to a bespoke close-range treatment — parked, not pre-built.                                                                   |
  | h   | Slicing                           | **Two** — S5 · 1 `empi` (the mechanism carrier), S5 · 2 `hiza-geri` (the leg branch + reuse)                                                                                                               | Mirrors the arc's rhythm: a walking-skeleton slice proves the risky architecture on one move (S1 `mae-geri`, S4 `gyaku-zuki`), then a reuse slice adds the second and exercises the other branch (S4 `mawashi-geri`). `empi` builds the mid-joint framework end to end; `hiza-geri` adds the LEG-mid-joint routing (driven `kneeR`, `footR` folds, rooted at `hip`, no step) and authors the knee. Isolates the mechanism risk in one revertable PR.                                                                                                    |
  | i   | Test floor                        | **The M8 six, translated to the mid-joint, + a new anti-clobber guard**                                                                                                                                    | Same discipline (relations only, no pinned numbers, decision 9): (1) the driven mid-joint at the solved target, its trailing endpoint at the tuck, nothing on the other three limbs moving; (2) support-foot integrity; (3) phase distinctness on the mid-joint; (4) direction; (5) solve retained across two gaps; (6) jointedness (trailing endpoint NOT collinear with root→mid-joint, non-driven mid-joints still derive); **(7) `deriveSkeleton` does not overwrite the driven joint** — the story's own AC, the one assertion the slice turns on. |
  | j   | Chambers / recovery               | **Both author a chamber**; **recovery reuses the chamber** (M3 default), eye-tuned                                                                                                                         | `empi` chambers the elbow COCKED BACK toward the flank; `hiza-geri` chambers the knee LOW and slightly back (leg not yet raised), then drives up. A chamber makes the wind-up read as a movement (S2). Recovery snapping back to the loaded chamber reads as a retract; promoted to a bespoke recovery point only if the `/dojo` eye demands it. All `Joint` values tuned by eye, relations pinned.                                                                                                                                                     |

  **Consequences to expect, not discover:**

  - **`isKick` generalises to an arm-vs-leg classification.** Today `limb === "footR" || "footL"`;
    it must now also route `elbow*` as arm-like (would-be lean, now suppressed) and `knee*` as
    leg-like (would-be step, now suppressed), and it decides which trailing endpoint folds. The
    endpoint-routing ternary (`footR`/`footL`/`handL`/`handR`) extends with the four mid-joints the
    same way S4 · Slice 6 extended it for `footL`.
  - **`strikeHandFor` / `driven` are now misnomers** — the solved point lands on an elbow / knee as
    readily as a hand. The concept generalises to "the driven point"; renaming is a judgement call
    for the refactor step, not a behaviour change.
  - **`reachTargetX` is untouched** and reads the tape's own `attackReach` (`empi` 95k / `hiza-geri`
    110k). `STRIKE_FLOOR_X` (24) dominates at these tiny reaches, so the mid-joint lands ~24px
    forward regardless of the exact gap — but assertion (5) still pins that two DIFFERENT gaps yield
    two different active positions (the floor only bites when the opponent is nearer than ~24px).
  - **Blast radius is `move-descriptors.ts` + `scene.ts` + `scene.test.tsx` only.** No `src/` touch
    (render-only; `empi`/`hiza-geri` have carried engine reach / timing / bands / score since
    Batch-1), no `BENCHMARK_VERSION` bump, **no `reach-presets.ts` change** (both moves already
    mirrored), no `Arsenal.tsx` change. The descriptor coverage test asserts `DESCRIBED_MOVES ⊆
REACH_PRESETS` (a subset), so adding two keys is clean.
  - **The overlap decision spans BOTH surfaces.** `/dojo` stands the pair at true reach and `/watch`
    renders true tape positions, so a real `empi` overlaps on a live replay too — accepting it is a
    `/watch` decision, not just a lab one.

## Slice ladder

1. **Engine** — `attackMove` + `attackPhase` on `RenderFrame`. Additive, render-only, outcome
   path untouched, byte-identical replays. **The arc's only `src/` touch** (same pattern as
   `guardBand` #313 and `attackReach` #344).
2. **Walking skeleton** — move picker (absorbing the reach dropdown) + the descriptor
   mechanism + **`mae-geri`** fully phased. Proves a foot drives through the same solver.
3. **Kicks** — `mawashi-geri`, `yoko-geri`, `ushiro-geri`. Where arc expressiveness gets forced.
4. **Punches** — `kizami-zuki`, `gyaku-zuki` (**rear** hand), `uraken`, `shuto`.
5. **Close** — `empi`, `hiza-geri`. Mid-joint (elbow/knee) as a driven endpoint. **Grilled → M13**
   (2026-07-20): the mid-joint LEADS and the fist / foot folds back; two slices, `empi` first.
6. **Special** — `throw`, `sweep`, `tobi-geri`.
7. _(deferred)_ Contact sheet — all 13 side by side.

Moves without a descriptor **fall back to today's generic pose**, so the picker stays fully
usable throughout slices 3–6.

`docs/spec.md` is **untouched** — `attackMove`/`attackPhase` are render-only and not
bot-readable, so the bot API does not change. Only `replay-contract.ts` and `STATUS.md`
need edits.

## Questions slice 2 must answer (deliberately not pre-decided)

Decision 3 puts descriptor fields on a discover-by-eye footing; these are the first three to
report back on:

- **Does `mae-geri` need the recovery override?** M3 makes recovery default to the chamber
  point; whether a kick reads correctly snapping back to its chamber, or needs its own
  authored point, is an eye question.
- **What fields fall out beyond limb + chamber** — bow direction, and **lean polarity** in
  particular (M9 gates the lean to phase 2 but leaves its sign open: a kick plausibly
  counterbalances **backward**, not forward into the reach the way `STRIKE_LEAN_RATIO` does
  for a punch).
- **Does the foot-through-solver assumption hold**, or does a raised foot need the hip to
  shift and the support leg to compensate? Note M8's assertion 2 (support integrity) **pins
  the current answer as "it holds"** — if the eye says otherwise, that assertion is the thing
  that must consciously change.

## Carried risks (stated, not solved)

- **Arc expressiveness (slice 3).** If the descriptor cannot express _around_ (roundhouse) vs
  _edge-on_ (side kick) vs _turning away_ (back kick), the four kicks collapse into one
  picture — the original problem one level up. This is the arc's main open technical risk.
- **The rear-hand punch kills an invariant.** `scene.ts:87-88` puts the guard on the rear arm
  _specifically_ so a strike and a guard never fight over the same limb. `gyaku-zuki` on
  `handL` breaks that. Harmless in real fights (a committed fighter cannot guard), but M10
  free-combos can show both at once ⇒ needs a **precedence rule**, like throw-beats-strike
  already has. Lands in slice 4.
- **Lopsidedness may pull defense forward.** Fights are two-sided; animated offense against a
  generic one-arm guard may read wrong on `/watch`, making the deferred uke arc feel urgent.
- **The coverage test cannot see the engine.** `web/src` never imports `src/`, so decision 10's
  test proves the three web tables agree **with each other**, not with `rules.ts`. A 14th move
  added engine-side still slips through. Pre-existing gap (`reach-presets.ts:5` says as much:
  the test "will flag drift, not catch it live") — not closed here.
