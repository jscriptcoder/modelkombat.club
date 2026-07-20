# Plan: Replay strike makes visible contact

**Branch**: `plan/replay-strike-contact` (this plan doc) → one feature branch per slice
**Status**: ✅ Complete & archived — both slices shipped (S1 #380, S2 #381). All
acceptance criteria met; visually confirmed on `/watch`.

## Goal

On `/watch`, a scored strike visibly connects: the striking limb is fully extended
into the opponent on the scoring tick, and an impact flash marks where it landed —
so a viewer who pauses on the point can see the hit, not a chambered limb.

## Background (why this exists)

Investigated live via fight `8b88edab…` (Latent Crane 10 – 1 shotokan-counter). The
engine only ever awards a point _inside_ a strike's active window
(`elapsed ∈ [startup, startup+active)`, `sim.ts:852`), and all five scores in that
fight land on a rendered `active` tick — so the tape is correct. The defect is
purely in the viewer: `easeDriven` (`web/src/pages/replay/scene.ts:327`) snaps the
limb to full extension on the **first** active tick and then eases it **back toward
the chamber across the rest of the active window**. The point registers a tick or
two later, by which time the limb is 50–100 % retracted (for the two body punches
in that fight, fully re-chambered). Contact is a single-frame blip.

Key enabling fact: **the score always falls within the active window**, so holding
full extension across the whole active window is guaranteed to cover the scoring
tick — no engine change, no off-by-one to chase.

## Non-negotiable constraints (both slices)

- **Web-only.** No `src/` (engine) change; no TCB / DSL / `v19` / `INPUT_HASH`
  touch. Mirrors the whole move-showcase arc.
- **`/sheet` (S7) byte-identical.** The contact sheet samples `scene(tape,
preset.startup, …)` — the _first_ active tick (`contact-sheet.ts:58`). That tick
  is full extension today and must stay full extension.
- **`/dojo` single-tick previews byte-identical.** The pose lab drives length-1
  synthetic tapes; every `easeDriven` `length <= 1` fallback must return exactly
  what it returns today (active → `extension`, startup/recovery → `chamber`).
- **Purity preserved.** Any new derivation is a pure scan of the tape at the
  playhead (the `scoredWithin` / `phaseRunAt` idiom) — no cross-frame state, so it
  is identical on replay, restart, and any scrub direction.

## Acceptance Criteria

- [x] On a multi-tick active run, the striking limb's driven point is at **full
      extension on every active tick** (not just the first) — so the scoring tick
      shows the limb extended into the opponent. _(Slice 1, #380)_
- [x] The retract now happens during **recovery**: a recovery run's first tick is at
      (or near) full extension and eases to the neutral stance across the run. _(Slice 1, #380)_
- [x] `/sheet` and `/dojo` single-tick previews render **identically** to before
      (first-active-tick extension; all `length <= 1` fallbacks unchanged). _(Slice 1, #380)_
- [x] When a fighter scores, an **impact flash appears at the struck point** and
      **fades out over ~15–30 ticks**, then disappears; no flash on non-scoring
      ticks (a blocked/defended in-range strike that scores nothing shows nothing —
      no separate block cue in v1). _(Slice 2, #381)_
- [x] The flash is **per scorer**: a same-tick trade (both fighters score) flashes
      **both** landing points; each side is independent. _(Slice 2, #381)_
- [x] The flash is **anchored in world space at the struck point on the scoring
      tick** and fades **in place** — it does not move or drift when the fighters
      reset (yame) during the fade. _(Slice 2, #381)_
- [x] The flash position is a pure function of the tape at the playhead (correct
      after a backward scrub or a restart). _(Slice 2, #381)_
- [x] No engine / TCB / `v19` / `INPUT_HASH` change; typecheck + lint + the full
      `web` test suite pass. _(both slices, #380 + #381)_

## Reduction Program

N/A — both slices are behavior changes, not a mechanism-reduction program.

## Slices

Both slices are **behavior changes** (viewer-observable), TDD RED-GREEN with a
manual mutator scan (the `web` project is not under Stryker — see the standing
web-mutation convention: exhaustive exact-assertion tests + a manual survivor
scan). PR per slice; Slice 1 alone fixes the reported defect.

### Slice 1: A scored strike's limb stays extended into the opponent across the active window

**Status**: ✅ Shipped — PR #380, squashed to `main`@`062c430`. Visually confirmed on
`/watch` (Playwright stills at scoring ticks 86 `★2:1` and 153 `★10:1`, arm/kick
driven into King). Manual mutator scan clean; `web` suite green.
**Branch**: `feat/replay-kime-hold`
**Value**: Actor = anyone watching a fight on `/watch`. Today, pausing on a scoring
tick shows a chambered (retracted) limb, so the hit is invisible. After this slice
the limb is drawn fully extended at the opponent for the whole contact window
(which always contains the scoring tick), reading as a landed strike.
**Path**: `renderTape` (unchanged) → `scene()` → `easeDriven` active + recovery
branches → `poseFor` driven point → `figures.applyFigure` bones. Observable on
`/watch` and asserted through `scene()`'s pure projection.
**Class**: Behavior change.
**Required implementation skills**: `tdd`, `testing`; `mutation-testing` = `N/A`
for the `web` project (Stryker is node-only here) → substitute the standing
exact-assertion + manual-survivor-scan evidence; `refactoring` assessed at GREEN.
**Reduction program**: N/A.
**Transition/terminal evidence**: N/A.
**Acceptance criteria** (confirm before code):

- For an active run of length ≥ 2, `easeDriven(phase=2, index, length, …)` returns
  the `extension` keyframe for **every** `index` (full hold), not a chamber-ward
  blend.
- For a recovery run of length ≥ 2, the driven point eases from `extension`
  (index 0) to `stance` (index `length-1`) — the retract lives here now.
- `easeDriven` `length <= 1` fallbacks are unchanged: active → `extension`,
  startup → `chamber`, recovery → `chamber`.
- `scene(tape, startup-tick)` for a synthetic active run still yields the same
  first-active-tick pose as today (guards `/sheet` + `/dojo`).
- The hold applies to **every** committed strike in its active window regardless of
  outcome — a scoring, whiffing (extends toward the target, clamped to reach, i.e.
  into space), or blocked strike all hold; grounded and airborne (`tobi-geri`) alike.
  A **cancel** (active window cut short, no recovery, e.g. `gyaku-zuki`→`mawashi-geri`)
  is bounded naturally by `phaseRunAt`: the punch's held extension cuts directly to
  the next move's chamber with no interpolated retract, and no special-casing is added.
  **RED**: In `scene.test.tsx`, a failing test that builds a multi-tick active run and
  asserts the driven endpoint equals the solved extension on the _last_ active tick
  (currently it has re-chambered → fails). A second failing test asserts a recovery
  run's first tick sits at extension, not chamber. Existing tests that pin the old
  mid-active retract are updated to the new intent as part of RED (they encode the
  behavior we are deliberately changing).
  **GREEN**: In `easeDriven`, the `phase === 2` branch returns `extension` for the
  multi-tick case (drop the `chamber→extension→chamber` blend); the `phase === 3`
  branch blends `extension → stance` instead of `chamber → stance`. Leave all
  `length <= 1` returns as-is.
  **MUTATE or alternate evidence**: `mutation-testing` = `N/A` (web/Stryker). Manual
  mutator scan over the changed `easeDriven` branches: verify a test dies if the
  active branch is reverted to the blend, if recovery's start keyframe flips back to
  `chamber`, and if a `length <= 1` guard is dropped.
  **KILL MUTANTS**: Add/strengthen exact-assertion tests for any survivor found.
  **REFACTOR**: Only if the active branch simplification leaves dead helpers (e.g. an
  unused `smoothstep`/`lerpJoint` path) — remove only if genuinely unused; both are
  still used by startup + recovery, so likely `N/A`.
  **Done when**: All slice AC met, manual scan clean, typecheck/lint/`web` suite
  green, `/sheet` + `/dojo` visually unchanged (agent-browser smoke), human approves
  the commit.

### Slice 2: A scored strike flashes an impact mark where it lands

**Status**: ✅ Shipped — PR #381, squashed to `main`@`1462672`. Visually confirmed on
`/watch` (Playwright stills at ticks 86 `★2:1` gyaku, 92 the fade holding in place as
the fighters separate, 153 `★10:1` mawashi kick on the head). Manual mutator scan
killed all six named survivors; `web` suite 613/613 green.
**Branch**: `feat/replay-contact-flash`
**Value**: Actor = viewer on `/watch`. On top of the now-visible extended limb, an
impact starburst at the struck point makes "a point landed HERE" unmistakable and
independent of limb-timing subtlety — the readability cue.
**Path**: `scene()` computes a pure **per-fighter** `contact: { a: Mark | null, b:
Mark | null }` (`Mark = { x, y, age }`) by scanning back from the playhead to the
last tick each fighter's `points` rose within the window (`scoredWithin` idiom), then
taking **that score tick's geometry** — the scoring fighter's committed-action target
on the opponent (a strike's reach-to-target endpoint at the struck band; a throw's
grab point at chest height) — so the mark is **fixed in world space** and ages in
place. `figures.createStage`/`apply` draws a `Graphics` starburst per non-null side
with alpha derived from `age`, cleared when `null`.
**Class**: Behavior change.
**Required implementation skills**: `tdd`, `testing`; `mutation-testing` = `N/A`
(web) → exact-assertion + manual-survivor-scan; `refactoring` assessed at GREEN.
**Reduction program**: N/A.
**Transition/terminal evidence**: N/A.
**Acceptance criteria** (confirm before code):

- **Per scorer.** Within the flash window after fighter X's `points` rose,
  `scene().contact.X` is non-null; the other side is independent. A same-tick trade
  yields **both** `contact.a` and `contact.b` non-null.
- **Score only.** A mark appears only when that fighter's `points` increased; a
  blocked/defended in-range strike that scores nothing yields `null` (no block cue).
- **Fixed anchor.** The mark's `x, y` are the struck point on the **scoring tick**
  (looked up by scanning back to that tick), not the current playhead's geometry —
  so it does not move or drift when the fighters yame-reset during the fade. `age`
  counts ticks since the score.
- **Struck point = committed-action target.** For a strike, the reach-to-target
  endpoint at the struck band; for a **throw** score, the grab point at chest height
  (the `throwGrabFor` solve). No band is required.
- **Outside the window / no recent score for a side → that side is `null`.**
- `contact` is a pure function of `(tape, playhead, viewport)` — a backward scrub to
  just after a score reproduces the same flash; scrubbing before the score clears it.
- The Pixi layer draws a flash per non-null side whose opacity decreases with `age`
  and is absent when `null`; the flash never displaces or restyles the fighters/HUD.
  **RED**: In `scene.test.tsx`, a failing test that a scoring tick (and a tick a few
  frames later, within the window) yields a `contact` at the expected coordinates and
  `age`, and that a pre-score / far-past tick yields `null`. In `figures.test.tsx`, a
  failing display-object assertion that a flash node exists at the contact position
  with age-scaled alpha and is cleared when `contact` is `null`.
  **GREEN**: Add the pure per-fighter `contact` derivation to `scene()` — scan back to
  each side's last score tick within the window, take that tick's committed-action
  target (reuse `reachTargetX` at the struck band for a strike, `throwGrabFor` chest
  point for a throw); window mirrors `SCORE_POP_TICKS`. Extend `Scene` with
  `contact: { a, b }`. Add a per-side `Graphics` flash to `createStage`, drawn in
  `apply` with age-scaled alpha and cleared on `null`.
  **MUTATE or alternate evidence**: `mutation-testing` = `N/A` (web). Manual mutator
  scan: a test dies if the window bound is widened/narrowed, if the age→alpha relation
  is inverted, if the struck-point is taken from the **current** tick instead of the
  **score** tick (anchor drift), if a strike vs throw target is mis-picked (band vs
  chest), if the two sides are collapsed to one (trade drops a mark), or if the `null`
  clear is dropped.
  **KILL MUTANTS**: Add exact-assertion tests for survivors.
  **REFACTOR**: Factor a shared "score event at/near playhead" scan if `scoredWithin`
  and `contact` duplicate the lookback meaningfully; only if it adds clarity.
  **Done when**: All slice AC met, manual scan clean, typecheck/lint/`web` suite
  green, agent-browser smoke shows the flash at the landing point fading out, human
  approves the commit.

## Open decisions to confirm before Slice 1 code — RESOLVED (Slice 1)

- **Recovery retract feel over long runs.** ✅ Chose **(a)** plain `smoothstep` over
  the whole recovery run (`extension → stance`). Reads fine by eye; no front-loading.
- **Length-1 recovery fallback.** ✅ Kept returning `chamber` — the `length <= 1`
  guard is unchanged, so `/dojo` single-tick recovery previews stay byte-identical.

## Slice 2 implementation notes (implementer-owned, pin in RED)

- **Throw score tick may not be grab-committed.** A throw scores on finish, by which
  point the attacker's frame can be in throw-recovery/finish rather than a grab
  frame, so `throwGrabFor` at the exact score tick may be `null`. The derivation must
  fall back to the nearest in-window grab-committed frame (or suppress the mark if
  none exists) — otherwise the "throws flash" decision silently no-ops. Pin with a
  test in RED.
- **Flash duration/feel is dojo-tunable** (nice-to-have): the window length
  (≤ `SCORE_POP_TICKS`) and the age→alpha curve are eye-tuned in `/dojo`; no test
  pins the exact values (decision-9 style), only the monotone fade + the clear.

## Pre-PR Quality Gate (each slice)

1. Manual mutator scan (web is not under Stryker) — documented survivors addressed.
2. `refactoring` assessment — record `N/A` if nothing adds value.
3. `npm run typecheck` + `npm run lint` pass; full `web` vitest suite green.
4. DDD glossary check — N/A (project does not use a DDD glossary here).
5. agent-browser out-of-band smoke on `/watch` (and `/sheet` for Slice 1
   non-regression); note Pixi pages can hang agent-browser — capture a still.

---

_Delete this file when the plan is complete. If `plans/` is empty, delete the directory._
