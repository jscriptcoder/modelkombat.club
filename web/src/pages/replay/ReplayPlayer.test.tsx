import { fireEvent, render } from "@solidjs/testing-library";
import { userEvent } from "vitest/browser";
import { describe, expect, it } from "vitest";

import ReplayPlayer from "./ReplayPlayer";
import type { ReplayFrame, ReplayItem } from "./replay-contract";

// The player mounts a real Pixi canvas (its Scene→display mapping is proven in figures.test, its
// clock in transport.test). Here we test the DOM CONTROLS the spectator drives: a play/pause toggle
// and restart. The tick freeze/zero behaviour itself is pinned in transport.test; at this level we
// prove the buttons exist, are labelled + keyboard-operable, and are wired to the clock's play state
// — observable via the toggle's own label (Pause while running, Play while paused).

const VIEWPORT = { width: 300, height: 150 };

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

// A fight tape of `ticks` frames (engine tick == index here, so the readout/HUD tick equals the
// slider position). The default is long enough that the clock is still PLAYING when a test interacts
// with it — auto-pause only fires at the very end — so the play/pause assertions stay deterministic.
// The auto-pause test opts into a 2-tick fight that reaches its end within a frame or two.
const item = (ticks = 600): ReplayItem => ({
  tape: Array.from({ length: ticks }, (_, i) => ({
    tick: i,
    a: frame({ x: 150_000 }),
    b: frame({ x: 450_000 }),
  })),
  fighters: [
    { name: "challenger", model: "m" },
    { name: "king", model: "m" },
  ],
});

describe("ReplayPlayer — playback controls", () => {
  it("renders labelled play/pause and restart controls", async () => {
    const { findByRole } = render(() => (
      <ReplayPlayer item={item()} viewport={VIEWPORT} />
    ));

    // Auto-plays on mount, so the toggle offers to Pause.
    expect(await findByRole("button", { name: /^pause$/i })).toBeTruthy();
    expect(await findByRole("button", { name: /^restart$/i })).toBeTruthy();
  });

  it("toggles the play/pause control when clicked (Pause → Play)", async () => {
    const { findByRole } = render(() => (
      <ReplayPlayer item={item()} viewport={VIEWPORT} />
    ));

    fireEvent.click(await findByRole("button", { name: /^pause$/i }));

    // Paused: the toggle now offers to Play.
    expect(await findByRole("button", { name: /^play$/i })).toBeTruthy();
  });

  it("resumes autoplay on restart — a paused toggle returns to Pause", async () => {
    const { findByRole } = render(() => (
      <ReplayPlayer item={item()} viewport={VIEWPORT} />
    ));

    fireEvent.click(await findByRole("button", { name: /^pause$/i }));
    await findByRole("button", { name: /^play$/i }); // confirm paused

    fireEvent.click(await findByRole("button", { name: /^restart$/i }));

    // Restart resumes → the toggle offers to Pause again.
    expect(await findByRole("button", { name: /^pause$/i })).toBeTruthy();
  });

  it("is keyboard-operable — Enter on the focused toggle pauses playback", async () => {
    const { findByRole } = render(() => (
      <ReplayPlayer item={item()} viewport={VIEWPORT} />
    ));

    const toggle = await findByRole("button", { name: /^pause$/i });

    toggle.focus();
    await userEvent.keyboard("{Enter}");

    expect(await findByRole("button", { name: /^play$/i })).toBeTruthy();
  });
});

describe("ReplayPlayer — scrub transport", () => {
  it("renders a scrub slider spanning the fight's ticks", async () => {
    const { findByRole } = render(() => (
      <ReplayPlayer item={item()} viewport={VIEWPORT} />
    ));

    const slider = await findByRole("slider");

    // The slider indexes the tape: 0 .. lastTick (ticks - 1), one step per tick.
    expect(slider.getAttribute("min")).toBe("0");
    expect(slider.getAttribute("max")).toBe("599");
    expect(slider.getAttribute("step")).toBe("1");
  });

  it("seeking the slider pauses playback and moves the readout to that tick", async () => {
    const { findByRole, findByText } = render(() => (
      <ReplayPlayer item={item()} viewport={VIEWPORT} />
    ));

    const slider = await findByRole("slider");

    fireEvent.input(slider, { target: { value: "5" } });

    // Seeking stops the clock on the chosen tick: the toggle returns to Play...
    expect(await findByRole("button", { name: /^play$/i })).toBeTruthy();
    // ...the "tick N / M" readout (the same number the HUD prints) lands on tick 5 of 599...
    expect(await findByText(/tick\s*5\s*\/\s*599/i)).toBeTruthy();
    // ...and the slider announces the same position to assistive tech.
    expect(slider.getAttribute("aria-valuetext")).toBe("tick 5 of 599");
  });

  it("auto-pauses at the end of a short fight — the toggle returns to Play", async () => {
    const { findByRole } = render(() => (
      <ReplayPlayer item={item(2)} viewport={VIEWPORT} />
    ));

    // A 2-tick fight reaches its last tick within a frame or two, then the clock auto-pauses.
    expect(await findByRole("button", { name: /^play$/i })).toBeTruthy();
  });
});

describe("ReplayPlayer — speed controls", () => {
  // Speed is a ticker-layer multiplier (deltaTime × speed), not a transport-model change, so the
  // rate change itself is proven by preview smoke; here we pin the single-select button group's
  // active state — the observable, exact-assertable contract — via each button's aria-pressed.

  it("renders 0.5× / 1× / 2× rate buttons with 1× active on mount", async () => {
    const { findByRole } = render(() => (
      <ReplayPlayer item={item()} viewport={VIEWPORT} />
    ));

    const half = await findByRole("button", { name: /^0\.5×$/ });
    const one = await findByRole("button", { name: /^1×$/ });
    const two = await findByRole("button", { name: /^2×$/ });

    // Default playback rate is 1× — it is the only pressed button.
    expect(half.getAttribute("aria-pressed")).toBe("false");
    expect(one.getAttribute("aria-pressed")).toBe("true");
    expect(two.getAttribute("aria-pressed")).toBe("false");
  });

  it("selecting a rate activates it and clears the others (single-select group)", async () => {
    const { findByRole } = render(() => (
      <ReplayPlayer item={item()} viewport={VIEWPORT} />
    ));

    fireEvent.click(await findByRole("button", { name: /^2×$/ }));

    // 2× becomes the sole active rate.
    expect(
      (await findByRole("button", { name: /^0\.5×$/ })).getAttribute(
        "aria-pressed",
      ),
    ).toBe("false");
    expect(
      (await findByRole("button", { name: /^1×$/ })).getAttribute(
        "aria-pressed",
      ),
    ).toBe("false");
    expect(
      (await findByRole("button", { name: /^2×$/ })).getAttribute(
        "aria-pressed",
      ),
    ).toBe("true");

    fireEvent.click(await findByRole("button", { name: /^1×$/ }));

    // Selecting 1× restores the default as the only active rate.
    expect(
      (await findByRole("button", { name: /^0\.5×$/ })).getAttribute(
        "aria-pressed",
      ),
    ).toBe("false");
    expect(
      (await findByRole("button", { name: /^1×$/ })).getAttribute(
        "aria-pressed",
      ),
    ).toBe("true");
    expect(
      (await findByRole("button", { name: /^2×$/ })).getAttribute(
        "aria-pressed",
      ),
    ).toBe("false");
  });

  it("keeps the selected rate across Restart — restart resets the clock, not the speed", async () => {
    const { findByRole } = render(() => (
      <ReplayPlayer item={item()} viewport={VIEWPORT} />
    ));

    fireEvent.click(await findByRole("button", { name: /^2×$/ }));
    fireEvent.click(await findByRole("button", { name: /^restart$/i }));

    // Restart resumed the clock (toggle offers Pause) but left the rate at 2×.
    expect(
      (await findByRole("button", { name: /^2×$/ })).getAttribute(
        "aria-pressed",
      ),
    ).toBe("true");
    expect(await findByRole("button", { name: /^pause$/i })).toBeTruthy();
  });
});
