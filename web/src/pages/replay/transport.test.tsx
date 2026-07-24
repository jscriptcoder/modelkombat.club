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
  it("starts at the first tick, auto-playing, no outro (also the restart target)", () => {
    expect(startTransport()).toEqual({ playhead: 0, playing: true, outro: 0 });
  });

  it("advances the playhead by the frame delta and stays playing, outro still 0", () => {
    expect(advance(startTransport(), 3, 100)).toEqual({
      playhead: 3,
      playing: true,
      outro: 0,
    });
  });

  it("keeps playing when the playhead reaches the last tick — the settle outro runs before pausing", () => {
    const nearEnd: Transport = { playhead: 98, playing: true, outro: 0 };

    // 98 + 5 clamps to 100 (the last tick), but the clock keeps PLAYING to run the end-of-fight settle;
    // the outro is still 0 this first frame at the end (it ramps on the frames that follow).
    expect(advance(nearEnd, 5, 100)).toEqual({
      playhead: 100,
      playing: true,
      outro: 0,
    });
  });

  it("ramps the outro once the playhead is pinned at the last tick, still playing", () => {
    // OUTRO_TICKS = 24, so a delta of 12 at the end is half the settle. The playhead holds at the last
    // tick; only the outro moves.
    const atEnd: Transport = { playhead: 100, playing: true, outro: 0 };

    expect(advance(atEnd, 12, 100)).toEqual({
      playhead: 100,
      playing: true,
      outro: 0.5,
    });
  });

  it("pauses once the settle outro completes (outro clamps to 1)", () => {
    const settling: Transport = { playhead: 100, playing: true, outro: 0.9 };

    // 0.9 + 12/24 = 1.4 clamps to 1; the settle is done, so the clock finally pauses.
    expect(advance(settling, 12, 100)).toEqual({
      playhead: 100,
      playing: false,
      outro: 1,
    });
  });

  it("seeks to a tick and pauses there, clearing the outro — a scrub is back inside the fight", () => {
    expect(seek({ playhead: 100, playing: true, outro: 0.5 }, 40, 100)).toEqual(
      {
        playhead: 40,
        playing: false,
        outro: 0,
      },
    );
  });

  it("clamps a seek below the start back to tick 0", () => {
    expect(seek({ playhead: 10, playing: true, outro: 0 }, -5, 100)).toEqual({
      playhead: 0,
      playing: false,
      outro: 0,
    });
  });

  it("clamps a seek past the end back to the last tick", () => {
    expect(seek({ playhead: 10, playing: true, outro: 0 }, 150, 100)).toEqual({
      playhead: 100,
      playing: false,
      outro: 0,
    });
  });

  it("steps forward exactly one tick from an integer playhead, pausing", () => {
    expect(step({ playhead: 5, playing: true, outro: 0 }, 1, 100)).toEqual({
      playhead: 6,
      playing: false,
      outro: 0,
    });
  });

  it("steps back exactly one tick from an integer playhead, pausing", () => {
    expect(step({ playhead: 5, playing: true, outro: 0 }, -1, 100)).toEqual({
      playhead: 4,
      playing: false,
      outro: 0,
    });
  });

  it("snaps a fractional (mid-play) playhead to round(playhead) ± 1", () => {
    // 5.6 rounds to 6, so a forward step lands on 7 — not 6.6 (drop-round) or 6 (floor).
    expect(step({ playhead: 5.6, playing: true, outro: 0 }, 1, 100)).toEqual({
      playhead: 7,
      playing: false,
      outro: 0,
    });
  });

  it("stops at tick 0 when stepping back from the first tick", () => {
    expect(step({ playhead: 0, playing: false, outro: 0 }, -1, 100)).toEqual({
      playhead: 0,
      playing: false,
      outro: 0,
    });
  });

  it("stops at the last tick when stepping forward from the end", () => {
    expect(step({ playhead: 100, playing: false, outro: 0 }, 1, 100)).toEqual({
      playhead: 100,
      playing: false,
      outro: 0,
    });
  });

  it("freezes the tick while paused — a paused clock does not advance", () => {
    const paused = togglePlaying({ playhead: 5, playing: true, outro: 0 });

    expect(advance(paused, 3, 100)).toEqual({
      playhead: 5,
      playing: false,
      outro: 0,
    });
  });

  it("resumes from the current tick — play/pause keeps the playhead, never resets to 0", () => {
    const paused = togglePlaying({ playhead: 5, playing: true, outro: 0 });

    expect(advance(paused, 3, 100).playhead).toBe(5); // frozen while paused

    const resumed = togglePlaying(paused); // → { 5, true }

    // continues from 5 (not 0), and stays playing.
    expect(advance(resumed, 3, 100)).toEqual({
      playhead: 8,
      playing: true,
      outro: 0,
    });
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
