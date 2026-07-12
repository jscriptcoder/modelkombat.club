import { render, within } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import Arsenal from "./Arsenal";

// The expected roster is hardcoded here — deliberately NOT imported from the
// component — so a renamed, dropped, or reordered move-id/gloss in production
// fails this test. The web project can't run Stryker, so exact assertions plus
// this independent duplication are the mutation guard.
type ExpectedBadge = { readonly text: string; readonly label: string };
type ExpectedMove = {
  readonly id: string;
  readonly gloss: string;
  readonly badge: ExpectedBadge;
  readonly descriptor: string;
};
type ExpectedFamily = {
  readonly name: string;
  readonly moves: readonly ExpectedMove[];
};

// The five score encodings, defined independently of the component: numeric
// glyph (what the eye reads) + accessible label (what a screen reader announces,
// so "2·3" isn't voiced as "two middot three").
const B1: ExpectedBadge = { text: "1", label: "scores 1 point" };
const B2: ExpectedBadge = { text: "2", label: "scores 2 points" };
const B3: ExpectedBadge = { text: "3", label: "scores 3 points" };

const B23: ExpectedBadge = {
  text: "2·3",
  label: "scores 2 points, 3 to the head",
};

const B03: ExpectedBadge = {
  text: "0→3",
  label: "scores no points on the hit, but knocks down for a 3-point finish",
};

const EXPECTED_FAMILIES: readonly ExpectedFamily[] = [
  {
    name: "Strikes",
    moves: [
      {
        id: "kizami-zuki",
        gloss: "jab",
        badge: B1,
        descriptor:
          "Fast lead-hand poke — the tempo-setter that opens the cancel chain.",
      },
      {
        id: "gyaku-zuki",
        gloss: "reverse punch",
        badge: B1,
        descriptor:
          "The power hand and cancel hub — every combo routes through it.",
      },
      {
        id: "uraken",
        gloss: "backfist",
        badge: B1,
        descriptor:
          "Cheapest, shortest hand — a gas-proof jodan snap and combo starter.",
      },
      {
        id: "shuto",
        gloss: "knife-hand",
        badge: B1,
        descriptor:
          "The longest-reaching hand, out-ranging even the reverse punch.",
      },
    ],
  },
  {
    name: "Kicks",
    moves: [
      {
        id: "mae-geri",
        gloss: "front kick",
        badge: B2,
        descriptor:
          "The straight-line body kick — a reliable waza-ari from mid range.",
      },
      {
        id: "mawashi-geri",
        gloss: "roundhouse kick",
        badge: B23,
        descriptor:
          "Arcs to the body for two, or over the guard to the head for the ippon.",
      },
      {
        id: "yoko-geri",
        gloss: "side kick",
        badge: B2,
        descriptor:
          "A beyond-neutral thrust that out-reaches even the roundhouse.",
      },
      {
        id: "ushiro-geri",
        gloss: "back kick",
        badge: B23,
        descriptor:
          "The longest, most committed strike — a turn-away thrust you'll see coming.",
      },
    ],
  },
  {
    name: "Close-range",
    moves: [
      {
        id: "empi",
        gloss: "elbow strike",
        badge: B2,
        descriptor:
          "Shortest reach in the game — a point-blank two-point payoff.",
      },
      {
        id: "hiza-geri",
        gloss: "knee strike",
        badge: B03,
        descriptor:
          "The only standing mid-band knockdown — it sets up a three-point finish.",
      },
    ],
  },
  {
    name: "Takedowns",
    moves: [
      {
        id: "throw",
        gloss: "throw",
        badge: B3,
        descriptor:
          "Clean takedown for the instant ippon — the anti-turtle answer.",
      },
      {
        id: "sweep",
        gloss: "foot sweep",
        badge: B03,
        descriptor:
          "Chops the base out; scores nothing, but the okizeme finish pays three.",
      },
    ],
  },
  {
    name: "Aerial",
    moves: [
      {
        id: "tobi-geri",
        gloss: "jumping kick",
        badge: B23,
        descriptor:
          "Leap in from range for a head-height ippon — the only airborne strike.",
      },
    ],
  },
];

// A move card carries its romaji id in a <code> token and its gloss in a
// dedicated .move-gloss slot; reading them separately keeps the `throw` move
// (id "throw", gloss "throw") from colliding under a bare getByText.
const idOf = (item: HTMLElement): string | null =>
  item.querySelector("code")?.textContent ?? null;

const glossOf = (item: HTMLElement): string | null =>
  item.querySelector(".move-gloss")?.textContent ?? null;

const descriptorOf = (item: HTMLElement): string | null =>
  item.querySelector(".move-descriptor")?.textContent ?? null;

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

  it("gives each technique its own one-line descriptor, in order under each family", () => {
    const { getByRole } = render(() => <Arsenal />);

    for (const family of EXPECTED_FAMILIES) {
      const familyRegion = getByRole("region", { name: family.name });

      const items = within(familyRegion).getAllByRole("listitem");

      expect(items.map(descriptorOf)).toEqual(
        family.moves.map((move) => move.descriptor),
      );
    }
  });

  it("marks each technique with its score badge — numeric glyph plus accessible label", () => {
    const { getByRole } = render(() => <Arsenal />);

    for (const family of EXPECTED_FAMILIES) {
      const familyRegion = getByRole("region", { name: family.name });

      const items = within(familyRegion).getAllByRole("listitem");

      items.forEach((item, index) => {
        const move = family.moves[index];

        // One icon-role badge per card: the visible glyph is the numeric
        // encoding, the accessible name is the spoken label.
        const badge = within(item).getByRole("img");

        expect(badge.textContent).toBe(move.badge.text);
        expect(badge.getAttribute("aria-label")).toBe(move.badge.label);
      });
    }
  });

  it("ends with a single hand-off link deep-linking the rendered frame table", () => {
    const { getByRole } = render(() => <Arsenal />);

    const region = getByRole("region", { name: "The Arsenal" });

    // Exactly one spec hand-off link in the whole section — no per-card links.
    const specLinks = within(region)
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.startsWith("/spec-guide"));

    expect(specLinks).toHaveLength(1);

    // Framed around the full frame table; the decorative ↗ affordance must not
    // leak into the accessible name (exact-name match asserts it is aria-hidden).
    const specLink = within(region).getByRole("link", {
      name: "Reach, frames, stamina, cancels — see the full frame table",
    });

    // Deep-links straight to the Frame table section of the rendered spec page.
    expect(specLink.getAttribute("href")).toBe("/spec-guide#frame-table");
    // Opens in a new tab, matching the nav + CTA spec links.
    expect(specLink.getAttribute("target")).toBe("_blank");
  });
});
