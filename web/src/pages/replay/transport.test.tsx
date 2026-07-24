import { describe, expect, it } from "vitest";

import {
  advance,
  playbackDelta,
  seek,
  startTransport,
  step,
  togglePlaying,
  type Transport,
} from "./transport";
import { scene, type Viewport } from "./scene";
import type { ReplayFrame, ReplayTape, ReplayTick } from "./replay-contract";

// The transport is the pure playback clock — the fight's playhead + play/paused state — kept out of
// the Pixi mount so its transitions are exact-assertion testable (web/ is not Stryker-reachable, so
// the pure logic lives here where boundary assertions can pin it). The tick it lands on is what the
// HUD reads, so one case composes it with `scene` to prove that link (pause freezes the HUD tick).

const VIEWPORT: Viewport = { width: 1200, height: 600 };

const frame = (overrides: Partial<ReplayFrame> = {}): ReplayFrame => ({
  x: 150_000,
  y: 0,
  facing: 1,
  posture: 0,
  attacking: false,
  attackBand: 0,
  guardBand: 0,
  throwing: false,
  knockdown: false,
  points: 0,
  stamina: 100,
  ...overrides,
});

// The tick NUMBER deliberately differs from the array index so a wrong playhead shows up in the HUD.
const tickOf = (tick: number): ReplayTick => ({ tick, a: frame(), b: frame() });

describe("transport — the pure playback clock", () => {
  it("starts at the first tick, auto-playing (also the restart target)", () => {
    expect(startTransport()).toEqual({ playhead: 0, playing: true });
  });

  it("advances the playhead by the frame delta and stays playing", () => {
    expect(advance(startTransport(), 3, 100)).toEqual({
      playhead: 3,
      playing: true,
    });
  });

  it("auto-pauses at the last tick — the fight stops cleanly at the end, never running off", () => {
    const nearEnd: Transport = { playhead: 98, playing: true };

    // 98 + 5 overshoots 100: the playhead clamps to the last tick AND the clock stops there, so the
    // toggle returns to Play instead of freezing on Pause over the final frame.
    expect(advance(nearEnd, 5, 100)).toEqual({ playhead: 100, playing: false });
  });

  it("seeks to a tick and pauses there — a scrub stops playback on the chosen frame", () => {
    expect(seek({ playhead: 10, playing: true }, 40, 100)).toEqual({
      playhead: 40,
      playing: false,
    });
  });

  it("clamps a seek below the start back to tick 0", () => {
    expect(seek({ playhead: 10, playing: true }, -5, 100)).toEqual({
      playhead: 0,
      playing: false,
    });
  });

  it("clamps a seek past the end back to the last tick", () => {
    expect(seek({ playhead: 10, playing: true }, 150, 100)).toEqual({
      playhead: 100,
      playing: false,
    });
  });

  it("steps forward exactly one tick from an integer playhead, pausing", () => {
    expect(step({ playhead: 5, playing: true }, 1, 100)).toEqual({
      playhead: 6,
      playing: false,
    });
  });

  it("steps back exactly one tick from an integer playhead, pausing", () => {
    expect(step({ playhead: 5, playing: true }, -1, 100)).toEqual({
      playhead: 4,
      playing: false,
    });
  });

  it("snaps a fractional (mid-play) playhead to round(playhead) ± 1", () => {
    // 5.6 rounds to 6, so a forward step lands on 7 — not 6.6 (drop-round) or 6 (floor).
    expect(step({ playhead: 5.6, playing: true }, 1, 100)).toEqual({
      playhead: 7,
      playing: false,
    });
  });

  it("stops at tick 0 when stepping back from the first tick", () => {
    expect(step({ playhead: 0, playing: false }, -1, 100)).toEqual({
      playhead: 0,
      playing: false,
    });
  });

  it("stops at the last tick when stepping forward from the end", () => {
    expect(step({ playhead: 100, playing: false }, 1, 100)).toEqual({
      playhead: 100,
      playing: false,
    });
  });

  it("freezes the tick while paused — a paused clock does not advance", () => {
    const paused = togglePlaying({ playhead: 5, playing: true });

    expect(advance(paused, 3, 100)).toEqual({ playhead: 5, playing: false });
  });

  it("resumes from the current tick — play/pause keeps the playhead, never resets to 0", () => {
    const paused = togglePlaying({ playhead: 5, playing: true }); // → { 5, false }

    expect(advance(paused, 3, 100).playhead).toBe(5); // frozen while paused

    const resumed = togglePlaying(paused); // → { 5, true }

    // continues from 5 (not 0), and stays playing.
    expect(advance(resumed, 3, 100)).toEqual({ playhead: 8, playing: true });
  });

  // The per-frame tick advance the Pixi ticker feeds `advance`. The viewer plays SLOWER than one
  // engine tick per animation frame (1× is 0.65 ticks/frame, not 1.0), so a fast exchange is legible;
  // the picked rate (0.5 / 1 / 2) scales that base, and the frame delta scales it linearly. Concrete
  // expected values (not `frameDelta * speed * BASE`) so a flipped operator or a base of 1 is caught.
  it("advances 0.65 engine ticks per frame-unit at 1× — slower than real time so exchanges read", () => {
    expect(playbackDelta(1, 1)).toBeCloseTo(0.65);
  });

  it("scales the base rate by the picked speed — half at 0.5×, double at 2×", () => {
    expect(playbackDelta(1, 0.5)).toBeCloseTo(0.325);
    expect(playbackDelta(1, 2)).toBeCloseTo(1.3);
  });

  it("scales linearly with the frame delta — a two-frame delta advances twice as far", () => {
    expect(playbackDelta(2, 1)).toBeCloseTo(1.3);
  });

  it("feeds a HUD tick that freezes on pause and stays put across frames", () => {
    const tape: ReplayTape = [tickOf(0), tickOf(11), tickOf(22), tickOf(33)];
    const lastTick = tape.length - 1;

    // Play up to index 2 (tape tick 22), then pause.
    const paused = togglePlaying(advance(startTransport(), 2, lastTick));

    const before = scene(tape, Math.round(paused.playhead), VIEWPORT).hud.tick;

    // Two frames of a paused clock must not move the HUD tick.
    const later = advance(advance(paused, 1, lastTick), 1, lastTick);
    const after = scene(tape, Math.round(later.playhead), VIEWPORT).hud.tick;

    expect(before).toBe(22);
    expect(after).toBe(22);
  });
});
