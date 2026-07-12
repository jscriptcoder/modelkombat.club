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
  readonly bio: string;
  readonly signature: string;
};

// Canonical gauntlet order — GAUNTLET_NAMES (src/engine/benchmark-config.ts).
// Bios and signature tokens are the authored copy (AC-G2/G3), faithful to each
// bot's rules.
const EXPECTED_FIGHTERS: readonly ExpectedFighter[] = [
  {
    name: "jabber",
    monogram: "J",
    bio: "Death by a thousand cuts. Walks you down, reads your strike's height and blocks it, then answers with the jab.",
    signature: "kizami-zuki",
  },
  {
    name: "rekka",
    monogram: "R",
    bio: "Flurry artist. Chains cancel into cancel, then leaps in for a jump-kick ippon.",
    signature: "tobi-geri",
  },
  {
    name: "zoner",
    monogram: "Z",
    bio: "Fights at the fence — picks the exact-length kick for the gap and retreats the instant you close the distance.",
    signature: "ushiro-geri",
  },
  {
    name: "grappler",
    monogram: "G",
    bio: "Owns the clinch. Crowd him and he throws you to the mat, then punishes the knockdown with a reverse punch.",
    signature: "throw",
  },
  {
    name: "sweeper",
    monogram: "S",
    bio: "Chops your base out with a foot sweep, then cashes the knockdown for a reverse-punch finish.",
    signature: "sweep → gyaku-zuki",
  },
  {
    name: "vulture",
    monogram: "V",
    bio: "Patient predator. Baits the whiff, punishes it with a snap backfist — and feeds on a gassed opponent.",
    signature: "uraken",
  },
];

// A fighter card carries its bot name in a dedicated .fighter-name token, its
// style bio in a .fighter-bio slot, and its signature technique in a
// .fighter-signature-token slot — each read separately so the mono lowercase
// name is pinned independent of the bio and signature copy.
const nameOf = (item: HTMLElement): string | null =>
  item.querySelector(".fighter-name")?.textContent ?? null;

const bioOf = (item: HTMLElement): string | null =>
  item.querySelector(".fighter-bio")?.textContent ?? null;

const signatureOf = (item: HTMLElement): string | null =>
  item.querySelector(".fighter-signature-token")?.textContent ?? null;

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

  it("gives each fighter an authored style bio, in order", () => {
    const { getByRole } = render(() => <Gauntlet />);

    const region = getByRole("region", { name: "The Gauntlet" });

    const bios = within(region).getAllByRole("listitem").map(bioOf);

    // Exact authored copy per fighter, in canonical order (AC-G3).
    expect(bios).toEqual(EXPECTED_FIGHTERS.map((fighter) => fighter.bio));
  });

  it("names each fighter's signature technique as a non-link mono token, in order", () => {
    const { getByRole } = render(() => <Gauntlet />);

    const region = getByRole("region", { name: "The Gauntlet" });

    const tokens = within(region).getAllByRole("listitem").map(signatureOf);

    // Exact signature token per fighter, in canonical order (AC-G2).
    expect(tokens).toEqual(
      EXPECTED_FIGHTERS.map((fighter) => fighter.signature),
    );

    // Signature tokens are styled text, not hyperlinks — /spec and #arsenal
    // have no per-move anchors, and the cards are non-interactive (AC-G2/G7).
    expect(within(region).queryAllByRole("link")).toHaveLength(0);
  });

  it("shows no numeric stat for any fighter", () => {
    const { getByRole } = render(() => <Gauntlet />);

    const region = getByRole("region", { name: "The Gauntlet" });

    // Deliberate absence (AC-G9): the roster is balanced to ~50% inter-bot, so a
    // win-rate or record would misrepresent it. The copy is authored digit-free
    // (the lede reads "Six", not "6"), so any numeric stat creeping in fails.
    expect(region.textContent).not.toMatch(/\d/);
    expect(region.textContent).not.toContain("%");
  });
});
