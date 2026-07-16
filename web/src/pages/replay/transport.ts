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
// A paused clock is returned unchanged (same reference) — the tick freezes, and the reactive layer
// sees no change, so pausing quiets the per-frame updates.
export const advance = (
  t: Transport,
  delta: number,
  lastTick: number,
): Transport =>
  t.playing
    ? { playing: true, playhead: Math.min(lastTick, t.playhead + delta) }
    : t;

// The play/pause toggle: flip `playing` but keep the playhead, so resuming continues from where the
// clock paused rather than restarting.
export const togglePlaying = (t: Transport): Transport => ({
  ...t,
  playing: !t.playing,
});
