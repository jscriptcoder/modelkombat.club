import { render, within } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import Gauntlet from "./Gauntlet";

// The expected roster is hardcoded here — deliberately NOT imported from the
// component — so a renamed, dropped, or reordered fighter fails this test. The
// web project can't run Stryker, so exact assertions plus this independent
// duplication are the mutation guard.
type ExpectedFighter = {
  readonly name: string;
  readonly monogram: string;
};

// Canonical gauntlet order — GAUNTLET_NAMES (src/engine/benchmark-config.ts).
const EXPECTED_FIGHTERS: readonly ExpectedFighter[] = [
  { name: "jabber", monogram: "J" },
  { name: "rekka", monogram: "R" },
  { name: "zoner", monogram: "Z" },
  { name: "grappler", monogram: "G" },
  { name: "sweeper", monogram: "S" },
  { name: "vulture", monogram: "V" },
];

// A fighter card carries its bot name in a dedicated .fighter-name token, read
// separately so the mono lowercase name is pinned independent of the bio copy.
const nameOf = (item: HTMLElement): string | null =>
  item.querySelector(".fighter-name")?.textContent ?? null;

describe("Gauntlet section", () => {
  it("is a labelled region anchored at #gauntlet with a gate-framing lede", () => {
    const { getByRole } = render(() => <Gauntlet />);

    const region = getByRole("region", { name: "The Gauntlet" });

    // The id is the in-page anchor target the nav links to.
    expect(region.id).toBe("gauntlet");
    // The gate-framing lede, pinned verbatim (AC-G5) — ties the CTA → King arc;
    // an empty, truncated, or reworded lede fails here.
    expect(region.textContent).toContain(
      "Six house fighters stand between your bot and a title shot — beat a majority against each to earn your challenge at the King.",
    );
  });

  it("lists the six house fighters by mono name, in canonical order", () => {
    const { getByRole } = render(() => <Gauntlet />);

    const region = getByRole("region", { name: "The Gauntlet" });

    const names = within(region).getAllByRole("listitem").map(nameOf);

    // Pins both the count (exactly six) and the canonical GAUNTLET_NAMES order.
    expect(names).toEqual(EXPECTED_FIGHTERS.map((fighter) => fighter.name));
  });

  it("leads each card with a decorative monogram tile", () => {
    const { getByRole } = render(() => <Gauntlet />);

    const region = getByRole("region", { name: "The Gauntlet" });

    const items = within(region).getAllByRole("listitem");

    items.forEach((item, index) => {
      const tile = item.querySelector(".fighter-monogram");

      expect(tile?.textContent).toBe(EXPECTED_FIGHTERS[index].monogram);
      // Decorative: the fighter name carries the accessible label, so the
      // single-letter tile must not leak into the accessibility tree.
      expect(tile?.getAttribute("aria-hidden")).toBe("true");
    });
  });
});
