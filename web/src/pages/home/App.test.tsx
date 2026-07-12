import { fireEvent, render, within } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import App, { type KingResponse } from "./App";
import { type Champion } from "./King";
import { CANONICAL_ORIGIN } from "../../shared/lib/config";

const isDark = (color: string): boolean => {
  const channels = color.match(/\d+/g)?.map(Number) ?? [];
  const [r, g, b] = channels;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance < 0.35;
};

// A champion identity for the /king payload. Overrides let a test rename or renumber a
// reign without restating the whole shape.
const champ = (overrides?: Partial<Champion>): Champion => ({
  name: "champion",
  model: "claude-opus-4-8",
  handle: "grandmaster",
  ...overrides,
});

describe("App (landing page)", () => {
  it("names the site in the top-level heading", () => {
    const { getByRole } = render(() => <App />);

    expect(
      getByRole("heading", { level: 1, name: "ModelKombat" }),
    ).toBeTruthy();
  });

  it("links to the bot spec at exactly /spec", () => {
    // The "How it works" spec link points at the raw /spec markdown endpoint;
    // match by href rather than a loose accessible-name regex.
    const { getAllByRole } = render(() => <App />);

    const specHrefs = getAllByRole("link")
      .map((link) => link.getAttribute("href"))
      .filter((href) => href === "/spec");

    expect(specHrefs.length).toBeGreaterThan(0);
  });

  it("sets a descriptive document title naming ModelKombat", () => {
    render(() => <App />);

    expect(document.title).toMatch(/ModelKombat/);
  });

  it("sets a meta description naming ModelKombat", () => {
    render(() => <App />);

    const description = document
      .querySelector('meta[name="description"]')
      ?.getAttribute("content");

    expect(description).toMatch(/ModelKombat/i);
  });

  it("paints an opaque dark background (dark theme)", () => {
    render(() => <App />);

    const background = getComputedStyle(document.body).backgroundColor;

    // Default (unstyled) body reports the transparent "rgba(0, 0, 0, 0)";
    // an applied opaque colour reports "rgb(...)".
    expect(background).toMatch(/^rgb\(/);
    expect(isDark(background)).toBe(true);
  });

  it("explains the game in exactly four ordered steps", () => {
    const { getByRole } = render(() => <App />);

    const section = getByRole("region", { name: "How it works" });

    // The id is the in-page anchor target the nav will link to (Slice 1c).
    expect(section.id).toBe("how-it-works");

    const stepTitles = within(section)
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);

    expect(stepTitles).toEqual([
      "Read the spec",
      "Write a JSON bot",
      "Clear the gauntlet",
      "Challenge the King",
    ]);
  });

  it("surfaces the spec URL as a copyable link to /spec", () => {
    const { getByRole } = render(() => <App />);

    // The "Read the spec" step shows the canonical absolute spec URL as a link to the
    // raw /spec endpoint (with a copy affordance beside it, covered in HowItWorks).
    const specLink = getByRole("link", {
      name: `${CANONICAL_ORIGIN}/spec`,
    });

    expect(specLink.getAttribute("href")).toBe("/spec");
  });

  it("shows a runnable POST /fight snippet", () => {
    const { container } = render(() => <App />);

    const snippet = container.querySelector("pre");

    if (!(snippet instanceof HTMLElement)) {
      throw new Error("expected a <pre> code snippet on the page");
    }

    const text = snippet.textContent ?? "";

    expect(text).toContain("POST");
    expect(text).toContain(`${CANONICAL_ORIGIN}/fight`);
    expect(text).toContain("X-Author-Handle");
  });

  it("provides a sticky nav linking to the top, the sections, and the spec", () => {
    const { getByRole } = render(() => <App />);

    const nav = getByRole("navigation");

    const hrefs = within(nav)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));

    expect(hrefs).toEqual([
      "/#top",
      "/#how-it-works",
      "/#arsenal",
      "/#gauntlet",
      "/#king",
      "/#champions",
      "/#fights",
      "/ring",
      "/spec-guide",
    ]);
  });

  it("renders the Arsenal as a labelled section for the #arsenal anchor", () => {
    const { getByRole } = render(() => <App />);

    const region = getByRole("region", { name: "The Arsenal" });

    expect(region.id).toBe("arsenal");
  });

  it("places the Arsenal between How it works and the Gauntlet", () => {
    const { getByRole } = render(() => <App />);

    const howItWorks = getByRole("region", { name: "How it works" });
    const arsenal = getByRole("region", { name: "The Arsenal" });
    const gauntlet = getByRole("region", { name: "The Gauntlet" });

    // Arsenal follows How it works in document order...
    expect(
      howItWorks.compareDocumentPosition(arsenal) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // ...and precedes the Gauntlet.
    expect(
      gauntlet.compareDocumentPosition(arsenal) &
        Node.DOCUMENT_POSITION_PRECEDING,
    ).toBeTruthy();
  });

  it("renders the Gauntlet as a labelled section for the #gauntlet anchor", () => {
    const { getByRole } = render(() => <App />);

    const region = getByRole("region", { name: "The Gauntlet" });

    expect(region.id).toBe("gauntlet");
  });

  it("places the Gauntlet between the Arsenal and the King", () => {
    const { getByRole } = render(() => <App />);

    const arsenal = getByRole("region", { name: "The Arsenal" });
    const gauntlet = getByRole("region", { name: "The Gauntlet" });
    const king = getByRole("region", { name: "Current King" });

    // Gauntlet follows the Arsenal in document order...
    expect(
      arsenal.compareDocumentPosition(gauntlet) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // ...and precedes the King.
    expect(
      king.compareDocumentPosition(gauntlet) & Node.DOCUMENT_POSITION_PRECEDING,
    ).toBeTruthy();
  });

  it("renders The Arena as a labelled section for the #champions anchor", () => {
    const { getByRole } = render(() => <App />);

    // The heading renders regardless of fetch state (it sits outside the resource
    // Switch), so this is stable without stubbing the network.
    const region = getByRole("region", { name: "The Arena" });

    expect(region.id).toBe("champions");
  });

  it("renders the fights teaser as a labelled section for the #fights anchor", () => {
    const { getByRole } = render(() => <App />);

    const region = getByRole("region", { name: /fight replays/i });

    expect(region.id).toBe("fights");
  });

  it("fences each content section off with a hairline divider in the border colour", () => {
    const { container } = render(() => <App />);

    const sections = [...container.querySelectorAll(".section")];

    // Every content section is delimited from the one above it by a top rule in
    // the shared --border colour (rgb(30, 36, 48)), so the page reads as distinct
    // blocks instead of one continuous column.
    expect(sections.length).toBeGreaterThan(0);

    for (const section of sections) {
      const style = getComputedStyle(section);

      expect(style.borderTopStyle).toBe("solid");
      expect(parseFloat(style.borderTopWidth)).toBeGreaterThan(0);
      expect(style.borderTopColor).toBe("rgb(30, 36, 48)");
    }
  });

  it("renders a footer landmark naming the site", () => {
    const { getByRole } = render(() => <App />);

    const footer = getByRole("contentinfo");

    expect(footer.textContent).toContain("ModelKombat");
  });

  it("gates smooth scrolling behind prefers-reduced-motion: no-preference", () => {
    render(() => <App />);

    const allRules = [...document.styleSheets].flatMap((sheet) => {
      try {
        return [...sheet.cssRules];
      } catch {
        return [];
      }
    });

    const reducedMotionGate = allRules
      .filter((rule): rule is CSSMediaRule => rule instanceof CSSMediaRule)
      .find((rule) =>
        rule.conditionText.includes("prefers-reduced-motion: no-preference"),
      );

    if (!reducedMotionGate) {
      throw new Error(
        "expected a @media (prefers-reduced-motion: no-preference) gate",
      );
    }

    expect(reducedMotionGate.cssText).toMatch(/scroll-behavior:\s*smooth/);
  });
});

describe("App — single /king fetch feeding both throne sections", () => {
  it("shows both sections' loading state while the shared fetch is in flight", async () => {
    // A fetch that never settles holds the single shared resource in its loading state.
    const pending = (): Promise<KingResponse> =>
      new Promise<KingResponse>(() => {});

    const { findByText } = render(() => <App fetchKing={pending} />);

    // The one in-flight request drives BOTH sections' loading copy at once.
    expect(await findByText(/summoning the reigning champion/i)).toBeTruthy();
    expect(await findByText(/gathering the champions/i)).toBeTruthy();
  });

  it("fetches /king once and feeds `current` to the King and `recent` to the Hall of Kings", async () => {
    let calls = 0;

    const fetchKing = (): Promise<KingResponse> => {
      calls += 1;

      return Promise.resolve({
        current: champ({ name: "reigning-king" }),
        recent: [champ({ name: "gold-king" }), champ({ name: "silver-king" })],
      });
    };

    const { getByRole } = render(() => <App fetchKing={fetchKing} />);

    // The King section renders the reigning champion...
    const king = getByRole("region", { name: "Current King" });

    expect(await within(king).findByText("reigning-king")).toBeTruthy();

    // ...and The Arena renders the ranked defenders...
    const hall = getByRole("region", { name: "The Arena" });

    expect(await within(hall).findByText("gold-king")).toBeTruthy();
    expect(within(hall).getByText("silver-king")).toBeTruthy();

    // ...from ONE shared request, not one fetch per section (the King now also heads The
    // Arena as gold, so scope the section reads rather than counting bare occurrences).
    expect(calls).toBe(1);
  });

  it("shows the shared error in both sections, and a single Retry recovers both", async () => {
    let calls = 0;

    const flaky = (): Promise<KingResponse> => {
      calls += 1;

      return calls === 1
        ? Promise.reject(new Error("throne store unreachable"))
        : Promise.resolve({
            current: champ({ name: "recovered-king" }),
            recent: [champ({ name: "recovered-defender" })],
          });
    };

    const { findAllByRole, findAllByText, getByRole } = render(() => (
      <App fetchKing={flaky} />
    ));

    // Both sections surface the shared failure — two error copies, two Retry buttons.
    const errors = await findAllByText(/couldn't reach the ring/i);

    expect(errors).toHaveLength(2);

    // Retrying from ONE section re-runs the single shared fetch and refills both.
    const [retry] = await findAllByRole("button", { name: /retry/i });

    fireEvent.click(retry);

    // One shared refetch refills BOTH the King (hero) and The Arena (its defender).
    const king = getByRole("region", { name: "Current King" });
    const arena = getByRole("region", { name: "The Arena" });

    expect(await within(king).findByText("recovered-king")).toBeTruthy();
    expect(await within(arena).findByText("recovered-defender")).toBeTruthy();
    expect(calls).toBe(2);
  });
});
