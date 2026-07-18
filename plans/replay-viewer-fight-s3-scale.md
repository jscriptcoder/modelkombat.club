# Plan: Replay viewer "make it fight" — Story 3 · big fighters (world-scale)

**Branch**: feat/fight-s3-world-scale
**Status**: Active

Story 3 of the "make it fight" arc (child story from `plans/replay-viewer-fight-stories.md`,
table row 3). Design source of truth: `plans/replay-viewer-fight-decisions.md` (decision 3 · M2 ·
M11 head-size · M12 vertical-fit · M-purity). Stories 1–2 are complete + archived; this is the
first of the three shared-pose-model stories (**scale → bends → connect** — keep the order).

## Goal

A spectator watching a replay sees **big fighters at a believable fighting distance** — the body
is defined in world sub-units (scaled by the same `pxPerSubunit` that positions the fighter), so
two fighters at contact occupy a large fraction of the ring instead of being tiny figures across a
void.

## Scope & deferrals (keep the arc order)

- **In scope:** body geometry world-scaled from **one tunable height knob**; head glyph scaled to
  a proportion of that height. Straight limbs still.
- **Deferred to Story 4:** bending limbs (elbows/knees). **Deferred to Story 5:** reach-to-target
  contact precision + the `attackReach` engine field. A strike in this story keeps its current
  fixed-length forward reach (now scaled bigger) — it still does **not** aim at the opponent; that
  is Story 5. This is the _scale_ story, not the _contact_ story.
- **Web-only.** No `src/` change in Story 3 (the engine `attackReach` field belongs to Story 5).
  `web/src` never imports `src/`; `WORLD_WIDTH` stays mirrored exactly as today.

## Design decisions carried in (from the decisions trail)

- **One height knob, uniform proportional scale.** The existing reference skeleton
  (`STAND`/`CROUCH`/`AIR`/`PRONE` + the strike/guard/grab/band reach constants) already encodes
  human-ish proportions. Rather than rewrite every constant as `H × ratio`, introduce a single
  `BODY_HEIGHT_SUB` knob (sub-units) and **uniformly scale the whole local pose** by
  `bodyScale = BODY_HEIGHT_SUB × pxPerSubunit / REF_BODY_HEIGHT_PX`, where `REF_BODY_HEIGHT_PX`
  is the reference skeleton's head-to-foot span (derived from `STAND`, not a magic number). This
  satisfies "every dimension is a fixed proportion of height" with the smallest, lowest-risk diff,
  makes **all** stances/actions grow together (no half-scaled intermediate), and keeps feet planted
  on the ground line (feet at local y 0 stay at 0 under scale).
- **Knob is a module constant, tuned by eye in `/dojo`** (M2/M12) — not a runtime slider (a live
  slider is an optional nicety; see Parking lot). Initial guess `BODY_HEIGHT_SUB ≈ 240_000`
  (≈ a reference mid-punch reach; ≈ 480px tall at a 1200-wide viewport).
- **Scale lives in the pure projection.** Apply `bodyScale` inside `scene.ts`'s `figure()` so
  `Figure.pose` comes out already world-scaled in px. `figures.ts` consumes `Figure.pose`
  unchanged, so `/watch` and `/dojo` both get big bodies and the maths stays exhaustively testable
  in `scene.test` (the "numeric heart"). M-purity holds: pure function of the frame + viewport, no
  cross-frame state → identical on replay / forward-scrub / backward-scrub / restart.
- **Head glyph = 0.3 × body height** (M11). The head glyph's pixel box currently is a fixed
  `HEAD_GLYPH_PX = 44` in `figures.ts`; Slice 2 derives it from the same knob
  (`0.3 × BODY_HEIGHT_SUB × pxPerSubunit`) so the brand mark scales with the body.
- **Vertical fit (M12)** is a tuning outcome, not a blocker: big fighters + jump displacement may
  clip the top of the canvas; if extreme jumps clip, lower the knob or add canvas headroom. Tests
  assert a jump lifts without NaN; extreme-jump clipping is accepted.

## Acceptance Criteria

- [ ] A standing fighter's rendered head-to-foot height ≈ `BODY_HEIGHT_SUB × pxPerSubunit`
      (world-scaled), not a fixed ~76px — verified through the pure `scene()` projection.
- [ ] All body dimensions stay a **fixed proportion of height**: doubling the knob doubles every
      joint offset; a crouch stays proportionally shorter than a stand at the same knob.
- [ ] Feet stay planted on the ground line (local y 0) at any knob value; a jump lifts the (big)
      figure up-screen without NaN. Extreme-jump clipping is accepted (M12).
- [ ] Two fighters at a contact-distance gap (≈ the default `/dojo` 240k) occupy a large fraction
      of ring width (their combined projected extent is a large share of the viewport), no longer
      tiny figures across a void.
- [ ] The brand head glyph is ≈ 0.3 × the body's rendered height (scales with the knob and the
      viewport), not a fixed 44px dot on a big body.
- [ ] Determinism/scrub-safety preserved: the same frame projects to identical joints forward and
      backward. Replay rendering is unchanged in kind (still pure over the frame).
- [ ] Per-slice **manual visual sign-off in `/dojo`** against the checklist below (M9).
- [ ] `web/` is not Stryker-reachable → mutation `N/A`; covered by **exact-assertion browser tests + a manual mutator scan** (M9). No pixel/visual regression (agent-browser hangs on the Pixi
      canvas — scene-graph assertions + manual scan are the guardrail).

## Slices

Both slices are **behavior changes** (the rendered body/head size changes), so each follows
RED → GREEN → (MUTATE `N/A` + manual scan) → REFACTOR, PR per slice. `web/` is not Stryker-reachable,
so every slice records mutation `N/A` with proportionate alternate evidence: exact-assertion
browser tests on the pure maths/wiring + a manual mutator scan + a `/dojo` visual sign-off.

### Slice 1: A standing fighter's body scales to the ring from one height knob

**Value**: Actor = a spectator on `/watch` (and the developer in `/dojo`). Observable outcome =
fighters render **big** — a standing body ≈ `BODY_HEIGHT_SUB × pxPerSubunit` tall with all
proportions preserved, so at a contact-distance gap the two fighters nearly fill the ring instead
of being tiny. This is the walking skeleton of world-scale: the whole pose (every stance + action
override) grows together through one uniform scale.
**Path**: `scene.ts` `scene()` → `figure()` applies `bodyScale` to each `poseFor(frame)` joint →
`Figure.pose` (now world-scaled px) → `figures.ts applyFigure` places joints / strokes bones
(unchanged) → Pixi stage on `/watch` and `/dojo`. Observability: pure `scene()` output + Pixi
scene-graph joint coordinates + `/dojo` eyeball.
**Class**: Behavior change.
**Required implementation skills**: `tdd`, `testing`, `front-end-testing` (Browser Mode
exact-assertion), `refactoring` (assess after green). `mutation-testing` = `N/A` (web not
Stryker-reachable) → manual mutator scan instead.
**Reduction program**: `N/A`.
**Transition/terminal evidence**: `N/A`.
**Acceptance criteria** (present + confirm before code):

- Introduce `BODY_HEIGHT_SUB` (≈ 240_000 sub-units) and `REF_BODY_HEIGHT_PX` (the reference
  skeleton's head-to-foot span, derived from `STAND` so it can't drift), and
  `bodyScale(viewport) = BODY_HEIGHT_SUB × pxPerSubunit / REF_BODY_HEIGHT_PX`.
- A standing fighter's projected head-to-foot span == `BODY_HEIGHT_SUB × pxPerSubunit` (within
  fixed-point rounding) at a representative viewport.
- Every joint offset scales linearly with the knob: at 2×`BODY_HEIGHT_SUB` every local joint
  coordinate doubles (proportions fixed). A crouch stays proportionally shorter than a stand.
- Feet stay at screen ground (local y 0 → 0 under scale) for stand/crouch/air; a jump
  (`frame.y > 0`) lifts the figure without NaN.
- Strike/guard/grab overrides still compose and now reach proportionally further (still
  fixed-length, still short of the opponent — Story 5 owns true contact); PRONE still supersedes.
- Determinism: the same frame → identical scaled joints on a forward then backward scrub.
- `/watch` unaffected in kind (still a pure projection); existing exact-coordinate assertions
  updated to the scaled values, asserted **relative to the knob/scale** (not bare new magic numbers)
  so a scale mutant is caught.
  **RED**: In `scene.test`, assert a `STAND` frame projects to a head-to-foot span of
  `BODY_HEIGHT_SUB × pxPerSubunit` (fails today — body is a fixed 76px) and that doubling the knob
  doubles a representative joint offset. Plan for likely mutants (drop the scale factor, `×`→`÷`,
  off-by-one in the ref span, feet not anchored).
  **GREEN**: Add the constants + `bodyScale`; multiply each joint in `figure()` by `bodyScale`.
  Minimum code — no head-size change (Slice 2), no bends (Story 4).
  **MUTATE or alternate evidence**: `N/A` (web). Manual mutator scan of `scene.ts` scale maths
  (arithmetic, the ref-span derivation, feet-anchoring) + exact-assertion tests that pin each.
  **KILL MUTANTS**: `N/A` (manual). Add assertions for any gap the scan finds (e.g. a test that would
  survive dropping `pxPerSubunit` from `bodyScale`).
  **REFACTOR**: Assess extracting `bodyScale`/ref-span cleanly; only if it reads better.
  **Done when**: all Slice-1 ACs met, tests + typecheck + lint green, `/dojo` visual sign-off
  (checklist), human approves the commit. The plan file lands with this slice's PR (the S2 pattern).

### Slice 2: The brand head glyph scales to 0.3× the body height

**Value**: Actor = a spectator. Observable outcome = the model-identity head is **proportional to
the big body** (≈ 0.3× its height), not a fixed 44px mark dwarfed by the Slice-1 body. Completes
the "big fighters" look — body and head scale together at any viewport.
**Path**: `scene.ts` exports the body-height-in-px (or the knob + a helper) → `figures.ts`
`createFigure`/`createStage` sizes the head glyph to `0.3 × BODY_HEIGHT_SUB × pxPerSubunit` instead
of the fixed `HEAD_GLYPH_PX` → Pixi head glyph scale. Observability: Pixi head-glyph scale/bounds
assertions + `/dojo` eyeball.
**Class**: Behavior change.
**Required implementation skills**: `tdd`, `testing`, `front-end-testing`, `refactoring` (assess).
`mutation-testing` = `N/A` (web) → manual scan.
**Reduction program**: `N/A`.
**Transition/terminal evidence**: `N/A`.
**Acceptance criteria** (present + confirm before code):

- The head glyph's rendered box scales with the knob and viewport: head px ≈
  `0.3 × BODY_HEIGHT_SUB × pxPerSubunit` (the 24-unit geometry scales to fill it).
- The head remains **upright** (Story-2 counter-flip preserved) and still carries its brand
  `label`; the geometry stays non-empty (Story-2 `getLocalBounds() > 0` guard) for all five brands.
- Doubling the knob doubles the head box (proportional), keeping head ≈ 0.3× body height.
- `HEAD_GLYPH_PX` (the fixed 44px) is removed/replaced; no fixed-px head remains.
  **RED**: In `figures.test.tsx`, assert the head glyph's effective scale corresponds to
  `0.3 × BODY_HEIGHT_SUB × pxPerSubunit / 24` at a representative viewport (fails today — fixed
  `44/24`). Mutants to pin: wrong ratio (0.3), dropping `pxPerSubunit`, using body-width not height.
  **GREEN**: Export the needed value from `scene.ts`; compute the head glyph scale from it in
  `createFigure` (thread the viewport/scale that `createStage` already has).
  **MUTATE or alternate evidence**: `N/A` (web). Manual scan of the head-size derivation + exact
  assertions + Story-2 head tests still green (label, counter-flip, non-empty geometry).
  **KILL MUTANTS**: `N/A` (manual). Add assertions for scan gaps.
  **REFACTOR**: Assess; only if it reads better.
  **Done when**: all Slice-2 ACs met, tests + typecheck + lint green, `/dojo` visual sign-off, human
  approves the commit.

## `/dojo` visual sign-off checklist (M9 — per slice, at the default + a few states)

- **Slice 1:** at the default state (two fighters, gyaku 240k gap, challenger mid-strike vs king
  idle) the fighters read **big** and occupy a large share of the ring; proportions look human-ish;
  crouch is visibly shorter; an air/jump frame lifts without a figure vanishing or clipping
  catastrophically (mild top-clip on extreme jumps is accepted — note the knob if it's too tall);
  a strike still reaches forward (longer now) but not to the opponent (expected — Story 5).
- **Slice 2:** the brand head is clearly proportional to the body (not a tiny dot); each of the
  five brands renders upright and legible at the big size; Grok's mono ring/slash stays visible on
  the dark canvas.

## Non-negotiable invariants held

- Determinism / TCB / bounded DSL untouched — **no `src/` change** in Story 3 (web-only).
- `web/src` never imports `src/`; `WORLD_WIDTH` stays mirrored; the projection scales drawing only,
  never an outcome. M-purity: all new maths are pure over (frame + viewport), no cross-frame state.

## Parking lot (optional / deferred — not planned slices)

- **Live `/dojo` height slider** to drag-tune `BODY_HEIGHT_SUB` (faster than edit-reload for M12).
  Decisions frame the knob as a constant; a slider is a pure tuning nicety with extra control/test
  surface. Pull in only if eyeball-tuning proves painful. Owner: decision.
- **Per-stance proportion overrides** (e.g. a wider crouch base) — the uniform scale preserves the
  current proportions; if a stance wants different ratios at scale, that's a follow-on, not this
  story.

## Pre-PR Quality Gate (each PR)

1. Mutation = `N/A` (web not Stryker-reachable) → manual mutator scan recorded.
2. Refactoring assessment run (record `N/A` if nothing adds value); no reduction program.
3. `npm run typecheck` (3 tsc projects) + `npm run lint` + `npm run build:web` green;
   `npm test` green.
4. DDD glossary check `N/A` (viewer geometry, no domain glossary).

---

_Delete/archive this file when the plan is complete (this project ARCHIVES completed plans under
`docs/archive/` with a README entry — see the memory note — rather than deleting)._
