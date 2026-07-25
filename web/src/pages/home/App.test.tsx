import { fireEvent, render, within } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import App, { type KingResponse } from "./App";
import { type Champion } from "./champion";
import { CANONICAL_ORIGIN } from "../../shared/lib/config";
import type { ReplayListLoad } from "../replay/replay-loader";

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
  replayId: null,
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
      "Fight the champions",
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
      "/#champions",
      "/watch",
      "/ring",
      "/spec-guide",
    ]);
  });

  it("renders the Arsenal as a labelled section for the #arsenal anchor", () => {
    const { getByRole } = render(() => <App />);

    const region = getByRole("region", { name: "The Arsenal" });

    expect(region.id).toBe("arsenal");
  });

  it("places the Arsenal between How it works and The Arena", () => {
    const { getByRole } = render(() => <App />);

    const howItWorks = getByRole("region", { name: "How it works" });
    const arsenal = getByRole("region", { name: "The Arsenal" });
    const arena = getByRole("region", { name: "The Arena" });

    // Arsenal follows How it works in document order...
    expect(
      howItWorks.compareDocumentPosition(arsenal) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // ...and precedes the champions (the Gauntlet section between them was dropped in S2,
    // and the standalone Current King card that used to sit here is gone too).
    expect(
      arena.compareDocumentPosition(arsenal) & Node.DOCUMENT_POSITION_PRECEDING,
    ).toBeTruthy();
  });

  it("renders The Arena as a labelled section for the #champions anchor", () => {
    const { getByRole } = render(() => <App />);

    // The heading renders regardless of fetch state (it sits outside the resource
    // Switch), so this is stable without stubbing the network.
    const region = getByRole("region", { name: "The Arena" });

    expect(region.id).toBe("champions");
  });

  it("renders the fights section as a labelled section for the #fights anchor", () => {
    const { getByRole } = render(() => <App />);

    const region = getByRole("region", { name: /fight replays/i });

    expect(region.id).toBe("fights");
  });

  it("promises nothing as unbuilt anywhere on the page", () => {
    const { container } = render(() => <App />);

    // The Fights section was the last "in development" claim on the marketing page; /watch is
    // public now, so the whole page must stop hedging.
    expect(container.textContent).not.toMatch(/in development/i);
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

describe("App — the /king fetch feeding the one champions section", () => {
  it("says the champions once — the reigning King heads The Arena, with no section of his own", async () => {
    const fetchKing = (): Promise<KingResponse> =>
      Promise.resolve({
        current: champ({ name: "reigning-king", replayId: "king-fight" }),
        recent: [champ({ name: "silver-king", replayId: "silver-fight" })],
      });

    const { getByRole, queryByRole, queryAllByRole } = render(() => (
      <App fetchKing={fetchKing} />
    ));

    const arena = getByRole("region", { name: "The Arena" });

    // The reigning champion is still on the landing page — as The Arena's gold step, badged
    // as King and carrying his own road to the throne. Nothing about him is lost.
    expect(await within(arena).findByText("reigning-king")).toBeTruthy();
    expect(
      within(arena).getByText("King", { selector: ".podium-king-badge" }),
    ).toBeTruthy();
    expect(
      within(arena)
        .getByRole("link", { name: /reigning-king.*road to the throne/i })
        .getAttribute("href"),
    ).toBe("/watch/king-fight");

    // A defender keeps its own fight, so the id still travels per champion.
    expect(
      within(arena)
        .getByRole("link", { name: /silver-king.*road to the throne/i })
        .getAttribute("href"),
    ).toBe("/watch/silver-fight");

    // ...and he is said exactly ONCE: the standalone Current King section is gone, so the
    // page no longer renders the same champion twice under two headings.
    expect(queryByRole("region", { name: "Current King" })).toBeNull();
    expect(queryAllByRole("heading", { name: /current king/i })).toHaveLength(
      0,
    );
    expect(within(arena).getAllByText("reigning-king")).toHaveLength(1);
  });

  it("shows one loading state while the fetch is in flight", async () => {
    // A fetch that never settles holds the resource in its loading state.
    const pending = (): Promise<KingResponse> =>
      new Promise<KingResponse>(() => {});

    const { findAllByText, queryByText } = render(() => (
      <App fetchKing={pending} />
    ));

    // The Arena announces the in-flight request — once, not once per section.
    expect(await findAllByText(/gathering the champions/i)).toHaveLength(1);
    // The deleted King card's loading copy must not survive anywhere.
    expect(queryByText(/summoning the reigning champion/i)).toBeNull();
  });

  it("fetches /king once, feeding `current` to gold and `recent` to the defenders", async () => {
    let calls = 0;

    const fetchKing = (): Promise<KingResponse> => {
      calls += 1;

      return Promise.resolve({
        current: champ({ name: "reigning-king" }),
        recent: [
          champ({ name: "silver-king" }),
          champ({ name: "bronze-king" }),
        ],
      });
    };

    const { getByRole } = render(() => <App fetchKing={fetchKing} />);

    const arena = getByRole("region", { name: "The Arena" });

    expect(await within(arena).findByText("reigning-king")).toBeTruthy();
    expect(within(arena).getByText("silver-king")).toBeTruthy();
    expect(within(arena).getByText("bronze-king")).toBeTruthy();

    // One request, not one per rendered champion.
    expect(calls).toBe(1);
  });

  it("shows one error whose single Retry re-runs the fetch", async () => {
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

    // One section surfaces the failure — one error copy, one Retry button, not two of each.
    expect(await findAllByText(/couldn't reach the ring/i)).toHaveLength(1);

    const retries = await findAllByRole("button", { name: /retry/i });

    expect(retries).toHaveLength(1);

    fireEvent.click(retries[0]);

    // The refetch refills The Arena — both the King and his defender.
    const arena = getByRole("region", { name: "The Arena" });

    expect(await within(arena).findByText("recovered-king")).toBeTruthy();
    expect(within(arena).getByText("recovered-defender")).toBeTruthy();
    expect(calls).toBe(2);
  });
});

// The landing page makes TWO independent requests: /king feeds The Arena, and /replay feeds the
// fight cards. Neither may be able to take the other down — a throne-store outage must not blank
// the fights, and an archive outage must not blank the champions.
describe("App — the throne and the fight archive fail independently", () => {
  const kingPayload = (): KingResponse => ({
    current: champ({ name: "sitting-king" }),
    recent: [champ({ name: "recent-defender" })],
  });

  const fightsPayload = () =>
    Promise.resolve<ReplayListLoad>({
      kind: "ready",
      items: [
        {
          id: "fight-1",
          fighters: [
            { name: "challenger", model: "claude" },
            { name: "king", model: "claude" },
          ],
        },
      ],
    });

  it("still shows the fights when /king is down", async () => {
    const { container, findAllByText } = render(() => (
      <App
        fetchKing={() => Promise.reject(new Error("throne store unreachable"))}
        loadFights={fightsPayload}
      />
    ));

    await findAllByText(/couldn't reach the ring/i);

    const fightLinks = [...container.querySelectorAll("a")].filter((link) =>
      link.getAttribute("href")?.startsWith("/watch/"),
    );

    expect(fightLinks.map((link) => link.getAttribute("href"))).toEqual([
      "/watch/fight-1",
    ]);
  });

  it("still shows the champions when the fight archive is down", async () => {
    const { getByRole } = render(() => (
      <App
        fetchKing={() => Promise.resolve(kingPayload())}
        loadFights={() => Promise.reject(new Error("archive unreachable"))}
      />
    ));

    const arena = getByRole("region", { name: "The Arena" });

    expect(await within(arena).findByText("sitting-king")).toBeTruthy();
    expect(within(arena).getByText("recent-defender")).toBeTruthy();
  });
});
