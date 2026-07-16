import { fireEvent, render } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";

import ReplayPage from "./ReplayPage";
import type { ReplayLoad } from "./replay-loader";
import type { ReplayFrame, ReplayItem } from "./replay-contract";

// A small canvas keeps the Pixi player light in the ready-state tests; the numbers don't matter
// here (the scene→screen maths is proven in scene.test), only that the player mounts.
const VIEWPORT = { width: 300, height: 150 };

const frame = (overrides: Partial<ReplayFrame> = {}): ReplayFrame => ({
  x: 150_000,
  y: 0,
  facing: 1,
  posture: 0,
  attacking: false,
  attackBand: 0,
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

describe("ReplayPage", () => {
  it("shows an accessible loading state while the fight is being fetched", () => {
    // A loader that never settles holds the page in its loading state.
    const load = () => new Promise<ReplayLoad>(() => {});

    const { getByRole } = render(() => (
      <ReplayPage load={load} viewport={VIEWPORT} />
    ));

    expect(getByRole("status")).toBeTruthy();
  });

  it("mounts the labelled fight player once a fight loads", async () => {
    const load = () =>
      Promise.resolve<ReplayLoad>({ kind: "ready", item: item() });

    const { findByRole } = render(() => (
      <ReplayPage load={load} viewport={VIEWPORT} />
    ));

    expect(await findByRole("img", { name: /fight playback/i })).toBeTruthy();
  });

  it("shows an empty state linking to /ring when there are no fights yet", async () => {
    const load = () => Promise.resolve<ReplayLoad>({ kind: "empty" });

    const { findByText, getByRole } = render(() => (
      <ReplayPage load={load} viewport={VIEWPORT} />
    ));

    expect(await findByText(/no fights to watch yet/i)).toBeTruthy();
    expect(
      getByRole("link", { name: /send a bot into the ring/i }).getAttribute(
        "href",
      ),
    ).toBe("/ring");
  });

  it("shows a retryable error state whose Retry re-runs the load and then plays", async () => {
    const load = vi
      .fn<() => Promise<ReplayLoad>>()
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce({ kind: "ready", item: item() });

    const { findByRole, findByText } = render(() => (
      <ReplayPage load={load} viewport={VIEWPORT} />
    ));

    // First load fails → a distinct error with Retry (never the empty CTA).
    expect(await findByText(/couldn't load the fight/i)).toBeTruthy();

    fireEvent.click(await findByRole("button", { name: /retry/i }));

    // Retry re-runs the load and the fight then mounts.
    expect(await findByRole("img", { name: /fight playback/i })).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("never shows the empty CTA on a load failure", async () => {
    const load = () => Promise.reject<ReplayLoad>(new Error("down"));

    const { findByText, queryByText } = render(() => (
      <ReplayPage load={load} viewport={VIEWPORT} />
    ));

    expect(await findByText(/couldn't load the fight/i)).toBeTruthy();
    expect(queryByText(/no fights to watch yet/i)).toBeNull();
  });
});
