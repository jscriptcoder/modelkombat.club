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

const item = (): ReplayItem => ({
  tape: [
    { tick: 0, a: frame({ x: 150_000 }), b: frame({ x: 450_000 }) },
    { tick: 1, a: frame({ x: 160_000 }), b: frame({ x: 440_000 }) },
  ],
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
