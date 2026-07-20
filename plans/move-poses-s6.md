# Plan: S6 — the non-strike moves read correctly

**Branch**: feat/move-poses-s6-non-strike-moves
**Status**: Active

Split from `plans/move-poses-stories.md` (S6) via `planning` + `grill-me` (2026-07-20). Feeds TDD,
**PR per slice**. Every slice loads `tdd`, `testing`, `mutation-testing`, `refactoring` before code
changes and completes RED → GREEN → (Stryker `N/A` for `web/` ⇒ manual mutator scan) → refactor
assessment before the next slice starts.

## Goal

Each of the three non-strike moves — `sweep`, `tobi-geri`, `throw` — reads as its own technique on
`/watch` and in `/dojo`, dispatched through the single `attackMove` descriptor lookup, completing the
13-move roster.

## Why these three, and why now

The telemetry-first bargain (`plans/move-poses-stories.md`): `sweep` (324/108/214), `tobi-geri`
(120/40/638) and `throw` (30/10/70) committed ticks are all genuinely thrown on `/watch`. `sweep` and
`tobi-geri` render **wrong today** (a generic front hand — the exact defect the arc exists to kill);
`throw` renders correctly on `/watch` but through a **separate `frame.throwing` code path**, and its
`/dojo` picker entry is broken (selecting "throw" draws a hand, not the grab). S6 fixes both and
retires the last non-descriptor dispatch path.

## Non-negotiable constraints

- **`web/` only.** No `src/`, no engine, no TCB, no `BENCHMARK_VERSION` bump. The engine already emits
  `attackMove` / `attackBand` / `attackReach` / `posture` / `throwing` for all three moves (verified in
  `src/engine/sim.ts` `renderFrameOf` + `src/engine/rules.ts`); S6 is purely the renderer.
- **Determinism / replay untouched.** `scene()` and `poseFor()` stay pure functions of (frame, viewport)
  — no cross-frame state — so replays remain byte-identical and scrub-correct.
- **`web/` is not under Stryker** (per project memory). Mutation testing is therefore `N/A` for every
  slice; substitute **exhaustive exact-assertion unit tests + a MANDATORY manual mutator scan** against
  `mutation-testing`'s `resources/mutator-rules.md`, recorded in the PR.
- **No distinctness collisions** among the three (sweep = feet-low, tobi-geri = feet-air, throw =
  hands-grab) or against the 5 authored strikes — no new escape hatch needed (M3 risk not triggered).

## Resolved design decisions (grill, 2026-07-20)

1. **Throw is in scope** as the final slice — a behavior change that fixes the `/dojo` throw picker while
   keeping `/watch` byte-identical, not a pure refactor (the RED is real).
2. **Sweep height**: a **fixed near-ground `targetY`**, independent of `attackBand` (UNRESTRICTED for
   `sweep`), mirroring the throw's fixed `GRAB_Y` precedent. New optional per-move `targetY` override.
3. **Sweep leg**: `footR` (front leg de-ashi-barai); the near-ground height is the distinguishing cue.
4. **Sweep chamber**: authored (foot cocked back/lifted before the reap), consistent with all 5 authored
   moves; exact x/y eye-tuned in `/dojo`, relations pinned by test.
5. **Tobi-geri leg**: `footR` (flying front kick); AIR stance already separates it from grounded kicks.
6. **Tobi-geri root**: **holds the root in the air** — no local hip-step and no torso lean (the jump arc
   supplies the closing, `rules.ts:255`; the leg telescopes for the residual). New `air + kick → root
   held` gate, consistent with how mid-joint strikes already hold the root.
7. **Tobi-geri chamber**: none — the AIR stance's tucked `footR` IS the wind-up (tuck → extend → tuck).
8. **`/dojo` `throwing` control**: removed as redundant once dispatch keys on `attackMove`; `frame.throwing`
   kept in the `ReplayFrame` wire mirror (it mirrors what the engine emits; harmless, unread).

## Slices

Classified per the `planning` contract. All three are **behavior changes** (RED-GREEN); mutation testing
is `N/A` (`web/` not under Stryker) with the manual-mutator-scan substitute named on each.

### Slice 1: sweep renders as a low front-leg sweep

**Value**: Actor = the `/watch` spectator (and `/dojo` developer). A leg sweep that today draws as a
front hand at the bot's requested band renders as a foot reaping near the floor — a recognizable
`ashi-barai` instead of the generic pose.
**Path**: tape `attackMove:"sweep"` → `scene()` → `poseFor` reads the descriptor → `footR` driven to
(reach-to-target x, fixed near-ground y) → visible on `/watch` and the `/dojo` picker.
**Class**: Behavior change.
**Required implementation skills**: `tdd`, `testing`; `mutation-testing` = `N/A` (`web/` not under
Stryker) ⇒ manual mutator scan; `refactoring` assessed at green.
**Reduction program**: N/A.
**Transition/terminal evidence**: N/A.
**Acceptance criteria** (present + confirm before code):
- [ ] Given a frame with `attackMove:"sweep"`, `attacking:true`, a positive `attackReach`, and the
      opponent in range, when the **active** phase renders, `footR` is the driven endpoint and `handR`
      stays at its stance position (no generic hand strike).
- [ ] Given that active sweep, when it renders, `footR.y` sits at the fixed near-ground height
      **regardless of `attackBand`** (a sweep committed at mid/high does not lift the foot to that band).
- [ ] Given two different fighter gaps, when each active sweep renders, `footR.x` differs (the
      reach-to-target solve is retained — the foot tracks the opponent's near edge, M8.5).
- [ ] Given a **startup** or **recovery** phase, when the sweep renders, `footR` sits at the authored
      chamber, distinct from its active position (the wind-up reads, M8.3).
- [ ] Given `attackMove:"sweep"` with a defensively-rejected reach (reach ≤ 0 / opponent behind), when it
      renders, `footR` keeps its stance position (M7 idle fallback — no crash, no backward foot).
**RED / preservation baseline**: assert the driven endpoint + near-ground y for an active sweep — fails
today because `limbFor("sweep")` → `GENERIC_LIMB` (`handR`) and there is no `targetY` mechanism, so the
sweep draws a hand at `bandHeight(attackBand)`.
**GREEN / preservation change**: add `sweep` to the descriptor table (`{ limb:"footR", targetY:<near-
ground>, chamber:{…} }`), add an optional `targetY` to `MoveDescriptor`, and teach the strike-layer
target-y to prefer the descriptor's `targetY` over `bandHeight(attackBand)` when present. Minimum to pass.
**MUTATE / alternate evidence**: Stryker `N/A` (`web/`). Manual mutator scan over the new `targetY`
branch and the `footR` routing (boundary, conditional-negation, block-removal) — record survivors killed.
**KILL MUTANTS**: strengthen tests for any survivor (ask if value ambiguous).
**REFACTOR**: assess whether `targetY` and the existing `bandHeight` path want a shared "resolve target
y" helper — only if it adds value.
**Done when**: all criteria pass, manual scan clean, typecheck + lint green, commit approved.

### Slice 2: tobi-geri renders as a flying front kick

**Value**: Actor = the `/watch` spectator. The only airborne technique, today a hand floating in the AIR
stance, renders as a foot snapping to the band while airborne — a recognizable jump kick.
**Path**: tape `attackMove:"tobi-geri"`, `posture:AIR` → `scene()` → `poseFor` composes the AIR stance
with the kick descriptor → `footR` driven to the band, root held → visible on `/watch` and `/dojo`.
**Class**: Behavior change.
**Required implementation skills**: `tdd`, `testing`; `mutation-testing` = `N/A` ⇒ manual mutator scan;
`refactoring` assessed at green.
**Reduction program**: N/A.
**Transition/terminal evidence**: N/A.
**Acceptance criteria** (present + confirm before code):
- [ ] Given a frame with `attackMove:"tobi-geri"`, `attacking:true`, `posture:AIR`, a positive
      `attackReach`, and the opponent in range, when the **active** phase renders, `footR` is the driven
      endpoint at the band height while `footL` keeps its AIR-tucked position (the AIR stance composes
      with the kick descriptor).
- [ ] Given that active air kick, when it renders, the **hip and shoulder/head hold** (no local hip-step,
      no torso lean) — the airborne root does not travel even when the target is beyond the leg's reach.
- [ ] Given a grounded kick at the same reach (e.g. `mae-geri`) versus this air kick, when both render,
      the grounded kick's hip **steps** and the air kick's hip **does not** (the air-root-hold is
      specific to airborne, not a global change to kicks).
- [ ] Given a **startup** or **recovery** phase, when the tobi-geri renders, `footR` sits at its
      AIR-tucked stance position (no authored chamber ⇒ M7 tuck-through wind-up), distinct from the
      extended active position.
- [ ] Given `attackMove:"tobi-geri"` with a rejected reach, when it renders, `footR` keeps its AIR
      stance position (M7 fallback).
**RED / preservation baseline**: assert `footR` driven to the band + hip held for an active airborne
tobi-geri — fails today (generic `handR` strike + the kick path would step the hip if `footR` were driven
without the air gate).
**GREEN / preservation change**: add `tobi-geri` to the descriptor table (`{ limb:"footR" }`); gate the
hip-step and lean to `0` when the posture is AIR and the driven limb is a kick. Minimum to pass.
**MUTATE / alternate evidence**: Stryker `N/A`. Manual mutator scan over the new air-root gate (and the
`isKick`/AIR conjunction — conditional-negation, `&&`→`||`, block-removal) — record survivors killed.
**KILL MUTANTS**: strengthen tests for survivors; the grounded-vs-air hip contrast criterion above is the
primary guard against the gate being deleted.
**REFACTOR**: assess whether "airborne kick holds the root" reads clearly next to the mid-joint root-hold
— only if it adds value.
**Done when**: all criteria pass, manual scan clean, typecheck + lint green, commit approved.

### Slice 3: throw dispatched through the one lookup

**Value**: Actor = the `/dojo` developer (observable fix) + maintainer (unification). Selecting "throw"
in the `/dojo` picker renders the two-hand grab instead of a generic hand; all 13 moves now dispatch
through the single `attackMove` descriptor lookup, retiring the last special case. `/watch` real-throw
render is preserved byte-identically.
**Path**: tape / control `attackMove:"throw"` → `scene()` → descriptor grab-kind → two-hand grab solved
at chest height via the shared reach-to-target → visible on `/watch` and `/dojo`.
**Class**: Behavior change (with a byte-identical `/watch` invariant — the observable delta is `/dojo`).
**Required implementation skills**: `tdd`, `testing`; `mutation-testing` = `N/A` ⇒ manual mutator scan;
`refactoring` assessed at green.
**Reduction program**: N/A (this is a single-slice behavior change that also removes a mechanism; not a
`reduce-system-complexity` program — no ledger required).
**Transition/terminal evidence**: N/A.
**Acceptance criteria** (present + confirm before code):
- [ ] Given a frame with `attackMove:"throw"`, `throwing:false`, a positive `attackReach`, and the
      opponent in range (as the `/dojo` picker produces it), when it renders, **both** `handR` and
      `handL` reach the grab at chest height (front hand on the near edge, rear hand a spread behind) —
      not a generic single-hand strike.
- [ ] Given a **real `/watch` throw** frame (`throwing:true`, `attackMove:"throw"`), when it renders, the
      resulting skeleton is **identical** to the pre-refactor render (characterisation: pin the current
      grab output first, assert unchanged after).
- [ ] Given `attackMove:"throw"` with a rejected reach, when it renders, both hands keep their stance
      positions (M7 fallback), matching the old `throwGrabFor` null path.
- [ ] Given an idle fighter carrying a stale `attackMove:"throw"` but no committed reach, when it renders,
      no grab is drawn (the reach gate, not a raw boolean, decides).
- [ ] Given the `/dojo` control surface, when the lab loads, there is no `throwing` checkbox; a throw is
      previewed by selecting "throw" in the move picker (M10 free-combos with posture/guard preserved).
**RED / preservation baseline**: (a) assert the grab renders for `attackMove:"throw"` + `throwing:false`
— fails today (draws a generic hand); (b) a **characterisation test** pinning the current real-throw grab
skeleton, to guard byte-identical `/watch`.
**GREEN / preservation change**: add a grab-kind to the descriptor vocabulary + a `throw` entry; route
the grab layer in `poseFor` off the descriptor keyed on `attackMove` using the shared reach solve; remove
`throwGrabFor`'s `frame.throwing` gate and the `grab` param on `poseFor`; remove the `throwing` field from
`/dojo` `FigureControls` + its control. Keep `throwing` in `ReplayFrame`.
**MUTATE / alternate evidence**: Stryker `N/A`. Manual mutator scan over the grab-kind dispatch + the
two-hand spread (`GRAB_Y`/`GRAB_SPREAD` boundaries, conditional-negation on the reach gate) — record
survivors killed. The characterisation test is the primary guard against a silent `/watch` regression.
**KILL MUTANTS**: strengthen tests for survivors (ask if value ambiguous).
**REFACTOR**: assess whether the descriptor type is cleanest as a discriminated union (`kind:"strike" |
"grab"`) or a lighter flag — settle in this slice; also revisit the standing "generalise the mid-joint→
endpoint branches" candidate noted in `scene.ts` now that dispatch is unified. Only if it adds value.
**Done when**: all criteria pass (incl. byte-identical `/watch`), manual scan clean, typecheck + lint
green, commit approved.

## Pre-PR Quality Gate (each slice)

1. Mutation: Stryker `N/A` for `web/` ⇒ manual mutator scan recorded (survivors + kills).
2. Refactoring assessment run (record `N/A` if nothing adds value).
3. `npm run typecheck` + `npm run lint` green.
4. DDD glossary: N/A (project does not use a DDD glossary).
5. Manual `/dojo` (+ preview) eye-check that the new pose reads as its technique; pin relations by test.

## Dependencies & ordering

```
Slice 1 (sweep) ──▶ Slice 2 (tobi-geri) ──▶ Slice 3 (throw)
```

Independent by construction (each adds a descriptor + a small `poseFor` gate), sequenced visible-first:
the two spectator fixes land and can ship before the structural throw unification. Reorderable if needed;
no hard fan-in.

## On completion

When all three slices are merged: mark S6 done in `plans/move-poses-stories.md`, archive this file to
`docs/archive/move-poses-s6.md` (+ README entry) per the "archive plans, don't delete" rule, and update
`docs/STATUS.md` + the `move-showcase-arc` memory. S7 (contact sheet) and S8 (easing) remain.

---
*Archive to `docs/archive/` when complete (do not delete — project override of the planning skill's
delete footer).*
