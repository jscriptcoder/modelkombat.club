import { render, within } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import Arsenal from "./Arsenal";

// The expected roster is hardcoded here — deliberately NOT imported from the
// component — so a renamed, dropped, or reordered move-id/gloss in production
// fails this test. The web project can't run Stryker, so exact assertions plus
// this independent duplication are the mutation guard.
type ExpectedMove = { readonly id: string; readonly gloss: string };
type ExpectedFamily = {
  readonly name: string;
  readonly moves: readonly ExpectedMove[];
};

const EXPECTED_FAMILIES: readonly ExpectedFamily[] = [
  {
    name: "Strikes",
    moves: [
      { id: "kizami-zuki", gloss: "jab" },
      { id: "gyaku-zuki", gloss: "reverse punch" },
      { id: "uraken", gloss: "backfist" },
      { id: "shuto", gloss: "knife-hand" },
    ],
  },
  {
    name: "Kicks",
    moves: [
      { id: "mae-geri", gloss: "front kick" },
      { id: "mawashi-geri", gloss: "roundhouse kick" },
      { id: "yoko-geri", gloss: "side kick" },
      { id: "ushiro-geri", gloss: "back kick" },
    ],
  },
  {
    name: "Close-range",
    moves: [
      { id: "empi", gloss: "elbow strike" },
      { id: "hiza-geri", gloss: "knee strike" },
    ],
  },
  {
    name: "Takedowns",
    moves: [
      { id: "throw", gloss: "throw" },
      { id: "sweep", gloss: "foot sweep" },
    ],
  },
  {
    name: "Aerial",
    moves: [{ id: "tobi-geri", gloss: "jumping kick" }],
  },
];

// A move card carries its romaji id in a <code> token and its gloss in a
// dedicated .move-gloss slot; reading them separately keeps the `throw` move
// (id "throw", gloss "throw") from colliding under a bare getByText.
const idOf = (item: HTMLElement): string | null =>
  item.querySelector("code")?.textContent ?? null;

const glossOf = (item: HTMLElement): string | null =>
  item.querySelector(".move-gloss")?.textContent ?? null;

describe("Arsenal section", () => {
  it("is a labelled region anchored at #arsenal with an orienting lede", () => {
    const { getByRole } = render(() => <Arsenal />);

    const region = getByRole("region", { name: "The Arsenal" });

    // The id is the in-page anchor target the nav links to.
    expect(region.id).toBe("arsenal");
    // A paragraph-unique phrase from the lede — an empty/blank lede fails here.
    expect(region.textContent).toMatch(/thirteen real karate techniques/i);
    // The scoring scale orients the score badges; pin it so it can't be dropped.
    expect(region.textContent).toMatch(/1 yuko · 2 waza-ari · 3 ippon/i);
  });

  it("groups the techniques under the five families, in order", () => {
    const { getByRole } = render(() => <Arsenal />);

    const region = getByRole("region", { name: "The Arsenal" });

    const familyNames = within(region)
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);

    expect(familyNames).toEqual([
      "Strikes",
      "Kicks",
      "Close-range",
      "Takedowns",
      "Aerial",
    ]);
  });

  it("lists exactly the right techniques — id and gloss — in order under each family", () => {
    const { getByRole } = render(() => <Arsenal />);

    for (const family of EXPECTED_FAMILIES) {
      const familyRegion = getByRole("region", { name: family.name });

      const items = within(familyRegion).getAllByRole("listitem");

      expect(items.map(idOf)).toEqual(family.moves.map((move) => move.id));
      expect(items.map(glossOf)).toEqual(
        family.moves.map((move) => move.gloss),
      );
    }
  });
});
