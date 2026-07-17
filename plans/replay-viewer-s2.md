# Plan: Replay viewer S2 — "See the fighters do karate" (postures)

**Branch**: per-slice (`feat/replay-guard-field`, then `feat/replay-postures-*`)
**Status**: Active

Child story **S2** from `plans/replay-viewer-stories.md` (decisions:
`plans/replay-viewer-decisions.md`). S1 (walking-skeleton viewer) is complete +
archived (`docs/archive/replay-viewer-s1.md`). Prior slice memory: the viewer lives in
`web/src/pages/replay/` — pure `scene(tape,tick,viewport)` → `figures.ts` Pixi draw layer,
fed by the `transport` clock inside `ReplayPlayer.tsx`.

## Goal

The two stickmen visibly **do karate**: their on-screen bodies reflect the full pose
vocabulary carried by the render tape — stance (stand / crouch / airborne), strike
extension by height band, guard raised to a band, throw grab, and knockdown → prone →
wake-up — and the HUD flashes when a point is scored.

## Scope decision (2026-07-16, this planning pass)

The render tape already carries `posture` / `y` / `attacking` / `attackBand` / `throwing`
/ `knockdown` / `points`, so **5 of the 6 story examples are pure-viewer**. The exception —
"a guard raises to the incoming band" — is **not** in the tape: blocking is resolved
inside a tick from the fighter's `action` and leaves the persisted `state.kind` as
`"neutral"`, so `RenderFrame` has no guard signal (`posture` only encodes stand/crouch/
air). **Decision: add an additive `guardBand` render field first** (chosen over deferring
guard). The field is one line reusing the existing pure `guardBandOf(fighter, action)`
helper; it is outcome-neutral (byte-identical `runFight`), TCB- and `INPUT_HASH`-neutral,
and the `/replay` handler serializes `renderTape` verbatim so **no API change is needed**.

## Pose model (layered — 2026-07-17)

The pure `scene` emits each figure's pose as two independent dimensions plus a full-body
override, so co-occurring states render truthfully:

- **stance** — from `posture`: `stand` (0) / `crouch` (1) / `air` (2).
- **action** — from the mutually-exclusive `state.kind` fields (exactly one at a time):
  `strike(band)` (`attacking` + `attackBand`), `guard(band)` (`guardBand`), `throw`
  (`throwing`), or `none`.
- **downed** — from `knockdown`: a full-body prone override that supersedes stance + action.

`figures` composes stance × action (an **air-attack** = `air` stance + an extended striking
limb — both drawn); `downed` draws the prone override. Slice 2 establishes this two-dimension
pose type; each later slice fills one branch of one dimension. Guard and crouch cannot
co-occur (`action` is `block` XOR `crouch`), and strike/guard/throw are `state.kind`-exclusive
— so the only real cross-dimension combination is **stance:air × action:strike** (air-attack).

**Bad-code fallback (defence-in-depth).** Values are always valid from our engine, but the
derivation is written *total*: an unrecognized `posture` → `stand`; a strike/guard whose band
isn't 1–3 → `none` (no extension/guard); `downed` still overrides. An odd frame renders a safe
neutral figure — the replay never crashes or draws garbage. This default branch is explicit
and unit-tested.

## Non-negotiable invariants (unchanged)

- **#1 determinism / no persisted tape** — untouched (this story renders an existing tape).
- **TCB / security** — the only engine touch is the additive `guardBand` projection in
  `renderFrameOf` (reuses `guardBandOf`; `dsl.ts` allowlists untouched; docs never cross
  the wire). `INPUT_HASH` / `BENCHMARK_VERSION` unchanged (a render projection is not a
  scoring input). Every other slice is pure `web/`.
- **`web/src` never imports `src/`** — the tape stays a JSON view-model mirror
  (`replay-contract.ts`); `guardBand` is mirrored there as the other fields are.

## Acceptance Criteria (S2 done bar — behaviour-driven, observable)

- [x] `renderTape` emits `guardBand` (0 none / 1 low / 2 mid / 3 high) per fighter per tick;
      a blocking fighter → its guarded band, a non-blocking fighter → 0; `runFight` stays
      byte-identical (existing equality tests green); Stryker score healthy on the change.
      **Done — Slice 1, PR #313 (100% Stryker, 32/32).**
- [x] A **crouching** fighter (posture 1) is drawn in a visibly lower stance than a standing
      one; an **airborne** fighter (posture 2) is drawn in a distinct in-air pose as it
      follows the y-arc (already positioned by S1). **Done — Slice 2, PR #314 (joint-articulated
      skeleton in the pure `scene`; manual scan + synthetic-tape visual check).**
- [ ] An **attacking** fighter extends a striking limb toward the resolved band height —
      **low / mid / high** for `attackBand` 1 / 2 / 3 — and retracts when not attacking.
- [ ] An **air-attack** (airborne *and* attacking on the same tick) renders BOTH cues — the
      air stance AND the extended striking limb — not one or the other.
- [ ] A **guarding** fighter raises its guard to the incoming band height (low / mid / high),
      driven by the new `guardBand`.
- [ ] A **throwing** fighter shows a distinct grab pose (arms forward), and a **downed**
      fighter is drawn prone/horizontal, then returns upright when `knockdown` clears
      (wake-up).
- [ ] When a fighter's `points` rise, **that fighter's HUD score is highlighted** for a
      lookback window of ~N ticks (default ~30, ≈0.5 s at 60 fps) — deterministic at any
      playhead (restart/scrub-safe, frozen on pause); no highlight when no point was scored
      in the window, nor at `playhead 0`.
- [ ] An out-of-range pose code (unexpected `posture`, or a strike/guard band outside 1–3)
      renders a **safe neutral** figure (stand / no action) rather than crashing or drawing
      garbage; `downed` still overrides.
- [ ] All S1 behaviour still holds (autoplay, world→screen positions, facing, score/tick HUD,
      play/pause/restart); full suite green; typecheck + lint clean.

## Testing approach (applies to every web slice)

Per decision 12 + the S1.3a precedent: **concentrate the branchy pose maths in the pure
`scene` model** (grow `Figure`/`Scene` to carry the derived pose geometry the draw layer
needs) and keep `figures.ts` a thin stroker of that data. `web/` is **not** Stryker-reachable
(`stryker.config.mjs` mutates only `src/**`+`api/**`), so web slices use **exhaustive
exact-assertion browser tests + a mandatory manual mutator scan** ([[public-page-web-ui]]),
asserting **scene-graph state** (joint coords, child transforms, HUD text/flag) — **never
pixels** (S1.3a gotcha). Synthetic tapes via the existing `frame`/`tick` factories exercise
each pose (no dependence on which poses a real King fight happens to contain). The engine
slice (Slice 1) is `src/**` → real **Stryker**.

**Per-pose visual check.** Geometry correctness is unit-owned (display-object assertions), but
"reads as karate" is a human judgment — and the live King fight may not exercise a given pose.
So each pose slice adds a brief **manual visual look at a hand-authored synthetic tape that
contains the pose** (agent-browser on the component, or a throwaway demo render), so every pose
is seen at least once regardless of the current King fight. Out-of-band (like S1.3a's preview
smoke), not a unit test.

## Slices

All slices are **behaviour change** (no reduction program — Reduction Program section: N/A).
Slice 1 is a small **enabling** change (engine field) justified below; Slices 2–7 are pure
`web/`. Order respects the one dependency: Slice 4 (guard) consumes Slice 1's field, and
reuses the band-height geometry introduced in Slice 3 (strike). Every slice is independently
revertable, and the `/watch` route ships **dark** (#311) — partial pose vocabulary is
invisible to the public, so no feature flag is needed.

### Slice 1 — `renderTape` emits a `guardBand` per fighter

**Value**: Unlocks guard rendering (Slice 4) by putting the one missing signal on the wire;
delivers no user-visible change on its own, so it is an **enabling horizontal slice** —
justified because it is independently verifiable (render-tape test + Stryker), leaves the
tree deployable, isolates the sole TCB-adjacent touch into one tiny heavily-tested PR
(the project's engine-safety habit), and is smaller than coupling engine+viewer in one PR.
**Path**: `runFight`/`renderTape` internal `simulate` → `renderFrameOf(f, action, rules)` →
new `guardBand` field → serialized verbatim by `handle-replay` → wire. Observability:
`render-tape.test.ts` asserts the emitted field; the byte-identical `runFight` equality
tests prove the outcome path is unchanged.
**Class**: Behaviour change (additive output field). **Reduction program**: N/A.
**Required implementation skills**: `tdd`, `testing`, `mutation-testing` (Stryker, src/
reachable). `refactoring`: assess only (likely N/A — one field).
**Acceptance criteria**: For a fighter whose `action` is `block @ band` while `state.kind`
is `neutral`, `renderTape` emits `guardBand = 1|2|3` for that band; otherwise `guardBand = 0`
(attacking, throwing, downed, crouching, idle, airborne — none guards). `runFight`
`FightResult` byte-identical (existing equality/replay tests green). **Present + confirm
before code.**
**RED**: A `render-tape.test.ts` case: a tape from a scripted fight (or a targeted
`renderFrameOf`-level behaviour test through `renderTape`) where a fighter blocks a known
band → assert that tick's `guardBand` = the band code, and a non-blocking tick → 0. Add a
mixed case (blocker vs attacker) so an attacker never reads a guard.
**GREEN**: In `renderFrameOf`, `guardBand: (b => (b === null ? 0 : BAND_CODE[b]))(guardBandOf(f, action))`
(reuse the existing helper + `BAND_CODE`); add `guardBand: number` to the `RenderFrame` type.
**MUTATE**: Stryker scoped to the `renderFrameOf` change. Expect the same equivalent-mutant
class as S1.1 (the `collectRender` guard is perf-only/unobservable) — document, don't chase.
Pin the 0-vs-band and band-mapping behaviour with direct assertions.
**KILL MUTANTS**: Strengthen for any real survivor (e.g. band-code off-by-one → assert all
three of low/mid/high map distinctly; guarded-only → assert an attacker/thrower reads 0).
**REFACTOR**: Assess (expected N/A).
**Done when**: ACs met, Stryker report clean of real survivors, `runFight` byte-identical,
typecheck/lint green, commit approved.

### Slice 2 — Stance by posture (stand / crouch / airborne)

**Value**: Spectator sees a fighter **crouch** (visibly lower — the "vacates high" beat) and
sit in a distinct **airborne** pose during a jump; establishes the pose pipeline the later
slices extend. Actor: spectator. Trigger: playback reaches a tick where `posture` ≠ 0.
Observable: the croucher's head/shoulder joints sit lower than a stander's; the airborne
figure's pose differs from grounded.
**Path**: `scene(tape,tick,viewport)` derives each figure's stance from `frame.posture` and
emits the pose geometry → `figures.apply` strokes it. (S1 already maps `y`, so the jumper is
already lifted; this adds the *body* articulation.)
**Class**: Behaviour change. **Reduction program**: N/A.
**Required implementation skills**: `tdd`, `testing`, `front-end-testing`. `mutation-testing`:
**N/A (Stryker)** — web not reachable → exact-assertion + manual mutator scan. `refactoring`:
applies — this slice refactors the fixed stickman into a pose-driven skeleton (assess as part
of GREEN).
**Acceptance criteria**: `posture 1` → the figure's drawn stance is lower than `posture 0`
(assert a joint/child y is lower); `posture 2` → a distinct airborne stance (legs tucked/bent
on top of S1's y-lift — assert a leg joint differs from `posture 0`); `posture 0` → the S1
upright stance unchanged. Facing flip (`scale.x=±1`) and screen position preserved.
**Present + confirm before code.**
**RED**: `scene.test` — a synthetic frame with `posture:1` yields a pose whose head/hip joint
y is below the `posture:0` baseline; `posture:2` yields the airborne variant (tucked legs —
assert a knee/foot joint differs from the stand geometry); a `posture:9` frame falls back to
`stand` (the total-derivation default). `figures.test` — applying those
scenes moves the corresponding display-object joints (scene-graph state, not pixels).
**GREEN**: Grow `Figure`/`Scene` to carry the pose (stance-derived joint geometry); make
`figures` stroke the skeleton instead of a fixed path; branch stance on `posture`.
**MUTATE**: Manual mutator scan of the stance derivation (boundary: `posture` 0/1/2; a
swapped/dropped branch must change a joint a test pins). Record scan notes.
**KILL MUTANTS**: Add cases so each posture value maps to a distinct, asserted geometry.
**REFACTOR**: The skeleton extraction is the value here — keep `figures` thin, logic in `scene`.
**Done when**: ACs met, manual scan clean, S1 tests still green, typecheck/lint green, commit
approved.

### Slice 3 — Strike extension by band (low / mid / high)

**Value**: An **attacking** fighter throws a strike whose reach reads at the right height —
the core "doing karate" motion; the croucher's whiff and the sweep-under now read naturally
against a real extension. Observable: while `attacking`, a limb extends toward the band
height; it retracts otherwise.
**Path**: `scene` derives a strike descriptor from `frame.attacking` + `frame.attackBand` →
`figures` extends the striking limb to the mapped height.
**Class**: Behaviour change. **Reduction program**: N/A.
**Required implementation skills**: `tdd`, `testing`, `front-end-testing`. `mutation-testing`:
N/A (Stryker) → exact-assertion + manual scan. `refactoring`: assess.
**Acceptance criteria**: `attacking:true` with `attackBand` 1/2/3 → the striking limb's
endpoint is at the low/mid/high height respectively (three distinct, asserted heights);
`attacking:false` (or `attackBand:0`) → no extension (neutral limb); an **air-attack** case
(`posture:2` + `attacking:true`) draws both the air stance and the strike. Establishes the
band→height map reused by Slice 4.
**Present + confirm before code.**
**RED**: `scene.test` — `attacking:true, attackBand:3` → strike endpoint at the high y;
`2`→mid, `1`→low; `attacking:false` → neutral. `figures.test` — the striking-arm child
reaches the mapped endpoint.
**GREEN**: Add the strike branch + a `bandHeight(band)` map in `scene`; extend the limb in
`figures`.
**MUTATE**: Manual scan — the three bands must map to three distinct heights (kill a
collapsed/constant map); `attacking` gate must matter (kill "always extend").
**KILL MUTANTS**: One case per band + the not-attacking case.
**REFACTOR**: Factor `bandHeight` so Slice 4 (guard) reuses it.
**Done when**: ACs met, scan clean, suite green, commit approved.

### Slice 4 — Guard raised to the incoming band

**Value**: A **guarding** fighter raises its guard to the band being attacked (low/mid/high) —
the last story example; consumes Slice 1's `guardBand`. Observable: guard-arm height tracks
`guardBand`.
**Path**: `replay-contract.ts` mirrors the new `guardBand` field → `scene` derives a guard
descriptor → `figures` raises the guard arm to the mapped height (reuses Slice 3's
`bandHeight`).
**Class**: Behaviour change. **Reduction program**: N/A.
**Required implementation skills**: `tdd`, `testing`, `front-end-testing`. `mutation-testing`:
N/A (Stryker) → exact-assertion + manual scan. `refactoring`: assess.
**Acceptance criteria**: `guardBand` 1/2/3 → the guard arm sits at low/mid/high;
`guardBand:0` → no raised guard. A fighter can guard while standing (posture 0) — guard is
independent of stance. This is where `web/`'s `ReplayFrame` gains `guardBand`.
**Present + confirm before code.**
**RED**: `scene.test` — `guardBand:2` → guard descriptor at mid; `0` → none. `figures.test`
— the guard arm child reaches the mapped height.
**GREEN**: Add `guardBand:number` to `ReplayFrame`; add the guard branch in `scene` (reusing
`bandHeight`); raise the guard arm in `figures`.
**MUTATE**: Manual scan — three bands distinct; `guardBand:0` gate matters.
**KILL MUTANTS**: One case per band + the no-guard case.
**REFACTOR**: Assess (guard + strike may share limb-height helpers).
**Done when**: ACs met, scan clean, suite green, commit approved.

### Slice 5 — Throw grab pose

**Value**: A **throwing** fighter shows a distinct grab (arms forward/locked) so a throw
reads as a throw. Observable: `throwing:true` → grab pose; else normal.
**Path**: `scene` derives a `throwing` flag → `figures` draws the grab pose.
**Class**: Behaviour change. **Reduction program**: N/A.
**Required implementation skills**: `tdd`, `testing`, `front-end-testing`. `mutation-testing`:
N/A (Stryker) → exact-assertion + manual scan. `refactoring`: assess (expected N/A).
**Acceptance criteria**: `throwing:true` → a distinct arms-forward grab pose (asserted arm
geometry differs from neutral and from strike); `throwing:false` → unaffected.
**Present + confirm before code.**
**RED**: `scene.test` — `throwing:true` → grab descriptor; `figures.test` — arms reach the
grab geometry.
**GREEN**: Add the throw branch in `scene` + grab geometry in `figures`.
**MUTATE**: Manual scan — the `throwing` gate must matter; grab pose distinct from strike.
**KILL MUTANTS**: throwing true/false cases; a case proving grab ≠ strike geometry.
**REFACTOR**: Assess.
**Done when**: ACs met, scan clean, suite green, commit approved.

### Slice 6 — Knockdown → prone → wake-up

**Value**: A **downed** fighter is drawn prone (horizontal), then stands when `knockdown`
clears — the most dramatic beat, closing the pose vocabulary. Observable: `knockdown:true`
→ prone figure; the tick it clears → upright (wake-up).
**Path**: `scene` derives a `downed` flag → `figures` draws the prone pose; the wake-up is
the natural per-tick transition as the tape's `knockdown` flips false.
**Class**: Behaviour change. **Reduction program**: N/A.
**Required implementation skills**: `tdd`, `testing`, `front-end-testing`. `mutation-testing`:
N/A (Stryker) → exact-assertion + manual scan. `refactoring`: assess.
**Acceptance criteria**: `knockdown:true` → a prone/horizontal pose (asserted head/torso
lowered & rotated vs standing); a following tick with `knockdown:false` → the standing pose
(wake-up). `downed` overrides other poses (a downed fighter isn't also "striking").
**Present + confirm before code.**
**RED**: `scene.test` — `knockdown:true` → prone descriptor (and takes precedence over a
stale `attacking`); a two-tick synthetic tape (down then up) → prone then upright across
playhead advance. `figures.test` — the prone geometry applies and clears.
**GREEN**: Add the knockdown branch (highest precedence) in `scene` + prone geometry in
`figures`.
**MUTATE**: Manual scan — the `knockdown` gate + its precedence over strike/throw must
matter; the transition (true→false) must un-prone.
**KILL MUTANTS**: down case, up case, and a down+attacking case proving precedence.
**REFACTOR**: Assess pose-precedence ordering for clarity.
**Done when**: ACs met, scan clean, suite green, commit approved.

### Slice 7 — Score pop (HUD score highlight)

**Value**: The scoring fighter's HUD score **highlights** the moment their `points` rise —
the "that scored!" beat, held long enough to see. Observable: a fighter's HUD score lights
up for a short window after they score; nothing on flat stretches, nothing at tick 0.
**Path**: `scene` scans the tape over a lookback window ending at `playhead` to emit
per-fighter `scored` flags → the HUD/draw layer highlights that fighter's score.
**Class**: Behaviour change. **Reduction program**: N/A.
**Required implementation skills**: `tdd`, `testing`, `front-end-testing`. `mutation-testing`:
N/A (Stryker) → exact-assertion + manual scan. `refactoring`: assess.
**Acceptance criteria**: a `points` increase for A at some tick within the last N (default
~30, ≈0.5 s at 60 fps) → `hud.scoredA` true and A's HUD score is highlighted (by weight/
brightness or a glyph, **not hue alone** — colourblind-safe); no increase in
the window → false/unhighlighted; `playhead 0` → false; independent per fighter;
**deterministic** — the same playhead always yields the same result (correct after restart,
and forward-compatible with S4 scrub).
**Present + confirm before code.**
**RED**: `scene.test` — a tape where A scores at tick t: `scoredA` true across playhead ∈
[t, t+N−1], false at t−1 and at t+N (the window boundary asserted); `playhead 0` false; B
unaffected. `figures`/component — A's HUD score shows the highlight iff `scoredA`.
**GREEN**: `scene` computes per-fighter `scored` = any tick in `(playhead−N, playhead]` with
a points increase (low end guarded at 0); N a named constant; the HUD/draw layer applies the
highlight.
**MUTATE**: Manual scan — the `>` (a flat tick must not pop → kill `>=`); the window bound N
(off-by-one on the lookback range); the low-end guard (negative index); per-fighter
independence.
**KILL MUTANTS**: scoring tick, a mid-window tick, the first tick past the window (off), tick
0, and an only-B-scored case.
**REFACTOR**: Assess.
**Done when**: ACs met, scan clean, suite green, commit approved.

## Pre-PR Quality Gate (each slice)

1. **Mutation / alternate evidence** — Slice 1: Stryker report. Slices 2–7: `N/A (Stryker,
   web not reachable)` → exhaustive exact-assertion tests + a recorded manual mutator scan.
2. **Refactor assessment** — keep pose logic in the pure `scene`, `figures` thin; record N/A
   when nothing adds value.
3. **Typecheck + lint** green; full vitest suite (node + browser projects) green.
4. **Invariants** — Slice 1: `runFight` byte-identical + TCB/`INPUT_HASH` untouched. Slices
   2–7: `web/`-only, no `src/` import.
5. **Visual check** — a synthetic-tape render of the slice's pose eyeballed (agent-browser /
   throwaway demo); the live preview is a bonus, not the coverage source.

## Notes / open choices for review

- **Slice count (7).** Slices 5–7 are thin; adjacent ones (e.g. throw + knockdown) *could*
  be combined into fewer PRs if you prefer. Default keeps them separate (one observable pose
  per PR, cleanest review/revert). Say if you'd rather fold.
- **Engine field placement.** Slice 1 isolates the sole engine touch as its own tiny PR
  (recommended for TCB safety). Alternative: fold the `guardBand` field into Slice 4 as one
  engine→viewer vertical slice — smaller PR count, but mixes Stryker + web-scan concerns in
  one review. Default is the isolated Slice 1.
- **Plan commit.** This plan file needs a home — its own small `docs(plans)` PR, or ride
  along with Slice 1's branch. Your call before we start Slice 1.
- **Redraw approach (implementation hint).** Prefer transforming persistent child containers
  over re-stroking `Graphics` every frame (2 figures × ~600 ticks); a hint for the `figures`
  layer, not a mandate — TDD resolves the exact mechanism.
- **Parked — reduced-motion (a11y).** `prefers-reduced-motion` is a whole-viewer concern (it
  applies to autoplay too), broader than S2 poses — a viewer-wide follow-up, not scoped into
  S2.

## Gaps closed — find-gaps session, 2026-07-17

Resolved (8):

```
[Blocker → Pose model]      Layered stance × action + downed override; air-attack renders both cues
[Should  → Slice 7]         Score pop = HUD-score highlight over a pure ~30-tick lookback window (deterministic/scrub-safe)
[Should  → Pose model]      Out-of-range codes → total derivation defaults to a safe neutral figure
[Should  → Slice 2]         Airborne = minimal leg tuck over the S1 y-lift
[Should  → Testing/Pre-PR]  Per-pose synthetic-tape visual look (live King fight can't guarantee pose coverage)
[Nice    → Slices intro]    Dark-route (#311) rollback: partial pose vocab ships invisibly, each slice revertable
[Nice    → Slice 7]         Colourblind-safe pop: weight/brightness/glyph, not hue alone
[Nice    → Notes]           Redraw hint: transform persistent children over re-stroking Graphics
```

Parked:

```
[Nice] Reduced-motion (prefers-reduced-motion) — whole-viewer a11y follow-up, broader than S2
```

---
*Archive to `docs/archive/` when S2 is complete (per [[archive-plans-not-delete]]); the
`replay-viewer-{decisions,stories}.md` docs stay live for S3–S4.*
