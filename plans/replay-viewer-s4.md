# Plan: Replay viewer — S4 · Control playback (transport)

**Branch**: per-slice (each slice cuts its own branch / PR). Current: `feat/replay-transport-speed` (Slice 2).
**Status**: Active. **Slice 1 MERGED** (PR #325 · `5e1337f`, 2026-07-17) — scrub bar + end-of-fight auto-pause live. Next: **Slice 2** (speed buttons) — branch cut, awaiting CONFIRM-gate approval before any code.

## Goal

A spectator watching a fight can **control playback** — scrub to any tick, change speed, and
step frame-by-frame — so they can rewatch the decisive moment and study a bout in detail.

## Context & scope (read before slicing)

- **Web-only story.** S1 already ships the whole `/replay` API and the render tape carries every
  tick; S4 adds **no `src/` / `api/` / engine surface**. Every decision is a `web/` concern in the
  existing `ReplayPlayer` + its pure `transport` clock.
- **Decisions:** `plans/replay-viewer-decisions.md` → _"S4 grill-me — resolved (2026-07-17)"_
  (S4-1…S4-7: native scrub slider, grab-pauses-stays-paused, end-of-fight auto-pause, discrete
  speed buttons, dedicated frame-step buttons, keyboard shortcuts parked, `tick N / M` readout).
- **What it builds on:** the pure `transport` clock (`Transport = { playhead, playing }`;
  `advance(t, delta, lastTick)` clamps to `lastTick`; `startTransport()` is also the restart
  target; `togglePlaying`) in `transport.ts`, driven by the Pixi ticker in `ReplayPlayer.tsx`
  (~one engine tick per rendered frame). Today's controls are just Play/Pause + Restart.
- **Model shape after S4:** `transport.ts` gains exactly two behaviors — `advance` **auto-pauses**
  at `lastTick`, and a new `seek`/`step` pair (integer, clamped, pausing). **Speed is not in the
  model** — it's a reactive signal applied to the ticker delta (`advance(t, deltaTime × speed, …)`).

## Non-negotiable invariants (all preserved — viewer-only change)

- **#1 determinism / no persisted tape** — untouched; scrubbing renders `scene(tape, tick)`, pure.
- **TCB / security / `INPUT_HASH` / `BENCHMARK_VERSION`** — untouched; no engine or DSL code runs.
- **`web/src` never imports from `src/`** — the player consumes the tape as a local view-model.

## Testing regime (inherited from S2/S3 — `web/` is not Stryker-reachable)

`stryker.config.mjs` mutates only `src/**` + `api/**`, so every S4 slice records **Mutation:
N/A (Stryker)** and substitutes the proportionate-evidence regime:

- **Pure `transport` transitions** (`advance` auto-pause, `seek`, `step`) unit-tested in
  `transport.test.tsx` with **exact `toEqual` boundary assertions** across their input space
  (the file's established pattern — clamp, round, pause, at/over the ends).
- **Exact-assertion browser tests** in `ReplayPlayer.test.tsx` over every new DOM control —
  the scrub `slider` (role, `min`/`max`/`aria-valuetext`, input→seek→pause), the `tick N / M`
  readout, the speed buttons (`aria-pressed`), the frame-step buttons (advance + disabled-at-ends).
  Assert DOM/control state and labels, **never pixels** (the scene mapping is proven in
  `scene.test`/`figures.test`).
- **Mandatory manual mutator scan** of each changed file (the un-unit-testable ticker wiring —
  `deltaTime × speed`, the live-track slider write — plus gate flips / off-by-one on clamps),
  documented in the slice write-up.
- **`agent-browser` preview smoke** (out-of-band) on the Vercel preview: drag-to-seek, a speed
  change, and a frame-step, per slice.

## Acceptance Criteria (whole-story done bar)

- [x] Dragging the scrub bar seeks the fight to that tick **deterministically**; on release the
      clock **stays paused** on that tick. _(Slice 1)_
- [x] During playback the scrub bar **live-tracks** the playhead, and a **`tick N / M`** readout
      (agreeing with the HUD tick) shows position + the fight's final tick. _(Slice 1)_
- [x] When the playhead reaches the last tick the clock **auto-pauses** — the Play control
      reappears (no longer frozen on Pause over the final frame). _(Slice 1)_
- [x] **Scrubbing backward then pressing Play** resumes playback correctly from the new tick. _(Slice 1)_
- [ ] Speed buttons **0.5× / 1× / 2×** change the playback rate; the active rate is indicated
      (`aria-pressed`), default **1×**. _(Slice 2)_
- [ ] Frame-step **◀ / ▶** advances/retreats **exactly one tick** (pausing first), and each button
      is **disabled at its end** (◀ at tick 0, ▶ at the last tick). _(Slice 3)_
- [ ] Every transport control is **keyboard-operable** via native focus semantics (Tab + Enter/Space
      on buttons, ←/→ on the focused scrub slider); the scrub slider exposes `aria-valuetext`.
- [ ] No `src/` / `api/` / TCB / `INPUT_HASH` change; `web/src` does not import `src/`; the route
      stays **dark** (no Nav link; the "Fight replays — in development" teaser stays a non-link).

## Slices

Scrub-first: it's the centerpiece (biggest value) and carries the two `transport` model changes;
speed and frame-step then layer on independently. Each slice is a **behavior change** and leaves a
coherent deployable checkpoint. All three are `web/`-only.

---

### Slice 1: A scrub bar seeks to any tick (and the fight auto-pauses at the end)

**Value**: A **spectator** watching a fight drags a scrub bar to jump to any tick — deterministically
— to rewatch a moment; a `tick N / M` readout shows where they are, and the fight now stops cleanly
at the end instead of freezing on Pause.
**Path**: `ReplayPlayer` renders a native `<input type=range min=0 max=lastTick step=1>` in
`.replay-controls`; its value live-tracks `Math.round(playhead)` each ticker frame; `onInput` →
`setTransport(seek(transport(), value, lastTick))` (sets playhead + `playing=false`, so the
live-track write stops fighting the drag) → the next frame draws `scene(tape, round(playhead))`. A
`tick N / M` readout + `aria-valuetext` mirror the position. `advance` gains end-of-fight auto-pause.
**Class**: Behavior change.
**Required implementation skills**: `tdd`, `testing`, `front-end-testing`; `refactoring` assessed
(likely `N/A` — additive). `mutation-testing`: **N/A (Stryker)** — see Testing regime.
**Reduction program**: N/A. **Transition/terminal evidence**: N/A.
**Acceptance criteria** (present for approval before code):

- The player shows a scrub **slider** (`role="slider"`) with `min=0`, `max=lastTick`, `step=1`,
  positioned in the controls; its value reflects the current playhead.
- Setting the slider to a tick **seeks** the scene there and leaves the clock **paused** (the
  play/pause toggle flips to **Play**); the readout updates to that tick.
- A **`tick N / M`** readout (muted-mono) shows the current tick and the fight's final tick,
  **agreeing with the HUD tick**; the slider carries `aria-valuetext="tick N of M"`.
- During playback the slider **live-tracks** the playhead (its value follows the advancing tick).
- When the playhead reaches `lastTick`, the clock **auto-pauses** (the toggle shows **Play**),
  from which the spectator can scrub back and press **Play** to resume from the new tick.
- Restart still returns to tick 0 and resumes (unchanged).

**RED**: pure `transport.test.tsx` — (a) `advance` at `lastTick` while playing returns
`{ playhead: lastTick, playing: false }` (auto-pause; extends the existing clamp case); (b)
`seek(t, tick, lastTick)` returns `{ playhead: clamp(0..lastTick, tick), playing: false }` — exact
cases for an in-range tick, below 0, above `lastTick`, and from a playing clock. Browser
`ReplayPlayer.test.tsx` — the slider exists with the right `min`/`max`/`step`; `fireEvent.input` to a
tick flips the toggle to **Play** and updates the readout text; the slider exposes `aria-valuetext`.
**GREEN**: extend `advance` (flip `playing` false at `lastTick`); add pure `seek`; render the
`<input type=range>` bound to `round(playhead)` with `onInput={seek}`, the `tick N / M` readout, and
`aria-valuetext`; keep the live-track (ticker already re-reads the signal each frame).
**MUTATE or alternate evidence**: N/A (Stryker) — exact-assertion `transport` unit tests over the
auto-pause + `seek` boundaries + browser tests over the slider/readout wiring + manual mutator scan +
preview smoke of a drag-to-seek.
**KILL MUTANTS**: manual scan targets — the `advance` auto-pause gate (`>= lastTick` vs `>`), the
`seek` clamp bounds (0 / `lastTick`) and its `playing=false`, the readout's N and M sources, the
slider's `max=lastTick` (off-by-one vs `tape.length`).
**REFACTOR**: assess whether `seek`'s clamp helper is worth naming for Slice 3's `step` to reuse;
otherwise `N/A`.
**Done when**: all Slice-1 criteria pass; typecheck + lint + `npm test` green; manual scan
documented; commit approved.

---

### Slice 2: Speed buttons change the playback rate

**Value**: A **spectator** slows a fast exchange to 0.5× to see the technique, or skips a lull at 2×.
**Path**: `ReplayPlayer` holds a `speed` signal (default 1); the ticker advances by
`advance(transport(), ticker.deltaTime × speed(), lastTick)`; three buttons (0.5× / 1× / 2×) set it,
the active one carrying `aria-pressed="true"`.
**Class**: Behavior change.
**Required implementation skills**: `tdd`, `testing`, `front-end-testing`. `mutation-testing`:
**N/A (Stryker)**. **Reduction program**: N/A. **Transition/terminal evidence**: N/A.
**Acceptance criteria** (present for approval before code):

- The player shows three rate buttons labelled **0.5× / 1× / 2×**; **1×** is active on mount
  (`aria-pressed="true"`, the others `"false"`).
- Clicking a rate makes **that** button active and clears the others (single-select group).
- The chosen rate scales playback (the ticker advances by `deltaTime × speed`) — verified by
  preview smoke; the button group's active state is the unit of exact-assertion browser testing.
- Speed **persists across Restart** (Restart resets the clock, not the rate).

**RED**: browser `ReplayPlayer.test.tsx` — the three rate buttons exist; **1×** has
`aria-pressed="true"` and the others `"false"` on mount; clicking **2×** sets `aria-pressed="true"`
on 2× and `"false"` on 0.5×/1×; clicking back to **1×** restores it. (No new pure model — speed is a
ticker-layer multiplier; there is no cycle logic to unit-test.)
**GREEN**: a `speed` signal + a small rate-button group (`For` over `[0.5, 1, 2]`, `aria-pressed` =
`speed() === rate`, `onClick` sets the rate); multiply `ticker.deltaTime` by `speed()` in the ticker
callback.
**MUTATE or alternate evidence**: N/A (Stryker) — exact-assertion browser tests over the button
group's active-state matrix + manual mutator scan of the `deltaTime × speed` multiply and the
`aria-pressed` gate + preview smoke of a 0.5×/2× rate change.
**KILL MUTANTS**: manual scan targets — the `speed() === rate` active gate, the `onClick` setting the
correct rate, the `deltaTime × speed` multiply (dropped/×1 mutant → no rate change), the default 1×.
**REFACTOR**: assess sharing the control-row styling; only if it adds value.
**Done when**: all Slice-2 criteria pass; typecheck + lint + `npm test` green; manual scan
documented; commit approved.

---

### Slice 3: Frame-step buttons advance one tick at a time

**Value**: A **spectator** studies a bout tick-by-tick — stepping ◀ / ▶ through the decisive frames.
**Path**: two buttons (◀ step-back / ▶ step-forward) each call
`setTransport(step(transport(), ±1, lastTick))` — pausing and moving exactly one integer tick; a
button is **disabled** at its boundary (◀ when `round(playhead) <= 0`, ▶ when `>= lastTick`).
**Class**: Behavior change.
**Required implementation skills**: `tdd`, `testing`, `front-end-testing`. `mutation-testing`:
**N/A (Stryker)**. **Reduction program**: N/A. **Transition/terminal evidence**: N/A.
**Acceptance criteria** (present for approval before code):

- The player shows **◀** (step-back) and **▶** (step-forward) buttons by the play controls.
- Clicking **▶** advances the playhead by **exactly one tick** and **pauses** (the toggle shows
  Play); the readout/slider reflect the new tick. Clicking **◀** retreats one tick.
- Stepping from a fractional (mid-play) playhead snaps to `round(playhead) ± 1`.
- **◀** is **disabled** at tick 0; **▶** is **disabled** at the last tick (no over/underflow).

**RED**: pure `transport.test.tsx` — `step(t, delta, lastTick)` returns
`{ playhead: clamp(0..lastTick, round(t.playhead) + delta), playing: false }`: exact cases for
step-forward from an integer, step-back from an integer, step from a **fractional** playhead (rounds),
step-back **at 0** (stays 0), step-forward **at lastTick** (stays lastTick), and that it always
pauses. Browser `ReplayPlayer.test.tsx` — both buttons exist; clicking ▶ advances the readout by one
and flips the toggle to Play; ◀ is `disabled` at tick 0 and ▶ is `disabled` at the last tick.
**GREEN**: add pure `step` (reusing Slice 1's clamp, ideally `step = seek(t, round(playhead)+delta,
lastTick)`); render the two buttons wired to `step(±1)` with `disabled` computed from `round(playhead)`
vs `0` / `lastTick`.
**MUTATE or alternate evidence**: N/A (Stryker) — exact-assertion `step` unit tests over the
round/clamp/pause space + browser tests over advance + disabled-at-ends + manual mutator scan +
preview smoke of a frame-step.
**KILL MUTANTS**: manual scan targets — the `round(playhead) + delta` (drop round / wrong sign), the
clamp bounds, the `playing=false`, and the two `disabled` gates (`<= 0` and `>= lastTick`, boundary
off-by-one).
**REFACTOR**: `N/A` unless `step`/`seek` share enough to warrant the extracted clamp helper.
**Done when**: all Slice-3 criteria pass; typecheck + lint + `npm test` green; manual scan
documented; commit approved.

## Pre-PR Quality Gate (each slice)

1. **Mutation**: N/A (Stryker) — record the proportionate-evidence substitute (exact-assertion
   `transport` unit tests + browser control tests + documented manual mutator scan + preview smoke).
2. **Refactoring**: assess per slice; record `N/A` when nothing adds value.
3. **Typecheck + lint + full `npm test`** green (run `eslint --fix` then `prettier --write`, then
   verify both clean — the recurring reconciliation order).
4. DDD glossary: N/A (no domain-model change).

## Dark-launch guard (applies to every slice)

Add **no** primary-Nav link and keep the "Fight replays — in development" teaser a **non-link**. The
route is reachable only by direct URL / permalink; surfacing it is the parked follow-up
(`replay-viewer-decisions.md` → _Nav visibility — dark launch_).

---

_S4 is the **last** item on the replay-viewer roadmap. When it completes, archive this file to
`docs/archive/` (do not delete) — see `docs/archive/README.md` — and the shared
`plans/replay-viewer-{decisions,stories}.md` can archive alongside it (nothing live remains)._
