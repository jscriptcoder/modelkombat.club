// The playback clock as pure, immutable data: the fight's playhead (a fractional tick — the ticker
// advances it by the frame delta, the renderer rounds it) plus whether the clock is running. Kept
// free of Pixi and of Solid so every transition is exact-assertion testable; the Pixi mount just
// dispatches these functions from its ticker and the play/pause + restart controls.

export type Transport = {
  readonly playhead: number;
  readonly playing: boolean;
  // The end-of-fight SETTLE progress ∈ [0,1]: 0 all through the fight, then ramps once the playhead
  // pins to the last tick, driving the viewer's ease-back-to-neutral + the TIME card fade before the
  // clock finally pauses. Only `advance` ramps it (and only while playing), so a natural play-through
  // runs the outro but a scrub to the end — which pauses — leaves it 0, freezing on the raw final frame.
  readonly outro: number;
};

// A fresh clock: the first tick, auto-playing, no outro. This is also the RESTART target — restart is
// a return to the start state (tick 0, resumed), so the controls reuse it rather than a separate op.
export const startTransport = (): Transport => ({
  playhead: 0,
  playing: true,
  outro: 0,
});

// How long the end-of-fight settle runs, in playhead-tick units (the same units `advance`'s delta is
// in). ~24 ticks ≈ 0.6 s at the 0.65×/60fps base rate. Eye-tunable.
export const OUTRO_TICKS = 24;

// How many engine ticks 1× playback advances per animation frame-unit. Below 1.0 deliberately: at
// one tick per 60 fps frame a fast exchange (a strike resolves in a handful of ticks) blurs past, so
// the viewer plays a touch slower than real time. The picked rate (RATES in ReplayPlayer) scales
// this; eye-tunable, so no test pins the exact figure beyond the `playbackDelta` cases below.
export const BASE_PLAYBACK_RATE = 0.65;

// The per-frame tick advance the Pixi ticker feeds `advance`: the frame's delta (≈1 per 60 fps frame)
// scaled by the picked speed multiplier and the base rate. Pure (no ticker, no Pixi) so the playback
// pacing is exact-assertion testable here rather than buried in the mount's ticker callback.
export const playbackDelta = (frameDelta: number, speed: number): number =>
  frameDelta * speed * BASE_PLAYBACK_RATE;

// Advance the playhead by `delta` ticks while playing, clamped so it never runs past the final tick.
// WITHIN the tape the outro stays 0. Once the playhead pins to the last tick the clock keeps PLAYING
// but ramps `outro` 0→1 over OUTRO_TICKS (the end-of-fight settle), and only pauses once the outro
// completes — so the fight eases to a close rather than freezing on the raw final frame. A paused clock
// is returned unchanged (same reference), so pausing quiets the per-frame updates.
export const advance = (
  t: Transport,
  delta: number,
  lastTick: number,
): Transport => {
  if (!t.playing) return t;

  if (t.playhead < lastTick) {
    const playhead = Math.min(lastTick, t.playhead + delta);

    return { playhead, playing: true, outro: 0 };
  }

  const outro = Math.min(1, t.outro + delta / OUTRO_TICKS);

  return { playhead: lastTick, playing: outro < 1, outro };
};

// Jump the playhead to `tick`, clamped into [0, lastTick], and PAUSE there: a scrub stops playback on
// the chosen frame (so the per-frame live-track write stops fighting the drag). The prior clock is
// discarded — a seek fully determines the new position, always pauses, and clears any outro (a scrub is
// back inside the fight, not settling), so scrubbing to the very end shows the raw final frame.
export const seek = (
  _t: Transport,
  tick: number,
  lastTick: number,
): Transport => ({
  playhead: Math.min(lastTick, Math.max(0, tick)),
  playing: false,
  outro: 0,
});

// Step the playhead by whole `delta` ticks from the ROUNDED current position — the frame-step
// controls' single move. Composed from `seek`: snap `round(playhead) + delta` into range and pause
// there, so a mid-play fractional playhead lands on a clean neighbouring tick (never a fraction),
// and stepping past either end holds at the boundary.
export const step = (
  t: Transport,
  delta: number,
  lastTick: number,
): Transport => seek(t, Math.round(t.playhead) + delta, lastTick);

// The play/pause toggle: flip `playing` but keep the playhead, so resuming continues from where the
// clock paused rather than restarting.
export const togglePlaying = (t: Transport): Transport => ({
  ...t,
  playing: !t.playing,
});
