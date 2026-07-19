# Plan: S2 — a technique winds up and recovers

**Story**: S2 in `plans/move-poses-stories.md` · **Decisions**: M3, M4, M5, M7, M8, M9 in
`plans/move-poses-decisions.md`
**Predecessors**: S0 (#352, `attackMove`/`attackPhase` on the tape) · S1 (#353, the descriptor
table + `mae-geri`'s foot)
**Status**: Active — slice 1 shipped (#355, `bbb61ee`); slice 2 shipped (#356, `ea36c2b`);
slice 3 CONFIRMED NEEDED by slice 2's eye check and is next — acceptance criteria still to be
drafted and approved

## Goal

Kill the "0.4 s frozen at full extension" defect: a committed technique visibly winds up,
commits, and recovers, at true engine timing.

## Why this is three slices, not one

The story bundles four things — the pose change, an engine-timing mirror, a multi-tick dojo
tape, and transport wiring into a stage that currently has **no ticker at all**
(`DojoStage.tsx:83` hardcodes `scene(props.tape, 0, viewport)`). That is several "and"s and
two distinct actors.

The split is possible because of a fact S0 already banked: **real `/watch` tapes already carry
`attackPhase`.** So the pose change ships and is observable with _zero_ dojo work. The dojo
work is then a genuine second slice with its own value — the developer can play and scrub a
technique — and it is observable precisely _because_ slice 1 made the phases look different.

**This deviates from M4**, which argued the multi-tick tape must come first because otherwise
slice 2 is "authoring a chamber nobody can look at". The deviation is deliberate and the
objection is answered rather than ignored:

- Slice 1 authors the chamber from **anatomy, not eye** — `mae-geri` chambers knee-up with the
  foot under the hip, which is geometrically determined, not a tuned aesthetic.
- Decision 9 makes descriptor values free to change without touching a test, and M8 keeps
  every assertion **relational**. So re-tuning the chamber in slice 2 costs nothing.
- Slice 2 is explicitly where the chamber gets tuned by eye. It is named in that slice's
  acceptance criteria, not left implicit.

Doing it the other way round would make slice 1 an invisible harness slice: a multi-tick tape
whose 28 ticks all render the identical pose.

## Two calls — RESOLVED 2026-07-19

Both confirmed by the decision owner before any code was written. Recorded here in full,
because each one amends a decision made in an earlier artifact.

**Call 1 — M7's "no authored chamber" fallback: stance, or extension?** → **A (stance).**

M7 reads: _"A descriptor with no authored `chamber` keeps the stance position at phase 1: the
technique simply doesn't wind up."_ Two readings, with very different blast radius:

| Reading                                                                                         | Consequence                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A — literal.** No chamber ⇒ phases 1/3 draw the **stance** endpoint; phase 2 draws the solve. | **All 13 moves** gain wind-up + recovery in slice 1. A punch snaps out from the guard and returns. The frozen-extension defect dies for the whole roster in one PR. |
| **B — conservative.** No chamber ⇒ phase is ignored, extension always drawn (today's look).     | Only `mae-geri` changes. The other 12 stay frozen at extension until each is authored (slices S4–S6).                                                               |

**Chosen: A.** It is the literal text, it is a much larger fix for the same code, and "arm
returns to guard between strikes" is what punching actually looks like. **Accepted
consequence:** during a long recovery (13–22 ticks) an undescribed move renders _identically to
idle_, so the read "this fighter is committed and vulnerable" is lost until that move gets an
authored recovery pose. Reversible per-move by authoring a chamber — and S4–S6 do exactly that,
so the exposure shrinks with every later slice. **This makes S2 slice 1 a whole-roster change:
all 13 moves gain wind-up and recovery, not just `mae-geri`.**

**Call 2 — M8.3 (phase distinctness) contradicts M3 (recovery defaults to the chamber).**
→ **M8.3 is amended.**

M8.3 requires phases 1/2/3 be **pairwise** different. M3 defaults phase 3 to the _same_ point
as phase 1. As written, `mae-geri` cannot satisfy both without authoring a distinct recovery
point — which would pre-answer, by test pressure, one of the three questions this slice is
supposed to answer **by eye**.

**Chosen: M8.3 is relaxed to "phase 2 differs from phases 1 and 3."** The mutant M8.3 exists to
kill is _"the phases collapsed into one pose"_; `1 === 3` **by design** is not that collapse,
and the relaxed form still kills it. If a move later earns a distinct recovery (M3 allows it),
the assertion tightens **for that move specifically** rather than for the floor as a whole.

This is an amendment to the M8 assertion floor in `plans/move-poses-decisions.md`. That file is
the arc-level record and stays as-written; this plan is the amendment, and it is carried into
the archive alongside it when S2 completes.

## Acceptance Criteria

- [x] On `/watch`, a fighter throwing a technique is visibly in a different shape during
      wind-up than at the moment of contact, and returns from it afterwards — _slice 1, seen on
      the preview at ticks 41/47/58_
- [x] `mae-geri` chambers knee-up with the foot drawn back under the hip, then extends to the
      solved target — the phase-2 solve is retained (M3, non-negotiable) — _slice 1, pinned by
      test; **not yet eye-checked**, and it cannot be on `/watch` (see the move-usage finding),
      so the eye check belongs to slice 2_
- [x] In `/dojo`, a selected technique plays through its real engine duration
      (`startup + active + recovery` ticks) and can be paused, scrubbed and frame-stepped —
      _slice 2; eye-checked at ticks 0/9/14 of the default `mae-geri`_
- [x] `reach-presets.ts` mirrors the engine's per-move `startup`/`active`/`recovery`,
      pinned value-by-value — _slice 2, all 13 in one exhaustive assertion_
- [x] Every unauthored move, absent `attackPhase`, and out-of-range phase code renders
      something sensible — no blank figure, no throw (M7 totality) — _slice 1_
- [x] No `src/` change; `BENCHMARK_VERSION` stays `v19` — _held through slice 3_
- [x] A kick's contact frame reads like a kick: the limb keeps its bone lengths within reach and
      stretches only boundedly beyond it, and the upper body no longer pitches forward into a
      kick — _slice 3, eye-checked in `/dojo` at ticks 0/4/9/10/14_

## Slices

### Slice 1: a technique winds up and recovers on `/watch` — ✅ SHIPPED #355 (`bbb61ee`)

**One sentence**: `poseFor` honours `attackPhase`, so a committed technique draws a chamber
during startup and recovery and its solved extension only at contact.

**Value**: The spectator at `/watch` sees techniques as _movements_. This is the whole point of
the story, and it needs no dojo work to ship.
**Path**: real fight tape (already carries `attackPhase` from S0) → `scene()` → `poseFor`
selects the endpoint by phase → `deriveBend` re-derives the mid-joint off the new endpoint →
`/watch`.
**Class**: Behavior change.
**Required implementation skills**: `tdd`, `testing`, `refactoring`. `mutation-testing` is
**`N/A`** — Stryker does not reach `web/` (node-only project). Substitute evidence, per the
standing house rule for `web/`: exhaustive exact-assertion tests + a manual mutator scan +
`/dojo` visual sign-off.
**Reduction program**: `N/A`.

**Acceptance criteria** _(confirm before code)_:

1. Given a frame with `attackMove: "mae-geri"` and `attackPhase: 1`, when it renders, `footR`
   sits at the authored chamber — **behind** its phase-2 position (M8.4 direction) and lifted
   off the ground. _Corrected during RED: an earlier draft said "above" its phase-2 position.
   A `mae-geri` chambers **low**, under a raised knee, and **rises** to the band as it extends,
   so the chamber is above the **stance** but below the extension._
2. Given the same frame at `attackPhase: 2`, `footR` sits at the solved reach target, and two
   different opponent gaps yield two different `footR.x` (M8.5 — the solve is retained).
3. Given an **undescribed** move (`gyaku-zuki`) at phase 1, `handR` sits at its **stance**
   position, and at phase 2 at the solved target (Call 1, reading A).
4. Given `attackPhase` absent, out of range (`0`, `7`, `-1`), or non-numeric, the **extension**
   draws — today's look, so no tape can regress into a blank or frozen figure (M7).
5. Given phase 1 or 3, the upper body does **not** lean; given phase 2, it does (M9).
6. Given any phase, the knee/elbow lies off the straight endpoint-to-endpoint line (M8.6).
7. Support integrity holds at every phase: the non-driven foot never leaves stance (M8.2).

**RED**: `web/src/pages/replay/scene.test.tsx` — a test asserting `footR` at phase 1 differs
from `footR` at phase 2 for `mae-geri`. Fails today because `poseFor` ignores `attackPhase`
entirely.
**GREEN**: `MoveDescriptor` gains `chamber?: Joint`; `poseFor` picks chamber-vs-solve by phase.
Note `move-descriptors.ts` needs `import type { Joint } from "./scene"` while `scene.ts`
imports `limbFor` back — a **type-only** cycle, erased at compile time, so no runtime cycle.
**MUTATE**: `N/A` (see above). Manual mutator scan targets: phase boundary comparisons
(`< 2` vs `<= 2`), the phase-1/phase-3 branch collapsing, the lean gate inverting, and the
chamber/solve swap.
**KILL MUTANTS**: `N/A`.
**REFACTOR**: Assess whether phase→endpoint selection wants its own named pure function
(likely — `poseFor` is already dense and this is the second independent layer decision inside
it).
**Done when**: all seven criteria pass, `npm test` + `typecheck` + `lint` green, manual scan
recorded, and the human approves the commit.

**Recorded outcome** _(2026-07-19)_:

- All seven criteria met. 98 tests in `scene.test.tsx` (2088 repo-wide), typecheck + lint green,
  `src/` untouched.
- **Manual mutator scan: 16/16 killed** (scripted — each mutant applied to the real source, suite
  run, file restored). One genuine **survivor** was found and fixed: dropping the `strikeHand`
  gate let an **idle** fighter chamber its leg off a stale move id, because the S1 idle test sets
  no phase and so never reaches the wind-up branch. Killed by a new totality test covering idle /
  band-0 / out-of-range-band / rejected-reach across all three phases.
- **Refactor applied**: the `driven` selection first landed as a nested ternary; flattened to
  `strikeHand === null || !winding ? strikeHand : chamberFor(...)` — exactly equivalent, one
  condition, and consistent with the house "no nested if/else" rule. Re-verified: 16/16 still
  killed against the restructured source.
- **New finding for slice 2's eye check — the bone-length swing is worse than S1 measured.**
  The driven leg runs `hip → foot` at **0.34×** its natural length when chambered and **1.82×**
  when extended (natural 36.8 local px; chamber 12.6; extension 67.1) — a **5.3× swing** across
  one technique. S1 only measured the stretched end. Slice 2 must judge **both**: a chambered leg
  may read as a stump exactly as an extended one reads as a rubber band. This sharpens the
  slice-3 question from "should the extension be constrained?" to "should bone length be
  conserved at all?"
- **Visual sign-off: PARTIALLY DONE on the preview, better than this plan predicted.** The plan
  assumed nothing could be seen until slice 2. Wrong — reading A means every move winds up
  through its stance, so the **phase mechanism** is visible on real replays right now. Confirmed
  on `/watch/7076747f…` (Playwright, seeking to specific ticks):

  | Tick | Phase    | What renders                           |
  | ---- | -------- | -------------------------------------- |
  | 41   | startup  | upright stance, arm down — the wind-up |
  | 47   | active   | full extension + the M2 lean           |
  | 58   | recovery | back to upright stance                 |

  What remains unseen is only the **authored `mae-geri` chamber** — see the move-usage finding
  below for why that will stay unseen on `/watch` regardless.

- **The change is far larger than "a nicer strike": 87% of committed ticks were wrong before.**
  In that replay 636 of 727 committed ticks are startup or recovery. Across all 29 replays,
  `gyaku-zuki` alone spends 4040 ticks in startup and 9164 in recovery against just 1833 active.
  Nearly all committed time was previously drawn at full extension.

- **Confirmed cost of reading A.** At tick 58 the recovering fighter is pixel-identical to an
  idle one. The "committed and vulnerable" read really is gone for unauthored moves, exactly as
  predicted — not a surprise, but now observed rather than argued.

- **The lean + telescoping read strongly at contact.** The active frame is a hard diagonal lunge
  with an arm roughly 2× its stance length. Consistent with the bone-length finding above; slice
  2 should judge the lean's magnitude at the same time as the limb lengths.

---

### Slice 2: the dojo plays a technique through its real duration

**One sentence**: `/dojo` builds a multi-tick tape spanning the selected move's engine timing
and drives it with the existing transport, so a technique can be watched, paused and stepped.

**Which move gets the eye check? → `mae-geri`. RESOLVED 2026-07-19.**

Slice 1 measured which moves fighters actually throw: only 5 of 13 ever appear, and **`mae-geri`
is not one of them**, while `gyaku-zuki` alone is ~80% of committed screen time and still winds up
through a bare stance. That raised the question of whether this slice should tune `gyaku-zuki`
instead, putting the arc's first spectator-visible chamber one PR earlier. **Rejected**, for three
reasons:

1. **Two of this slice's three M3 questions are kick-specific** — _lean polarity for a kick_ and
   _does the foot-through-solver assumption hold once it moves_. A punch cannot answer either, so
   switching would leave the questions that gate S4 and S5 open and force them to be re-asked
   against an already signed-off harness.
2. **`gyaku-zuki` is already S4's first move.** The telemetry-bargain rule
   (`plans/move-poses-stories.md` § The bargain) orders S4 by move-usage and `gyaku-zuki` tops it.
   Pulling it here doesn't buy a PR of value — it merges S4's first PR into the harness PR,
   re-bundling the "and" this three-way split exists to remove.
3. **The extension may move underneath it.** Slice 1 measured the **arm** at ~2× its stance length
   at contact, not just the leg, so slice 3's bone-length question — if it fires — changes how a
   punch extends. Authoring `gyaku-zuki`'s chamber before that settles means tuning against
   geometry that may shift.

**What the measurement actually argues for is sequencing, not slice content.** `gyaku-zuki` being
invisible is a scheduling symptom. The fix is to hold the order **slice 2 → assess slice 3 → S4
opening on `gyaku-zuki`**, and let nothing overtake S4. That lands the dominant move one PR later
than the switch would, against settled geometry, with the kick questions already answered.

**Tripwire carried to S4** (not this slice): `gyaku-zuki` is the **rear-hand** punch, and
`scene.ts:87` puts the guard on the rear arm precisely so a strike and a guard never contend for
the same limb (`plans/move-poses-stories.md` § Warnings). Authoring it collides with that
precedence rule; that is S4's first problem to solve, and it is why S4 is not a trivial table edit.

**Value**: The developer gets the authoring harness. This is what makes the chamber from slice
1 tunable by eye, and it is the tool every later slice (S3–S6) depends on to author 12 more
moves. It also answers a question a still cannot: _does this read as a movement at true engine
timing?_
**Path**: `reach-presets.ts` timings → `buildDojoTape` spans `startup + active + recovery`
ticks, stamping `attackPhase` per tick → `DojoStage` ticker advances the pure `transport`
clock → `scene()` at the playhead → controls pause/scrub/step.
**Class**: Behavior change.
**Required implementation skills**: `tdd`, `testing`, `refactoring`. `mutation-testing` `N/A`
(same `web/` rationale as slice 1).
**Reduction program**: `N/A`.

**Acceptance criteria** _(confirm before code)_:

1. Given `mae-geri` (engine timing 9/3/16), when the dojo tape builds, it spans **28** ticks.
2. Given that tape, the tick at index 0 carries `attackPhase: 1`, index 9 carries `2`, and
   index 12 carries `3` — the phase boundaries land where the engine's do.
3. Given the dojo stage, when it mounts, the technique plays and the figure visibly changes
   shape across the tape.
4. Given playback, when ◀/▶ is pressed, the playhead moves one tick and playback **pauses**
   (already guaranteed by the pure `step`/`seek` model — this asserts the wiring).
5. Given the scrub bar, when dragged, the pose follows the playhead and playback pauses.
6. Given `reach-presets.ts`, every one of the 13 moves carries `startup`/`active`/`recovery`
   matching `src/engine/rules.ts` value-by-value (drift test, extending the existing reach pin).
7. Given an idle figure (`attacking: false`), the tape is still built and playable — the lab
   never breaks because a figure has no committed move.

**RED**: `dojo-tape.test.tsx` — assert `buildDojoTape` returns 28 ticks for a `mae-geri`
challenger. Fails today: the builder returns exactly one tick (`dojo-tape.ts:26`).
**GREEN**: timing fields on `REACH_PRESETS`; `buildDojoTape` maps over the duration stamping
`attackPhase`; lift a `transport` signal + ticker into `DojoStage` (or `DojoApp`), reusing
`transport.ts` unchanged — the clock model is already built and tested.
**MUTATE**: `N/A`. Manual scan targets: the tick-count arithmetic (off-by-one on
`startup + active + recovery`), the phase-boundary comparisons in the stamper, and each
transported control's delta sign.
**REFACTOR**: `ReplayPlayer.tsx` already owns play/pause + ◀/▶ + scrub + speed. Assess
extracting shared playback controls rather than copying them. **Do not pre-commit** — if the
extraction turns out to drag `/watch`-specific concerns (speed, restart, `lastTick` semantics)
into a shared component, copying the three buttons is the smaller change. Decide against the
real diff.
**Done when**: all seven criteria pass, gates green, **the chamber has been re-tuned by eye in
`/dojo` and the three M3 questions are answered in writing** (recovery override? lean polarity
for a kick? does the foot-through-solver assumption still hold once it moves?), and the human
approves the commit.

**Recorded outcome** _(2026-07-19)_:

- All eight approved criteria met. 63 dojo tests (2102 repo-wide), typecheck + lint green,
  `src/` untouched, `BENCHMARK_VERSION` still `v19`.
- **Manual mutator scan: 27/28 killed** (scripted — applied to real source, suite run, file
  restored; re-run in full after the refactor). One genuine **survivor found and fixed**: dropping
  figure `b` from the span left the suite green, because the differing-moves test happened to give
  the **challenger** the longer technique, so `max(1, spanOf(a))` returned the same answer. Killed
  by a mirrored test where the **king** holds the longer move.
- **One accepted survivor: "the stage ignores the playhead"** (`DojoStage` drawing `scene(tape, 0)`
  instead of `scene(tape, props.tick)`). It is invisible to the unit layer by construction — the
  spy stage replaces `DojoStage` wholesale, and that same seam is what makes every transport
  transition assertable without WebGL. This follows the standing precedent for renderer wiring
  (`ReplayPlayer`'s ticker is likewise proven by Playwright, not by unit test). It is killed
  **empirically** by the visual check below: the mutant would freeze the figure, and the figure
  demonstrably moves.
- **Refactor applied**: `spanOf` was a closure inside `buildDojoTape` though it closes over nothing;
  hoisted to module level beside `techniqueOf`/`figureAt`. **Extraction of shared playback controls
  with `ReplayPlayer` was assessed and REJECTED** — the player carries speed buttons, restart,
  `aria-valuetext`, disabled-at-ends and engine-tick-vs-index readout semantics the lab does not
  want; sharing would drag `/watch` concerns into `/dojo`. Four plain controls is the smaller
  change, exactly as this slice's REFACTOR note anticipated.
- **Visual sign-off: DONE** (Playwright against the local dev server, `/dojo` at ticks 0/4/8/9/10/
  11/14/20/27). The technique plays on load and auto-pauses at its final tick. Ticks 0–8 hold the
  chamber, 9–11 the extension, 12–27 the chamber again.

**The three M3 questions — answered from the moving picture:**

1. **Does recovery need its own pose?** **Yes eventually, but that is not the real problem.** With
   M3's default, tick 14 is pixel-identical to tick 4: the kick holds a chamber for 9 ticks, snaps
   out for 3, then holds the _same_ chamber for 16. The honest finding is bigger than the question
   asked — **nothing interpolates.** A distinct recovery pose would help; easing between the three
   would help far more. Recorded as a new arc-level concern rather than folded silently into a later
   slice.
2. **Lean polarity for a kick?** **Wrong as inherited — a kick wants the opposite lean, or none.**
   The M2 lean was authored for punches, where leaning into the reach is right. On a `mae-geri` the
   torso pitches hard forward over a rising leg, so the figure reads as _falling into_ the kick
   rather than kicking. Real front kicks counterbalance backward.
3. **Does the foot-through-solver assumption hold once it moves?** **Mechanically yes, visually no.**
   The foot reaches the target and the knee re-derives correctly at every tick. But motion makes the
   bone-length swing more obvious, not less: you now watch a short chambered leg snap into a
   near-horizontal pole about twice its natural length. **This settles slice 3 — it is needed.**

**Chamber tuning**: left as authored. The chamber reads correctly (knee forward, foot drawn back
under the hip); every problem the eye check found is elsewhere — lean polarity, bone length, and the
absence of interpolation.

**Usability wrinkle, not a criterion**: the lab has no Restart. Playback auto-pauses at the final
tick, so `/dojo` now opens resting on the last recovery frame, and replaying means scrubbing to 0
and pressing Play. Usable, but S3–S6 will do this constantly — worth a small follow-up.

**Watch item — a flaky neighbour.** `ReplayPlayer`'s "auto-pauses at the end of a short fight" test
failed once in five full-suite runs on this branch (0 in 3 on `main`). It passes in isolation. It is
inherently ticker-timing-dependent, and this slice adds real per-frame redraw work to the two
`/dojo` tests that mount a real Pixi app. Inconclusive at these sample sizes, and deliberately
**not** patched here — weakening an unrelated assertion to green a run would hide exactly the kind
of signal it exists to give.

---

### Slice 3 — a kick's contact frame reads like a kick — ⚠️ CONFIRMED NEEDED

**One sentence**: The contact frame stops reading as a forward-falling lunge on a rubber-band
leg — the driven limb stops telescoping to ~1.8× its natural length, and the upper body stops
leaning _into_ a kick.

**Value**: Closes S1's carried finding (`plans/move-poses-stories.md` § Warnings): the driven
leg measured ~67 local px against a ~37 px natural length, with the 8 px `KNEE_BEND` swamped.

**No longer conditional.** This slice was reserved pending slice 2's visual sign-off, on the
theory that motion might hide the stretch. It does the opposite: watching a short chambered leg
snap into a near-horizontal pole makes the swing _more_ obvious, not less. Confirmed 2026-07-19.

**Scope expanded to two findings, deliberately.** Slice 2's eye check surfaced a second defect in
the same frame — **the M2 lean has the wrong polarity for a kick.** It was authored for punches,
where leaning into the reach is right; on a `mae-geri` the torso pitches forward over a rising leg
so the figure reads as _falling into_ the kick. Real front kicks counterbalance backward.

These ship together rather than as separate slices because they are **one observable outcome**
("the contact frame reads like a kick"), they touch the same code, and judging either by eye
means judging it against a figure the other still distorts. Splitting them would mean tuning the
bone length against a torso pitched at the wrong angle, then re-tuning it afterwards.

### What the geometry actually says — measured from the source, 2026-07-19

Before drafting criteria the figure was measured rather than described. All values are local px in
the authoring frame (`STAND`, `mae-geri`'s chamber, a mid-band solve at the default dojo gap).

| Limb                  | Endpoint span | Implied bone |
| --------------------- | ------------- | ------------ |
| Leg, stance           | 36.8          | 20.1         |
| Leg, chamber          | 12.6          | 10.2         |
| Leg, contact          | 67.1          | 34.5         |
| Arm, stance           | 26.9          | 15.7         |
| Arm, contact (leaned) | 53.1          | 27.8         |

**The framing in the notes above is wrong, and the correction matters.** "The limb telescopes to
1.8× its natural length" treats `hip → foot` distance as bone length. It is not — a folded knee
_should_ bring the foot close to the hip, so the 0.34× chamber is anatomically fine. The real
defect is one level down: `deriveBend` (`scene.ts:138`) places the mid-joint at the **midpoint of
the two endpoints plus a fixed 8 px perpendicular**, so the two bones it implies are
`√((span/2)² + 8²)` — a function of how far apart the endpoints are. The bones themselves stretch.
The driven leg's bones run **10.2 → 34.5 across one technique, a 3.4× swing**; the arm's run
1.77×. This is not a kick defect. **The whole figure is rubber**, and the kick merely exposes it,
because its authored chamber makes the swing happen inside a single move.

That reframes the fix from "constrain the reach" to "**make the two bones constant and solve the
mid-joint**" — i.e. replace the perpendicular-bulge heuristic with real 2-bone IK, where fixed
bone lengths plus a target determine the knee. Relational, no tuned numbers, and it fixes arms and
legs from one function.

**But constant bones collide with a shipped guarantee, and the collision is unavoidable.** A
constant-bone leg spans at most `2 × 20.1 = 40.1` px fully straight. The contact frame needs
**67.1**. So the kick that S5 (#344–#347) deliberately made _connect_ can no longer reach the
opponent — the previous arc's whole achievement. Bounding hip travel does not rescue it either:
keeping the support leg constant-length over a planted `footL` allows only **7.3 px** of hip
travel, giving **47.4** against the 67.1 required. Still ~20 px short.

**Call 3 — RESOLVED 2026-07-19 → (ii), the support foot slides.** Three ways out, only one of
which can hold:

| Option                                       | Cost                                                                                                                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **(i)** Bones constant, limb stops short     | Strikes stop connecting. Reverts S5. Rejected unless the decision owner wants it.                                                                                         |
| **(ii)** Bones constant, support foot slides | The fighter **steps into** the technique. Amends M8.2. Reads as real karate — a committed kick _does_ close distance — and root `x` stays truthful (a local pose change). |
| **(iii)** Bones stretch                      | Today's look. The defect.                                                                                                                                                 |

**Chosen: (ii).** It is the only option that keeps both invariants that matter — bones stay bones,
and strikes still land. It also explains the M2 lean retroactively: the lean already _is_ root
travel for the arm (it moves the shoulder so the arm spans 50 instead of 66), and the leg simply
never got its hip-shaped equivalent. Adopting (ii) generalises one existing mechanism rather than
adding a second. **Accepted consequence:** a committed technique now visibly closes distance, so
the drawn figure's stance width no longer matches its idle stance. That is what a lunging kick
looks like, but it is a real change to the silhouette and is called out here rather than
discovered later.

**Tripwire, now confirmed rather than hypothetical**: (ii) moves the support leg, which trips
M8.2's support-integrity assertion. That assertion is a **decision record, not a bug**
(`plans/move-poses-stories.md` § Warnings). It changes deliberately, **in its own commit**, with
the reasoning written down — it is not patched around, and it is not bundled into the IK commit.

**Scope consequence — the length fix is not kick-only.** It lives in the shared derivation, so it
changes punches too, and the arm's ratio (1.77×) is close behind the leg's. Special-casing legs
would be _more_ code and would leave the worse-lit defect on the move that is ~80% of screen time.
The **lean polarity** fix stays kick-specific (per-descriptor), since punches read correctly today.
`gyaku-zuki` therefore changes shape here, one slice before S4 authors its chamber — accepted:
S4 then authors against settled geometry, which is the sequencing this plan already argued for.

**Acceptance criteria** _(confirm before code)_:

1. Given any described move at any phase, the driven limb's two bones (`hip→knee`, `knee→foot`;
   `shoulder→elbow`, `elbow→hand`) are each within **1%** of their stance length — asserted as a
   ratio computed from the stance, never a literal coordinate, so the descriptor stays free to
   retune (decision 9).
2. Given `mae-geri` at phase 2, the driven foot still reaches the opponent's near edge — the S5
   contact guarantee survives — and two different opponent gaps still yield two different
   `footR.x` (M8.5, the solve is retained).
3. Given a target beyond the limb's straight-line reach, the limb's **root travels** toward it
   (hip for a kick, shoulder for a punch) by exactly the shortfall, so the endpoint still lands on
   target with both bones at stance length. Given a target within reach, the root does **not**
   travel — the fighter only lunges when the technique demands it.
4. Given `mae-geri` at phase 2, the upper body does **not** lean forward into the kick (M9
   polarity, corrected); given an undescribed **punch** at phase 2, it still does — the existing
   punch look is preserved, proving the fix is per-descriptor and not a global removal.
5. Given phases 1/2/3, the driven endpoint positions stay pairwise-distinct for phase 2 vs 1 and 3
   (M8.3 as amended by Call 2), and the phase-2 endpoint is still forward of phase 1 (M8.4).
6. Given any phase, each mid-joint still lies off the straight endpoint-to-endpoint line (M8.6) and
   bows the correct way — knees forward, elbows back.
7. Support integrity, **M8.2 as amended by Call 3**: when the hip travels, `footL` follows only as
   far as it must to keep the support leg at stance bone length — asserted as _"the support leg's
   bones are unchanged"_, which is strictly stronger than the old _"`footL` never moves"_ and is
   the assertion M8.2 was always reaching for. `footL` stays planted whenever the hip does not
   travel, so an idle, guarding or short-reach figure is pixel-identical to today.
8. No `src/` change; `BENCHMARK_VERSION` stays `v19`.

**RED**: `scene.test.tsx` — assert the driven leg's `hip→knee` length at phase 2 equals its stance
`hip→knee` length. Fails today at roughly 34.5 vs 20.1.
**GREEN**: replace `deriveBend`'s midpoint-plus-perpendicular with a fixed-length 2-bone solve,
keeping the `dir` argument as the bend-direction selector so the arms-vs-legs split survives
unchanged. Then the Call 3 mechanism for out-of-reach targets.
**MUTATE**: `N/A` (`web/` is outside Stryker). Manual scan targets: the IK branch selection (the
two mirror solutions — a sign flip yields a backward knee), the reach-exceeded boundary
(`>` vs `>=`), the lean gate now that it is per-descriptor rather than global, and the bone-length
ratio bound.
**REFACTOR**: Assess whether root travel (shoulder lean + hip travel) wants to be one named
mechanism rather than two — see the M2 observation above. Decide against the real diff, not from
here.
**Done when**: all eight criteria pass, gates green, the contact frame eye-checked in `/dojo` for
both a kick and a punch, M8.2's fate recorded either way, and the human approves the commit.

**Recorded outcome** _(2026-07-19)_:

- 479 web tests (2114 repo-wide), typecheck + lint green, `src/` untouched, `BENCHMARK_VERSION`
  still `v19`. **Manual mutator scan: 19/19 killed**, no survivors — scripted, each mutant applied
  to the real source with the suite run and the file restored.

**Call 3 was re-opened during GREEN, and the first answer did not survive contact with the
numbers.** The approved option (ii) — bones always constant, root travels however far it must —
turned out to be unbounded in practice. I had checked that root travel was _possible_, not that it
was _bounded_:

| Gap  | Hip travel needed | Shoulder travel needed |
| ---- | ----------------- | ---------------------- |
| 120k | 0                 | 2.0                    |
| 150k | 0                 | 10.3                   |
| 240k | **27.0**          | **37.1**               |
| 300k | 45.7              | 55.6                   |

On a 76 px figure, and 240k is not an edge case — it is `gyaku-zuki`'s reach, the annotated
"workhorse / opening distance", and the dojo's `DEFAULT_GAP`. Faithful (ii) lunges the fighter
36-73% of its own height on every technique.

**Root cause, worth keeping.** `BODY_HEIGHT_SUB` is 240_000 and the opening distance is 240_000:
fighters stand **one body-height apart**, while an arm spans 0.35 of that and a leg 0.48. Nothing
human-proportioned reaches its own height. Scaling the body cannot fix it — that ratio is the
engine's, and scaling magnifies gap and body together (the figure already fills 80% of the
viewport). **So the original stretching was not an oversight; it was the compromise that made
contact legible at all.** Options (i) and (iii) both fail for the reasons in the table above.

**Call 3 revised → capped travel + bounded residual stretch** (decision owner, 2026-07-19). The
root closes `min(16, shortfall)` and the limb stretches for the rest. Consequences:

- Bone drift at the workhorse distance falls from **0.72 → 0.28**, and the swing _across_ a
  technique from 0.51×→1.72× down to 1.0×→1.28×. Roughly two-thirds of the rubber band is gone.
- **M8.2 needs no amendment after all.** Capping the step at 16 keeps the support leg's own stretch
  to ~1.13×, small enough to leave `footL` planted. The plan's tripwire never fired, so AC 7 above
  is superseded by the simpler original assertion, and `plans/move-poses-decisions.md` M8 stands
  entirely as written.
- **AC 1 is amended**: bones are constant _within_ the limb's reach (tolerance 2%, not 1% — joints
  are rounded to whole px after a ~6.3× scale, which alone drifts a measured bone ~1.1%). Beyond
  reach they stretch, bounded.
- **AC 6 is amended**: a limb at or past full extension draws **straight**, because the solved bow
  floors at zero. This is correct rather than tolerated — a fully committed kick _is_ a straight
  line, and forcing an 8 px bow into one would be anatomically wrong. M8.6 therefore holds wherever
  the limb is not fully extended, and the tests pin both halves of that rule.
- **AC 3 is amended**: the root closes part of the shortfall, not all of it.

**Visual sign-off: DONE** (Playwright against the local dev server; `/dojo` at ticks 0/4/9/10/14 for
the kick, and at tick 8 with the challenger's default move temporarily flipped to `gyaku-zuki` for
the punch — reverted immediately, since `/dojo` has no move picker yet).

- **Chamber** (tick 4) now reads as a folded leg with a visible thigh and shin of comparable length,
  instead of the 10.2 px stump.
- **Contact** (tick 10) reads as a front kick: support leg planted and angled back, hips driven
  forward, kicking leg extended onto the opponent's edge, head upright.
- **An unplanned win — the counterbalance came free.** The eye check in slice 2 asked for a kick to
  counter-lean _backward_; this slice only removed the forward lean, expecting "upright". But
  because the hip steps forward while the shoulder does not, the torso ends up leaning **back over
  the driven hip** — the counterbalance, produced by the step rather than authored. No kick-specific
  lean polarity was needed beyond the removal.
- **Punch** (tick 8) reads as a committed lunging punch: shoulder leaned in, hip planted, arm
  straight onto the target. Its only change this slice is the straight arm at full extension.

**Refactor assessed — unifying lean and step REJECTED.** The REFACTOR note above asked whether the
shoulder lean and the hip step want to be one mechanism. They nearly are: both cap at 16, and the
lean is exactly "root travel for the arm". But `strikeLean` is a **heuristic**
(`min(CAP, handX × 0.5)`) while `rootTravel` is **derived** (`min(CAP, shortfall)`). They agree at
the workhorse distance — both saturate at 16 — and diverge closer in, where the heuristic leans
further than the reach actually requires. Merging them would therefore _change how punches look at
close range_, which makes it a behaviour change and not a refactor; it is outside this slice's
approved criteria and belongs with S4, where `gyaku-zuki` gets authored and the punch is being
judged by eye anyway. The two caps sharing the value 16 is coincidence between independently
eye-tuned knobs, not duplicated knowledge, so they stay separate.

**Follow-up, not this slice**: `/dojo` still has no move picker, so a punch can only be eye-checked
by temporarily editing `controls.ts`. Worth a small control alongside the missing Restart noted in
slice 2.

**Explicitly NOT in this slice — interpolation.** Slice 2's eye check found that nothing eases
between the three phases: a technique is three still frames held for 9/3/16 ticks. That is the
single largest remaining gap between "the phases are correct" and "this reads as a movement", but
it is a **new capability**, it affects all 13 moves and `/watch` as well as `/dojo`, and it is
much larger than either finding above. Written up as its own arc-level story (S8 in
`plans/move-poses-stories.md`) rather than smuggled in here.

**Class**: Behavior change.
**Required implementation skills**: `tdd`, `testing`, `refactoring`; `mutation-testing` `N/A`.

## Pre-PR Quality Gate

Per slice, before the PR:

1. **Mutation evidence** — `N/A` for all slices; `web/` is outside Stryker's reach (node-only
   project). Substitute: exhaustive exact-assertion tests, a **recorded** manual mutator scan,
   and `/dojo` visual sign-off.
2. **Refactoring assessment** — run `refactoring`; record `N/A` if it adds nothing.
3. `npm run typecheck` and `npm run lint` pass.
4. **Format only the slice's own files.** `npm run format` is `prettier --write .` repo-wide and
   will reformat unrelated files; `format:check` also fails on a **pre-existing** violation in
   `docs/archive/variety-telemetry-s3a.md` on clean `main`. Neither is this plan's to fix.
5. **`src/` untouched** — verify no engine diff and `BENCHMARK_VERSION` still `v19`.
6. Visual check on the Vercel preview. `agent-browser` **hangs** on the Pixi canvas pages
   (never reaches network-idle) — drive Playwright directly with
   `waitUntil: "domcontentloaded"` + an explicit canvas wait + a paint delay, and keep the
   helper script **in the repo root** (Node resolves `node_modules` from the script's location,
   not the cwd).

---

_Archive under `docs/archive/` when complete — never delete (standing preference)._
