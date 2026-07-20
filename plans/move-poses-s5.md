# Plan: S5 — close-range techniques lead with the elbow / knee

**Branch**: `feat/move-poses-s5-empi` (Slice 1); `feat/move-poses-s5-hiza-geri` (Slice 2)
**Status**: Active — Slice 1 ready for AC confirmation
**Parent story**: `plans/move-poses-stories.md` § S5 · **Decisions**: `plans/move-poses-decisions.md` § **M13** (a–j), building on M1–M12

## Goal

`empi` (elbow) and `hiza-geri` (knee) each read as their own close-range technique — the **mid-joint
leads** and the fist / foot **folds back** — instead of rendering as the generic front hand.

## Why this story, and why now

S1–S4 built the descriptor mechanism, the driven-endpoint solve, phase-correct playback, fixed bone
lengths, the shoulder girdle, and a `/dojo` harness that can select any of the 13, stand the pair at
true reach, and replay from tick 0. Every strike so far drives an **endpoint** and lets `deriveBend`
compute the mid-joint. `empi` and `hiza-geri` are the only two moves that **invert** that — the driven
point is a joint the bend rule currently *computes*. S5 promotes the mid-joint to a first-class driven
`StrikeLimb`. It also lands the arc's structural **close-range overlap** (M13g): at `empi`'s 95k reach
against a 240k body the figures interpenetrate, and this is the slice that confronts it.

## Acceptance Criteria (S5 overall)

- [ ] A spectator can tell an `empi` from a punch — the **elbow** leads to contact and the fist folds back
- [ ] A spectator can tell a `hiza-geri` from a kick — the **knee** leads to contact and the foot folds back
- [ ] `deriveSkeleton` does **not** overwrite the driven elbow / knee (M13i-7 — the assertion the slice turns on)
- [ ] At their true (short) reach the figures overlap and the strike still reads *as a strike* (M13g accepted, with the `/dojo` sign-off tripwire)
- [ ] **No `src/` touch**, `BENCHMARK_VERSION` unchanged at `v19`, **no `reach-presets.ts` / `Arsenal.tsx` change** (both moves already carry engine data since Batch-1; the coverage test accepts `DESCRIBED_MOVES ⊆ REACH_PRESETS`)

## Test discipline (whole story)

`web/` is **not Stryker-reachable** (the arc's standing convention). So "MUTATE" for every slice is
`N/A — Stryker`, and its proportionate substitute is the arc's established triple:

1. **Exact-assertion browser tests** in `scene.test.tsx` (values computed from the same viewport + world
   constants the production formula uses — never copied from output), holding the **M13(i) floor**: the
   translated M8 six + the anti-clobber guard (7).
2. A **manual mutator scan** of the changed `scene.ts` / `move-descriptors.ts` lines against
   `mutation-testing`'s `resources/mutator-rules.md` — each candidate mutant named, with the test that
   kills it (or a documented reason it is dead / equivalent, as slice 3/5 of S4 did for the redundant
   `winding` gates).
3. **`/dojo` visual sign-off** — select the move, scrub startup → active → recovery, confirm the read
   and the M13g overlap tripwire (does the clinch read as infighting, or as a z-fighting bug?).

Tests live in `scene.test.tsx` and MUST be `.tsx` (the web include glob skips `.test.ts`).

---

## Slice 1 — `empi`: the elbow leads to contact and the fist folds back

**Value**: *Actor* — the spectator at `/watch` (and the developer in `/dojo`). *Outcome* — a committed
`empi` renders as an elbow strike: `elbowR` drives to the opponent's near edge at the band, the fist
`handR` folds back, the root holds. This is the **mechanism-carrier** slice — it makes a mid-joint a
first-class driven `StrikeLimb` end to end, so it either proves or disproves the whole inversion.

**Path**: `attackMove: "empi"` on a render frame → `poseFor` routes `elbowR` as the driven point through
the existing `reachTargetX` solve → `deriveSkeleton` runs, then the driven mid-joint is applied as the
final layer → `scalePose` → the Pixi draw layer strokes `shoulderR → elbowR → handR`. Observable in
`scene.test.tsx` (pure) and by eye in `/dojo` (picker already offers `empi`; **no `/dojo` code change**).

**Class**: Behavior change.

**Required implementation skills**: `tdd`, `testing`; `mutation-testing` → `N/A — Stryker` (substitute:
the triple above); `refactoring` → assess after green (the `isKick` → arm/leg generalisation is the
likely candidate).

**Reduction program**: N/A.

**Blast radius**: `web/src/pages/replay/move-descriptors.ts` + `web/src/pages/replay/scene.ts` +
`web/src/pages/replay/scene.test.tsx`. Nothing else.

### Mechanism (how the routing changes — for reviewer context, not a spec)

- **`move-descriptors.ts`**: extend `StrikeLimb` to `"handR" | "handL" | "footR" | "footL" | "elbowR" |
  "elbowL" | "kneeR" | "kneeL"`. Add `tuck?: Joint` to `MoveDescriptor` (the fist/foot fold, **relative
  to the driven joint**, M13c) and a `tuckFor(move)` accessor (TOTAL, same shape as `chamberFor`). Add
  the `empi` descriptor: `{ limb: "elbowR", chamber: {…}, tuck: {…} }` — values authored by eye in
  `/dojo`, relations pinned.
- **`scene.ts`**:
  - A driven **mid-joint** is `elbow*` / `knee*`. Gate **both `lean` and `step` to 0** for a driven
    mid-joint (M13f). Nuance to know going in: with today's `rootTravel` (measured against **2×
    `ARM_BONE`** ≈ 31px), `empi`'s target (~24–30px) is *already* within reach, so `lean` computes to 0
    for `empi` **without** the gate — the gate is the explicit **encoding of the decision**, a standing
    guard against a future 1-bone measure, and it becomes load-bearing for `kneeR` (a knee measured off
    the *shoulder* is conceptually wrong even when it numerically lands 0). So do not expect the "no
    lean" test to drive green on its own — the RED driver is the routing (below). Girdle stays square
    automatically (`lean` = 0).
  - The trailing endpoint: write `handR = drivenPoint + tuck` into the endpoints (so the fist rides with
    the elbow across phases — chamber and active alike, since `driven` already switches between
    `chamberFor` and the solved target).
  - After `deriveSkeleton`, **apply the driven mid-joint as a final layer**: `skeleton.elbowR =
    drivenPoint`. This realises M13(b)'s "skip the driven mid-joint" *observably* — the derived value is
    discarded — while keeping `deriveSkeleton` total and unchanged. (Whether to make it a real `skip`
    parameter instead is a REFACTOR judgement, not required for green.)
  - The endpoint-routing ternary extends with the mid-joints exactly as S4·Slice 6 extended it for
    `footL` — an explicit branch per limb, never a computed `[limb]: driven` key (M7 totality: an
    unrecognised limb must fall to the generic front hand, not silently add a junk property).

### TDD increments (one PR; each an exact-assertion test in `scene.test.tsx`)

**Increment 1 — the elbow drives to contact at the active phase (walking skeleton).**
- **RED**: with `a` committing `empi` (active phase, in range), assert on `a`'s scaled pose:
  - `elbowR` sits at the solved reach-to-target `{ x: reachTargetX, y: bandHeight }` (computed from the
    viewport/world constants, as the existing strike tests do) — **guard 7 (anti-clobber)**: this value
    is *not* the `deriveBend(shoulderR, handR)` bisector the old path would produce.
  - `handR` (the fist) sits at `elbowR + tuck` — **and is not collinear** with `shoulderR → elbowR`
    (guard 6, jointedness: the forearm folds at an angle).
  - `footL`, `footR`, `handL` unchanged from stance; `head.x` / `shoulder.x` at stance x (**no lean** —
    guards 1 + 2 + the M13f root-held rule; a *standing* guard, numerically already 0 at `empi`'s reach,
    not the RED driver).
  - **solve retained (guard 5)**: two different gaps yield two different `elbowR.x`.
  - **The RED driver**: today `elbowR` is unrecognised by the endpoint ternary and falls to `{ handR:
    driven }`, so the *front hand* is driven and `elbowR` is only the derived bisector — the "elbowR at
    the solved target" assertion fails for exactly the right reason until the routing exists.
- **GREEN**: extend `StrikeLimb`; add the `empi` descriptor (`limb`, `tuck`); route `elbowR` (write
  `handR = driven + tuck`, apply `elbowR = driven` post-derive); gate `lean` + `step` to 0 for the
  mid-joint (M13f).

**Increment 2 — `empi` winds up and recovers through a chamber.**
- **RED**: with `a` committing `empi` at the **startup** phase, `elbowR` sits at the authored chamber
  (cocked back), the fist at `chamber + tuck`; **phase distinctness (guard 3)**: startup / active /
  recovery `elbowR` are pairwise different; **direction (guard 4)**: active `elbowR.x` is forward of the
  startup `elbowR.x`; recovery (phase 3) `elbowR` equals the chamber.
- **GREEN**: add `chamber` to the `empi` descriptor. The existing `driven = winding ? chamberFor :
  target` path already routes it to the (now elbow) driven point — near-free, exactly as S1→S2 split
  active then chamber for `mae-geri`.

**MUTATE**: `N/A — Stryker`. Substitute: exact-assertion tests above + manual mutator scan of the changed
lines (name each candidate — the classification boolean, the `+ tuck` sign, the post-derive override,
the ternary branch — and its killing test) + `/dojo` sign-off.

**KILL MUTANTS**: address survivors from the manual scan; ask if a survivor's value is ambiguous.

**REFACTOR**: assess generalising `isKick` into a named arm-vs-leg / mid-joint classification (it is the
line most likely to read badly once four mid-joints exist), and whether `strikeHandFor` / `driven`
should be renamed to "driven point" now that they land on an elbow. Only if it adds value.

**Acceptance criteria (Slice 1 — present and confirm before any code)**:
- [ ] A committed `empi` at the active phase drives `elbowR` to the opponent's near edge at the band; the
      fist `handR` folds to its tuck; the root does not lean or step
- [ ] The final `elbowR` is the solved target, **not** the `deriveBend` bisector (guard 7)
- [ ] The limb reads jointed — `handR` is not collinear with `shoulderR → elbowR` (guard 6)
- [ ] Startup / active / recovery give three different `elbowR` positions, active forward of startup
      (guards 3 + 4); recovery reuses the chamber
- [ ] Two opponent gaps give two different active `elbowR.x` (guard 5, solve retained)
- [ ] `footL` / `footR` / `handL` and the head/shoulder x are unchanged from stance (guards 1 + 2, root held)
- [ ] Every other move renders exactly as before (M7 totality — an unknown / absent `attackMove` still
      falls to the generic front hand)
- [ ] `/dojo` sign-off: select `empi`, scrub the phases, confirm the elbow reads *and* the M13g overlap
      tripwire (infighting, not a z-fighting bug)

**Done when**: all Slice-1 criteria met, the manual mutator scan is clean, typecheck + lint + the full
web suite are green, and the human approves the commit.

---

## Slice 2 — `hiza-geri`: the knee leads to contact and the foot folds back

**Value**: *Actor* — the spectator / developer. *Outcome* — a committed `hiza-geri` renders as a knee
strike: `kneeR` drives up to the mid band, the foot `footR` folds back under the hip, `footL` stays
planted as the support leg. **Reuse slice** — it adds the **leg** branch of the mid-joint mechanism
Slice 1 built and exercises the other classification arm.

**Path**: as Slice 1, but the driven mid-joint is `kneeR` (rooted at the single `hip`, no hip girdle),
the trailing endpoint is `footR`, and the support foot `footL` must stay planted.

**Class**: Behavior change. **Skills**: as Slice 1. **Reduction program**: N/A.

**Blast radius**: `move-descriptors.ts` (add the `hiza-geri` descriptor: `{ limb: "kneeR", chamber,
tuck }`) + `scene.ts` (extend the trailing-endpoint routing so a driven `kneeR` folds `footR` not
`handR`, and confirm `step` gates to 0 for a knee) + `scene.test.tsx`.

**Increments** (one PR): (1) active phase — `kneeR` drives to the mid band, `footR` folds to its tuck,
`footL` planted, `hip` held (no step); guards 1/2/5/6/7 translated to the leg. (2) chamber — knee low
and back, phase distinctness + direction (guards 3/4), recovery reuses the chamber.

**MUTATE**: `N/A — Stryker`; same substitute triple, with special attention to the **support-foot
integrity** assertion (guard 2 — `footL` unchanged while `footR` lifts) and the leg-branch routing
mutant (knee must fold `footR`, not `handR`).

**Acceptance criteria (Slice 2 — present and confirm before any code)**: mirror Slice 1's list with
`kneeR` / `footR` / `footL`, plus: the support foot `footL` is unchanged from stance while `footR` lifts
to its tuck; the `hip` does not step forward.

**Done when**: all Slice-2 criteria met, manual scan clean, suite + typecheck + lint green, human
approves. This **closes S5** (both moves authored); archive the plan per the arc convention
(`docs/archive/move-poses-s5.md` + README entry), update `docs/STATUS.md` and
`plans/move-poses-stories.md` (mark S5 ✅), and record the M13g overlap outcome (accepted, or tripwire
fired → bespoke treatment parked).

## Pre-PR Quality Gate (each slice)

1. MUTATE → `N/A — Stryker`; the substitute triple complete (exact tests + manual scan + `/dojo` sign-off)
2. Refactoring assessment run (record `N/A` if nothing adds value)
3. `npm run typecheck` + `npm run lint` green; full web suite green
4. DDD glossary check → N/A (project does not use DDD)

---
*Delete this file when S5 is complete (both slices merged + archived). If `plans/` is empty, delete the directory.*
