# Plan: Replay viewer — limbs bend (elbows & knees) · "make it fight" Story 4

**Branch**: feat/fight-s4-limb-bends
**Status**: Active

Selected child story: `plans/replay-viewer-fight-stories.md` row 4 (Story 4). Resolved design:
`plans/replay-viewer-fight-decisions.md` decision 5 + M4, M-purity, M9. Stories 1–3 (`/dojo` ·
heads · world-scale) are complete + archived. **Keep 4 → 5 order** (Story 5 — strikes-connect / IK
plus the `attackReach` engine field — hard-depends on Story 4's elbow joint).

## Goal

A fighter's limbs render as jointed `shoulder→elbow→hand` / `hip→knee→foot` bones — elbows bowed
back, knees bowed forward — instead of rigid single sticks, on real `/watch` replays and in `/dojo`.

## Scope guardrails (non-negotiable)

- **Web-only.** `web/src/pages/replay/scene.ts` + `figures.ts` (+ their tests + `/dojo` tape test).
  **No `src/` / TCB / `INPUT_HASH` change** — that's Story 5's `attackReach` field, not this story.
- **Derivation lives in the pure `scene.ts`** (M-purity): the mid-joints are a pure function of the
  frame, no cross-frame state → identical on forward scrub, backward scrub, and restart. `figures.ts`
  consumes `Figure.pose` and only strokes/places nodes — it never derives.
- **No IK reach-to-target** (that's Story 5). Bends here are the _derived base_ only; per-move
  authored silhouettes + chamber→snap animation stay deferred (decisions doc "Explicitly deferred").
- **`web/` is not Stryker-reachable** → each slice's evidence is exact-assertion browser tests
  (coords recomputed independently of production) + a **manual mutator scan** + a **`/dojo` visual
  sign-off** (M9). No automated pixel/visual regression (agent-browser hangs on the Pixi canvas).

## Acceptance Criteria (story-level)

- [ ] A standing fighter's arms render `shoulder→elbow→hand` with the elbow visibly off the straight
      shoulder–hand line, bowed **backward** (Slice 1).
- [ ] A standing fighter's legs render `hip→knee→foot` with the knee off the straight hip–foot line,
      bowed **forward** (Slice 2).
- [ ] The bend reads correctly whether the fighter faces left or right (via the existing root flip).
- [ ] Striking / guarding / throwing moves the hand endpoint and the elbow **re-derives** from it —
      the bent limb follows the technique (no separate authored bend per action).
- [ ] Crouch and air stances also show bent limbs (the derivation is stance-agnostic).
- [ ] A knocked-down (PRONE) fighter renders with its **own authored** elbows and knees (all 11
      joints), not the upright derived bend.
- [ ] Every derived joint is a pure function of the frame — the same frame scrubbed forward then back
      yields identical joints.
- [ ] Replays remain byte-identical / determinism untouched — **no `src/` change** (web-only).

## Design notes (grounding the slices)

**Joint growth (M4).** `Skeleton` goes 7 → 11 joints across the two slices: `+elbowL, +elbowR`
(Slice 1), `+kneeL, +kneeR` (Slice 2). The stance constants (`STAND`/`CROUCH`/`AIR`) and the override
layers (strike `handR`, guard `handL`, `GRAB`) stay **endpoints only** — no new authored constants —
so they type as a 7-joint `Stance`; a pure `deriveSkeleton(stance)` step adds the mid-joints and
returns the draw `Skeleton`. `PRONE` (the full-body early-return override) **authors all its
mid-joints** and is returned before derivation (a downed body reshapes everything; the upright bow
rule doesn't apply). Exact type names (`Stance` vs `Skeleton`/`DrawPose`) are a GREEN detail.

**Bend rule (M4, facing note).** `poseFor` never reads `facing`; the pose is authored in a canonical
facing-right local frame and `applyFigure` flips the whole root by `facing`. So the bow direction is a
**fixed local direction** — elbow toward −x (back), knee toward +x (forward) — and the root flip makes
it read correctly for **both** facings automatically. The mid-joint is `midpoint(a, b)` offset along
the bone's perpendicular by a local-px constant, signed for back (elbow) / forward (knee). The offset
constant is authored in local px (like `STRIKE_REACH_X`) so Story 3's `scalePose` scales it uniformly.
Exact perpendicular-vs-fixed geometry is a GREEN detail, tuned by eye in `/dojo`.

**Why arms/legs is the split axis.** The derivation runs on the _final_ endpoints (after stance +
overrides), so strikes/guards/throws re-derive for free — there is **no** natural "stance bends" vs
"override bends" boundary. Arms (elbows, back) and legs (knees, forward) are distinct joints, bones,
and bow directions → the clean, independently-shippable vertical split. Arms first: they strike, and
Story 5's IK acts on the striking arm's elbow.

## Slices

Both slices are **behavior change** (RED → GREEN → MUTATE(manual scan) → KILL → REFACTOR). Both are
web-only; mutation testing is `N/A` for Stryker (web unreachable) with proportionate alternate
evidence = independent-recompute exact-assertion browser tests + manual mutator scan + `/dojo`
sign-off.

### Slice 1: Arms bend — `shoulder→elbow→hand` with the elbow bowed back

**Value**: A spectator watching any `/watch` replay (and the dev in `/dojo`) sees both arms as
jointed limbs with the elbow off the straight line — arms stop reading as rigid sticks. Legs stay
straight (Slice 2); this is a real, shippable improvement on its own.
**Actor / Trigger / Outcome**: spectator (or `/dojo` dev) at any frame → arms render bent.
**Path**: `scene()` `poseFor` derives `elbowL/R` from `shoulder`+`hand` endpoints (after stance +
strike/guard/throw overrides) → `scalePose` scales them → `createStage`/`applyFigure` places the two
new elbow nodes and strokes `shoulder→elbow→hand` → visible on the Pixi canvas. Observability:
`scene.test.tsx` joint assertions + `figures.test.tsx` node-placement assertions + `/dojo` sign-off.
**Class**: Behavior change.
**Required implementation skills**: `tdd`, `testing`, `front-end-testing` (exact-assertion browser
tests), `mutation-testing` → `N/A` for Stryker (web unreachable) + manual scan, `refactoring` (assess).
**Reduction program**: `N/A`.
**Transition/terminal evidence**: `N/A`.
**Acceptance criteria** (present + confirm before code):

- STAND → `pose.elbowL` and `pose.elbowR` are offset from the straight shoulder→hand line, on the
  **backward** side, by the bend constant (assert the derived coords, recomputed in-test).
- A mid-strike frame (attacking, a band) → `handR` is thrown forward **and** `elbowR` re-derives from
  the moved hand (elbow tracks the new endpoint, not the stance hand).
- CROUCH and AIR frames → elbows present and bent (stance-agnostic derivation).
- Knockdown (PRONE) frame → `elbowL/R` equal PRONE's **authored** values, not the upright derivation.
- Same frame computed twice / scrubbed → identical elbow joints (pure, no cross-frame state).
- After `apply(scene)`: `stage.a.elbowL/elbowR` and `stage.b.elbowL/elbowR` nodes are placed at the
  **scaled** derived elbow coords (both fighters); head + existing joints unchanged.
- Left-facing figure → the elbow reads on the correct screen side (root flip); elbow local x is
  constant, the flip carries the side.
- Existing `scene.test` / `figures.test` / `dojo-tape.test` behaviors updated to the 9-joint shape and
  green.
  **RED**: the `scene.test` STAND-elbow test (elbow property + offset) — fails to compile/exist against
  today's 7-joint `Skeleton`, then fails on value until the derivation is right. Plus the re-derive,
  PRONE-authored, stance-agnostic, and `figures.test` node-placement tests above.
  **GREEN**: split `Stance` (7 endpoints) from the draw `Skeleton` (+`elbowL/R`); add a pure
  `deriveElbows`/`deriveSkeleton` (midpoint + perpendicular backward offset, local-px constant) applied
  in `poseFor` after stance+overrides; author `PRONE.elbowL/R`; extend `scalePose`; add `elbowL/R`
  containers to `FigureNodes`/`createFigure`/`applyFigure`; replace the two arm entries in `BONES` with
  `shoulder→elbowL→handL` / `shoulder→elbowR→handR`; fix the stale "six line segments" comment.
  **MUTATE or alternate evidence**: Stryker `N/A` (web). Alternate evidence: exact-assertion tests that
  recompute the derived elbow from the imported endpoints + bend constant (independent of the production
  function) so an offset-sign / midpoint / perpendicular / constant mutant makes production disagree;
  **manual mutator scan** of `deriveElbows` + `scalePose` elbow lines + `BONES` + `applyFigure` placement.
  **KILL MUTANTS**: add any missing sign/boundary assertion the scan surfaces (ask if a bend-magnitude
  choice is a judgment call rather than a bug).
  **REFACTOR**: assess extracting a shared `deriveBend(a, b, sign, dist)` — but only **when Slice 2
  lands** (arms + legs both need it); introducing it now for one caller would be speculative generality.
  **Done when**: all ACs met; `npm test` green; typecheck + lint clean; `/dojo` arms visual sign-off
  (elbows bow back, read on both facings, strike arm bends toward the target); commit approved.

### Slice 2: Legs bend — `hip→knee→foot` with the knee bowed forward

**Value**: The spectator now sees fully jointed limbs — knees bow forward, completing the "not a stick
figure" read. Closes Story 4's stiffness fix.
**Actor / Trigger / Outcome**: spectator (or `/dojo` dev) at any frame → legs render bent too.
**Path**: mirror of Slice 1 for the legs: `poseFor` derives `kneeL/R` from `hip`+`foot`; `scalePose`
scales; `applyFigure` places knee nodes; `BONES` strokes `hip→knee→foot`.
**Class**: Behavior change.
**Required implementation skills**: `tdd`, `testing`, `front-end-testing`, `mutation-testing` → `N/A`
Stryker + manual scan, `refactoring` (assess the shared bend helper here).
**Reduction program**: `N/A`.
**Transition/terminal evidence**: `N/A`.
**Acceptance criteria** (present + confirm before code):

- STAND → `pose.kneeL` and `pose.kneeR` offset from the straight hip→foot line, on the **forward**
  side, by the bend constant (assert recomputed coords).
- CROUCH and AIR frames → knees present and bent (the AIR tucked-foot and CROUCH low stance still
  derive a sensible forward knee).
- Knockdown (PRONE) frame → `kneeL/R` equal PRONE's **authored** values (now all 11 joints authored).
- Same frame scrubbed forward/back → identical knee joints.
- After `apply(scene)`: `stage.a/b.kneeL/kneeR` placed at the scaled derived knee coords (both
  fighters); arm joints (Slice 1) + head unchanged.
- Existing tests updated to the full 11-joint shape and green.
  **RED**: `scene.test` STAND-knee test (knee property + forward offset) fails against the 9-joint
  `Skeleton`; plus stance-agnostic, PRONE-authored, and `figures.test` knee node-placement tests.
  **GREEN**: add `kneeL/R` to the draw `Skeleton`; derive (forward offset — reuse/extract the Slice-1
  bend helper); author `PRONE.kneeL/R`; extend `scalePose`; add `kneeL/R` containers to
  `FigureNodes`/`createFigure`/`applyFigure`; replace the two leg entries in `BONES` with
  `hip→kneeL→footL` / `hip→kneeR→footR`.
  **MUTATE or alternate evidence**: Stryker `N/A`; independent-recompute exact-assertion tests + manual
  mutator scan of the knee derivation + scale + BONES + placement.
  **KILL MUTANTS**: address survivors from the scan.
  **REFACTOR**: extract the shared `deriveBend(a, b, sign, dist)` now that arms + legs both use it (DRY =
  same knowledge — a 2-bone bend), if it reads clearer; keep the back/forward sign at the call sites.
  **Done when**: all ACs met; `npm test` green; typecheck + lint clean; `/dojo` legs visual sign-off
  (full 11-joint fighter reads jointed at world scale, both facings, standing/crouch/air/strike/prone);
  commit approved.

## Dependencies

- **Slice 2 → Slice 1 (soft):** reuses the `Stance`/`Skeleton` split + the bend helper; sequence 1→2.
- **Story 5 → Slice 1 (hard):** the IK reach-to-target solves the striking **arm** — needs the elbow.
- No dependency on `/dojo` control changes: bends are derived (no knob), so `/dojo` shows them for
  free and is the sign-off surface (M9). No `src/` dependency (that's Story 5).

## Pre-PR Quality Gate (each slice)

1. Mutation: Stryker `N/A` (web unreachable) → manual mutator scan recorded + independent-recompute
   exact-assertion tests.
2. Refactoring assessment: Slice 1 defers the shared helper; Slice 2 extracts it if it adds value.
3. `npm run typecheck` + `npm run lint` clean; `npm test` green.
4. DDD glossary: `N/A` (no DDD glossary in this project).
5. Manual `/dojo` visual sign-off against the pose checklist (M9).

---

_Delete/archive this file when the plan is complete (project convention: **archive** under
`docs/archive/`, don't delete — see memory `archive-plans-not-delete`)._
