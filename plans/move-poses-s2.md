# Plan: S2 — a technique winds up and recovers

**Story**: S2 in `plans/move-poses-stories.md` · **Decisions**: M3, M4, M5, M7, M8, M9 in
`plans/move-poses-decisions.md`
**Predecessors**: S0 (#352, `attackMove`/`attackPhase` on the tape) · S1 (#353, the descriptor
table + `mae-geri`'s foot)
**Status**: Active

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

- [ ] On `/watch`, a fighter throwing a technique is visibly in a different shape during
      wind-up than at the moment of contact, and returns from it afterwards
- [ ] `mae-geri` chambers knee-up with the foot drawn back under the hip, then extends to the
      solved target — the phase-2 solve is retained (M3, non-negotiable)
- [ ] In `/dojo`, a selected technique plays through its real engine duration
      (`startup + active + recovery` ticks) and can be paused, scrubbed and frame-stepped
- [ ] `reach-presets.ts` mirrors the engine's per-move `startup`/`active`/`recovery`,
      pinned value-by-value
- [ ] Every unauthored move, absent `attackPhase`, and out-of-range phase code renders
      something sensible — no blank figure, no throw (M7 totality)
- [ ] No `src/` change; `BENCHMARK_VERSION` stays `v19`

## Slices

### Slice 1: a technique winds up and recovers on `/watch`

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

---

### Slice 3 _(conditional)_: a kick's extension reads snapped, not stretched

**One sentence**: The driven limb stops telescoping to ~1.8× its natural length at full
extension.

**Value**: Closes S1's carried finding (`plans/move-poses-stories.md` § Warnings): the driven
leg measured ~67 local px against a ~37 px natural length, with the 8 px `KNEE_BEND` swamped.

**This slice is conditional and must not be pre-committed.** Motion hides a great deal, and
slice 2 is the first time anyone sees the kick _move_. It is entirely possible that a kick
which chambers and extends reads fine at 1.8×, in which case this slice is deleted rather than
implemented. **Assess after slice 2's visual sign-off; do not plan the fix before then.**

If it _is_ needed, the candidate fixes in rough order of cost — hip travel, a knee-lift
chamber that shortens the required reach, or a hard bone-length constraint — differ enough that
choosing one before seeing the motion would be guesswork.

**Tripwire, stated up front**: hip travel would move the support leg, which trips M8.2's
support-integrity assertion. That assertion is a **decision record, not a bug**
(`plans/move-poses-stories.md` § Warnings). If this slice moves the hip, M8.2 changes
deliberately, in its own commit, with the reasoning written down — it is not patched around.

**Class**: Behavior change (if it happens).
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
