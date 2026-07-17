import { render } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";

import ReplayPage from "./ReplayPage";
import type { ReplayByIdLoad, ReplayListLoad } from "./replay-loader";
import type { ReplayFrame, ReplayItem, ReplaySummary } from "./replay-contract";

// A small canvas keeps the Pixi player light in the fight-view test; the numbers don't matter here
// (the scene→screen maths is proven in scene.test), only that the player mounts.
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

const summary = (id: string): ReplaySummary => ({
  id,
  fighters: [
    { name: "challenger", model: "m" },
    { name: "king", model: "m" },
  ],
});

describe("ReplayPage — the /watch dispatcher", () => {
  it("routes /watch/{id} to the fight view, threading the parsed id to the by-id loader", async () => {
    // A path carrying a fight id dispatches to the by-id player (distinguished from the list by its
    // back-to-list link), and the id parsed from the path reaches the loader.
    const loadFight = vi
      .fn<(id: string) => Promise<ReplayByIdLoad>>()
      .mockResolvedValue({ kind: "found", item: item() });

    const { findByRole } = render(() => (
      <ReplayPage
        path="/watch/abc123"
        loadFight={loadFight}
        viewport={VIEWPORT}
      />
    ));

    expect(await findByRole("img", { name: /fight playback/i })).toBeTruthy();
    expect(
      (await findByRole("link", { name: /all fights/i })).getAttribute("href"),
    ).toBe("/watch");
    // The whole chain — path → replayIdFromPath → dispatch → ReplayFight → loader — is pinned: the
    // loader is called with the id lifted out of the path (kills an id-threading mutant).
    expect(loadFight).toHaveBeenCalledWith("abc123");
  });

  it("routes bare /watch to the browsable fight list, not the by-id player", async () => {
    const loadList = () =>
      Promise.resolve<ReplayListLoad>({
        kind: "ready",
        items: [summary("newest")],
      });

    const { findByRole, queryByRole } = render(() => (
      <ReplayPage path="/watch" loadList={loadList} />
    ));

    // The no-id branch mounts the list: a card links to that fight's permalink...
    expect((await findByRole("link")).getAttribute("href")).toBe(
      "/watch/newest",
    );
    // ...and the fight player is NOT mounted (distinguishes the list from the by-id view).
    expect(queryByRole("img", { name: /fight playback/i })).toBeNull();
  });
});
