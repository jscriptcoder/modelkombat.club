// The playback clock as pure, immutable data: the fight's playhead (a fractional tick — the ticker
// advances it by the frame delta, the renderer rounds it) plus whether the clock is running. Kept
// free of Pixi and of Solid so every transition is exact-assertion testable; the Pixi mount just
// dispatches these functions from its ticker and the play/pause + restart controls.

export type Transport = {
  readonly playhead: number;
  readonly playing: boolean;
};

// A fresh clock: the first tick, auto-playing. This is also the RESTART target — restart is a return
// to the start state (tick 0, resumed), so the controls reuse it rather than a separate operation.
export const startTransport = (): Transport => ({ playhead: 0, playing: true });

// Advance the playhead by `delta` ticks while playing, clamped so it never runs past the final tick.
// Reaching the last tick auto-pauses the clock (the toggle returns to Play) rather than freezing on
// Pause over the final frame. A paused clock is returned unchanged (same reference) — the tick
// freezes, and the reactive layer sees no change, so pausing quiets the per-frame updates.
export const advance = (
  t: Transport,
  delta: number,
  lastTick: number,
): Transport => {
  if (!t.playing) return t;

  const playhead = Math.min(lastTick, t.playhead + delta);

  return { playhead, playing: playhead < lastTick };
};

// Jump the playhead to `tick`, clamped into [0, lastTick], and PAUSE there: a scrub stops playback on
// the chosen frame (so the per-frame live-track write stops fighting the drag). The prior clock is
// discarded — a seek fully determines the new position and always pauses.
export const seek = (
  _t: Transport,
  tick: number,
  lastTick: number,
): Transport => ({
  playhead: Math.min(lastTick, Math.max(0, tick)),
  playing: false,
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
