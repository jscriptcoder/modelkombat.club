import { fireEvent, render } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";

import ReplayFight from "./ReplayFight";
import type { ReplayByIdLoad } from "./replay-loader";
import type { Matchup, ReplayFrame, ReplayItem } from "./replay-contract";

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

const item = (overrides: Partial<ReplayItem> = {}): ReplayItem => ({
  tape: [
    { tick: 0, a: frame({ x: 150_000 }), b: frame({ x: 450_000 }) },
    { tick: 1, a: frame({ x: 160_000 }), b: frame({ x: 440_000 }) },
  ],
  fighters: [
    { name: "challenger", model: "m" },
    { name: "king", model: "m" },
  ],
  ...overrides,
});

// One sibling matchup — the challenger vs a named defender, addressed by a given bout id.
const matchup = (defenderName: string, id: string, model = "m"): Matchup => ({
  id,
  fighters: [
    { name: "challenger", model: "m" },
    { name: defenderName, model },
  ],
});

// The three-bout climb, in board order (King first) — the fixture the switcher tests drive. Each
// defender has a DISTINCT model so a tab's mark proves it renders the defender's brand (not the
// shared challenger's): claude · openai · gemini.
const THREE_MATCHUPS: Matchup[] = [
  matchup("king", "id-king", "claude"),
  matchup("second", "id-second", "gpt-4o"),
  matchup("third", "id-third", "gemini-pro"),
];

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

describe("ReplayFight — the matchup switcher (S3.2)", () => {
  it("renders one permalink per bout, in board order, each labelled by its defender", async () => {
    const load = () =>
      Promise.resolve<ReplayByIdLoad>({
        kind: "found",
        item: item({ matchups: THREE_MATCHUPS }),
      });

    const { findByRole, getByRole } = render(() => (
      <ReplayFight id="id-king" load={load} viewport={VIEWPORT} />
    ));

    // Gate on the found state (the player mounts), then read the switcher.
    await findByRole("img", { name: /fight playback/i });

    const nav = getByRole("navigation", { name: /matchups/i });
    const links = [...nav.querySelectorAll("a")];

    // One link per bout, in board order (King first), each a per-bout permalink.
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/watch/id-king",
      "/watch/id-second",
      "/watch/id-third",
    ]);
    // Labelled by the defender (fighters[1]) — the challenger is constant, the defender distinguishes.
    expect(links.map((link) => link.textContent)).toEqual([
      expect.stringContaining("king"),
      expect.stringContaining("second"),
      expect.stringContaining("third"),
    ]);
    // Each tab's model mark is the DEFENDER's brand (not the shared challenger's).
    expect(
      links.map((link) =>
        link.querySelector(".brand-mark")?.getAttribute("data-brand"),
      ),
    ).toEqual(["claude", "openai", "gemini"]);
  });

  it("renders the switcher for a two-bout submission (boundary: more than one)", async () => {
    // A 2-champion arena still gets a switcher — the "more than one" boundary is length 2, not 3.
    const load = () =>
      Promise.resolve<ReplayByIdLoad>({
        kind: "found",
        item: item({
          matchups: [
            matchup("king", "id-king"),
            matchup("second", "id-second"),
          ],
        }),
      });

    const { findByRole, getByRole } = render(() => (
      <ReplayFight id="id-king" load={load} viewport={VIEWPORT} />
    ));

    await findByRole("img", { name: /fight playback/i });

    const nav = getByRole("navigation", { name: /matchups/i });

    expect([...nav.querySelectorAll("a")]).toHaveLength(2);
  });

  it("marks only the current bout with aria-current, leaving the siblings plain links", async () => {
    const load = () =>
      Promise.resolve<ReplayByIdLoad>({
        kind: "found",
        item: item({ matchups: THREE_MATCHUPS }),
      });

    // Viewing the #2 bout — only its tab is the current page.
    const { findByRole, getByRole } = render(() => (
      <ReplayFight id="id-second" load={load} viewport={VIEWPORT} />
    ));

    await findByRole("img", { name: /fight playback/i });

    const nav = getByRole("navigation", { name: /matchups/i });
    const links = [...nav.querySelectorAll("a")];

    expect(links.map((link) => link.getAttribute("aria-current"))).toEqual([
      null,
      "page",
      null,
    ]);
  });

  it("renders no switcher when the submission has a single matchup", async () => {
    const load = () =>
      Promise.resolve<ReplayByIdLoad>({
        kind: "found",
        item: item({ matchups: [matchup("king", "id-king")] }),
      });

    const { findByRole, queryByRole } = render(() => (
      <ReplayFight id="id-king" load={load} viewport={VIEWPORT} />
    ));

    // The player still mounts, but there is no matchup nav to switch with.
    expect(await findByRole("img", { name: /fight playback/i })).toBeTruthy();
    expect(queryByRole("navigation", { name: /matchups/i })).toBeNull();
  });
});
