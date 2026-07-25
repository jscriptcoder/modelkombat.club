import { render, within } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import Fights from "./Fights";
import type { Fighter, ReplaySummary } from "../replay/replay-contract";
import type { ReplayListLoad } from "../replay/replay-loader";

// This section used to advertise replays with an `aria-disabled` button, because /watch shipped
// dark. S1 made it a real signpost; this slice layers the three most recent fights on top of that
// signpost and degrades back to it whenever there is nothing to show
// (watch-public-decisions.md D4). The static frame is therefore asserted as the LOADING, EMPTY and
// ERROR state — not as "the way the section looks".

const fighter = (overrides: Partial<Fighter> = {}): Fighter => ({
  name: "challenger",
  model: "claude",
  ...overrides,
});

const summary = (overrides: Partial<ReplaySummary> = {}): ReplaySummary => ({
  id: "abc123",
  fighters: [fighter(), fighter({ name: "king" })],
  ...overrides,
});

// `count` fights in the order /replay returns them (newest first), each with its own id and
// identities so a test can pin exactly which surfaced, and in which order.
const fights = (count: number): ReplaySummary[] =>
  Array.from({ length: count }, (_, index) =>
    summary({
      id: `id-${index}`,
      fighters: [
        fighter({ name: `challenger-${index}` }),
        fighter({ name: `king-${index}` }),
      ],
    }),
  );

const ready = (items: ReplaySummary[]) => (): Promise<ReplayListLoad> =>
  Promise.resolve({ kind: "ready", items });

// A link into ONE fight, defined by where it goes rather than by a class name — that is what
// makes a card a card here.
const fightLinks = (container: HTMLElement): HTMLAnchorElement[] =>
  [...container.querySelectorAll("a")].filter((link) =>
    link.getAttribute("href")?.startsWith("/watch/"),
  );

// The degraded states render the same frame before and after the load settles, so there is no DOM
// change to wait on. Flushing the queue is what makes their assertions mean anything: without it
// the error case would assert "no alert" before the rejection had even been handled.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const degradedStates: ReadonlyArray<[string, () => Promise<ReplayListLoad>]> = [
  ["loading", () => new Promise<ReplayListLoad>(() => {})],
  ["empty", () => Promise.resolve<ReplayListLoad>({ kind: "empty" })],
  ["error", () => Promise.reject<ReplayListLoad>(new Error("down"))],
];

describe("Fights section", () => {
  it("is a labelled region anchored at #fights", () => {
    const { getByRole } = render(() => <Fights load={ready(fights(3))} />);

    // The accessible name comes from the heading; the id is the anchor target that keeps every
    // pre-existing `/#fights` link resolving even though the nav now points at /watch.
    const region = getByRole("region", { name: /fight replays/i });

    expect(region.id).toBe("fights");
    expect(region.textContent).toMatch(/tick-for-tick/i);
  });

  it("offers no dead control — nothing aria-disabled and nothing natively disabled", () => {
    const { container } = render(() => <Fights load={ready(fights(3))} />);

    expect(container.querySelector("[aria-disabled]")).toBeNull();
    expect(container.querySelector(":disabled")).toBeNull();
  });

  it("no longer describes replays as unbuilt", () => {
    const { container } = render(() => <Fights load={ready(fights(3))} />);

    expect(container.textContent).not.toMatch(/in development/i);
    expect(container.textContent).not.toMatch(/coming soon/i);
  });

  it.each(degradedStates)(
    "falls back to exactly the static signpost in the %s state",
    async (_state, load) => {
      const { container, getByRole } = render(() => <Fights load={load} />);

      await settle();

      // The S1 frame, unchanged: one real link into the viewer and no cards.
      expect(
        getByRole("link", { name: "Watch the fights" }).getAttribute("href"),
      ).toBe("/watch");
      expect(fightLinks(container)).toEqual([]);
    },
  );

  it.each(degradedStates)(
    "never shouts on the landing page in the %s state — no alert and no retry",
    async (_state, load) => {
      const { container, queryByRole } = render(() => <Fights load={load} />);

      await settle();

      // /watch keeps its loud, retryable states; a visitor who never asked to see fights must not
      // get a red error stacked on a marketing page (D4).
      expect(queryByRole("alert")).toBeNull();
      expect(queryByRole("button")).toBeNull();
      expect(container.querySelector(".retry")).toBeNull();
    },
  );

  it("shows the three most recent fights, in the order /replay returned them", async () => {
    const { container, findAllByRole } = render(() => (
      <Fights load={ready(fights(5))} />
    ));

    await findAllByRole("img");

    // Exactly three, exactly these, exactly this order — an ordered equality so a wrong slice
    // boundary, a reversal, or a fourth card all fail.
    expect(
      fightLinks(container).map((link) => link.getAttribute("href")),
    ).toEqual(["/watch/id-0", "/watch/id-1", "/watch/id-2"]);
  });

  it.each([1, 2])(
    "shows only the %i fight(s) that exist, with no placeholder for the empty slots",
    async (count) => {
      const { container, findAllByRole } = render(() => (
        <Fights load={ready(fights(count))} />
      ));

      await findAllByRole("img");

      expect(fightLinks(container)).toHaveLength(count);
    },
  );

  it("names both fighters and badges both models on a card", async () => {
    const { container, findAllByRole } = render(() => (
      <Fights load={ready([summary()])} />
    ));

    await findAllByRole("img");

    const [card] = fightLinks(container);

    expect(card.textContent).toContain("challenger");
    expect(card.textContent).toContain("king");
    // One authoring-brand mark per fighter, each labelled — never a bare decorative glyph.
    expect(
      within(card).getAllByRole("img", { name: /authored by/i }),
    ).toHaveLength(2);
  });

  it("dates and numbers no fight", async () => {
    const { container, findAllByRole } = render(() => (
      <Fights load={ready([summary()])} />
    ));

    await findAllByRole("img");

    const [card] = fightLinks(container);

    // The identities in this fixture carry no digits, so ANY digit on the card is a date, an
    // ordinal, or a rank we deliberately do not show (D2 — identities only).
    expect(card.textContent).not.toMatch(/\d/);
  });

  it("swallows an archive failure rather than raising an unhandled rejection", async () => {
    const unhandled: PromiseRejectionEvent[] = [];
    const capture = (event: PromiseRejectionEvent) => unhandled.push(event);

    window.addEventListener("unhandledrejection", capture);

    try {
      render(() => (
        <Fights load={() => Promise.reject(new Error("archive down"))} />
      ));

      await settle();
    } finally {
      window.removeEventListener("unhandledrejection", capture);
    }

    // Degrading quietly (D4) means CONSUMING the failure, not ignoring it: an unread rejection
    // still escapes to the page and anything watching window errors.
    expect(unhandled).toEqual([]);
  });

  it("disambiguates two fights between the same two names, and only those", async () => {
    const rematch = (id: string): ReplaySummary =>
      summary({
        id,
        fighters: [fighter({ name: "rival" }), fighter({ name: "champ" })],
      });

    const { container, findAllByRole } = render(() => (
      <Fights
        load={ready([
          rematch("aaaaaa11"),
          rematch("bbbbbb22"),
          summary({ id: "cccccc33" }),
        ])}
      />
    ));

    await findAllByRole("img");

    const [first, second, third] = fightLinks(container);

    // Two cards pitting the same two names against each other are otherwise indistinguishable, so
    // each shows a short id fragment. The third pair is unique, so it shows none — the marker is
    // computed over the three cards ON SCREEN, which is the only place ambiguity can exist.
    expect(first.textContent).toContain("aaaaaa");
    expect(second.textContent).toContain("bbbbbb");
    expect(third.textContent).not.toContain("cccccc");
  });

  it("offers the whole archive beneath the cards it is showing", async () => {
    const { findByRole } = render(() => <Fights load={ready(fights(5))} />);

    // "all" is the point: three cards are a sample, and this is the way to the rest.
    const link = await findByRole("link", { name: "Watch all fights" });

    expect(link.getAttribute("href")).toBe("/watch");
    expect(link.getAttribute("target")).toBe(null);
  });
});
