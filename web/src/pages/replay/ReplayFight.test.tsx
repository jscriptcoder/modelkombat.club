import { fireEvent, render } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";

import ReplayFight from "./ReplayFight";
import type { ReplayByIdLoad } from "./replay-loader";
import type { ReplayFrame, ReplayItem } from "./replay-contract";

// The /watch/{id} permalink player. It resolves ONE fight by id (the injected `load`, mirroring how
// ReplayPage injects its loader) and drives four states: loading, the mounted player (with a
// back-to-list link the bare-/watch view lacks), a no-retry "no longer available" state for a
// 404'd/evicted id, and a retryable transient error. A small canvas keeps Pixi light in the
// ready-state tests — the scene→screen maths is proven in scene.test; here we only prove the wiring.
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

describe("ReplayFight — the /watch/{id} permalink player", () => {
  it("shows an accessible loading state while the fight resolves", () => {
    // A loader that never settles holds the view in its loading state.
    const load = () => new Promise<ReplayByIdLoad>(() => {});

    const { getByRole } = render(() => (
      <ReplayFight id="abc" load={load} viewport={VIEWPORT} />
    ));

    expect(getByRole("status")).toBeTruthy();
  });

  it("mounts the player and a back-to-list link once the fight loads", async () => {
    const load = () =>
      Promise.resolve<ReplayByIdLoad>({ kind: "found", item: item() });

    const { findByRole } = render(() => (
      <ReplayFight id="abc" load={load} viewport={VIEWPORT} />
    ));

    expect(await findByRole("img", { name: /fight playback/i })).toBeTruthy();
    expect(
      (await findByRole("link", { name: /all fights/i })).getAttribute("href"),
    ).toBe("/watch");
  });

  it("shows a no-retry 'no longer available' state with a back link when the id 404s", async () => {
    const load = () => Promise.resolve<ReplayByIdLoad>({ kind: "not-found" });

    const { findByText, getByRole, queryByRole } = render(() => (
      <ReplayFight id="gone" load={load} viewport={VIEWPORT} />
    ));

    expect(await findByText(/no longer available/i)).toBeTruthy();
    expect(
      getByRole("link", { name: /all fights/i }).getAttribute("href"),
    ).toBe("/watch");
    // Not-found is terminal — no Retry (retry is only for a transient failure).
    expect(queryByRole("button", { name: /retry/i })).toBeNull();
  });

  it("shows a retryable error whose Retry re-runs the load and then plays", async () => {
    const load = vi
      .fn<(id: string) => Promise<ReplayByIdLoad>>()
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce({ kind: "found", item: item() });

    const { findByRole, findByText } = render(() => (
      <ReplayFight id="abc" load={load} viewport={VIEWPORT} />
    ));

    expect(await findByText(/couldn't load the fight/i)).toBeTruthy();

    fireEvent.click(await findByRole("button", { name: /retry/i }));

    expect(await findByRole("img", { name: /fight playback/i })).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("does not show the 'no longer available' copy on a transient error", async () => {
    // A thrown load is a transient failure (retry), NOT a not-found — the two states stay distinct.
    const load = () => Promise.reject<ReplayByIdLoad>(new Error("down"));

    const { findByText, queryByText } = render(() => (
      <ReplayFight id="abc" load={load} viewport={VIEWPORT} />
    ));

    expect(await findByText(/couldn't load the fight/i)).toBeTruthy();
    expect(queryByText(/no longer available/i)).toBeNull();
  });
});
