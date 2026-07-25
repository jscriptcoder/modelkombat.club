import { fireEvent, render } from "@solidjs/testing-library";
import { page } from "vitest/browser";
import { afterEach, describe, expect, it, vi } from "vitest";

import "../../shared/app.css";
import Podium from "./Podium";
import { type Champion } from "./champion";
import { CANONICAL_ORIGIN } from "../../shared/lib/config";

// A resolved champion. Overrides let a test rename or null out model/handle without
// restating the whole identity shape.
const champ = (overrides?: Partial<Champion>): Champion => ({
  name: "champion",
  model: "claude-opus-4-8",
  handle: "grandmaster",
  // Most cases don't care how this champion got here; the ones that do override it.
  replayId: null,
  ...overrides,
});

const stepOf = (container: HTMLElement, rank: string): Element | null =>
  container.querySelector(`.podium-step.${rank}`);

// The laid-out box of one step, for the tests that are about arrangement rather than content.
// Throws rather than asserting non-null so a missing step reads as a broken test, not as a
// confusing geometry failure.
const boxOf = (container: HTMLElement, rank: string): DOMRect => {
  const step = stepOf(container, rank);

  if (!(step instanceof HTMLElement)) {
    throw new Error(`expected a ${rank} podium step`);
  }

  return step.getBoundingClientRect();
};

// One step's box paired with the box of the 👁 link pinned inside it.
const boxesOf = (
  container: HTMLElement,
  rank: string,
): { step: DOMRect; glyph: DOMRect } => {
  const step = stepOf(container, rank);
  const glyph = step?.querySelector(".road-to-throne");

  if (!(step instanceof HTMLElement) || !(glyph instanceof HTMLElement)) {
    throw new Error(
      `expected a ${rank} step carrying a road-to-the-throne link`,
    );
  }

  return {
    step: step.getBoundingClientRect(),
    glyph: glyph.getBoundingClientRect(),
  };
};

// Where one podium step's road-to-the-throne link points, or null when it has none.
const watchHrefOf = (container: HTMLElement, rank: string): string | null =>
  stepOf(container, rank)
    ?.querySelector('a[href^="/watch/"]')
    ?.getAttribute("href") ?? null;

describe("The Arena podium", () => {
  it("shows an accessible loading state while the arena is being fetched", () => {
    const { getByRole } = render(() => <Podium loading={true} />);

    // A live status region announces the in-flight fetch.
    expect(getByRole("status")).toBeTruthy();
  });

  it("composes the King (gold) and the defenders (silver, bronze) from current + recent", () => {
    const { container } = render(() => (
      <Podium
        current={champ({ name: "opus" })}
        recent={[champ({ name: "sonnet" }), champ({ name: "haiku" })]}
      />
    ));

    // The King heads the podium as gold; the ranked defenders follow silver → bronze.
    expect(stepOf(container, "gold")?.textContent).toContain("opus");
    expect(stepOf(container, "silver")?.textContent).toContain("sonnet");
    expect(stepOf(container, "bronze")?.textContent).toContain("haiku");

    // Rank is conveyed by text, not colour alone.
    expect(stepOf(container, "gold")?.textContent).toContain("Gold");
    expect(stepOf(container, "silver")?.textContent).toContain("Silver");
    expect(stepOf(container, "bronze")?.textContent).toContain("Bronze");
  });

  it("marks the gold step as the reigning King, and no other step", () => {
    const { container } = render(() => (
      <Podium
        current={champ({ name: "opus" })}
        recent={[champ({ name: "sonnet" })]}
      />
    ));

    // The gold step carries the King badge...
    expect(
      stepOf(container, "gold")?.querySelector(".podium-king-badge")
        ?.textContent,
    ).toBe("King");
    // ...and no defender step does.
    expect(
      stepOf(container, "silver")?.querySelector(".podium-king-badge"),
    ).toBeNull();
    expect(
      stepOf(container, "bronze")?.querySelector(".podium-king-badge"),
    ).toBeNull();
  });

  it("brands each arena member with its model's logo", () => {
    const { getByRole } = render(() => (
      <Podium
        current={champ({ name: "gold-king", model: "gpt-4o" })}
        recent={[champ({ name: "silver-king", model: "gemini-2.5-pro" })]}
      />
    ));

    // Each filled step wears its champion's brand mark.
    expect(getByRole("img", { name: "authored by OpenAI" })).toBeTruthy();
    expect(getByRole("img", { name: "authored by Gemini" })).toBeTruthy();
  });

  it("dims the bronze step when the arena holds only the King and one defender", () => {
    const { container } = render(() => (
      <Podium
        current={champ({ name: "gold-king" })}
        recent={[champ({ name: "silver-king" })]}
      />
    ));

    expect(stepOf(container, "gold")?.textContent).toContain("gold-king");
    expect(stepOf(container, "silver")?.textContent).toContain("silver-king");

    // Bronze is a dimmed placeholder — no fabricated champion.
    const bronze = stepOf(container, "bronze");

    expect(bronze?.classList.contains("podium-step-empty")).toBe(true);
    expect(bronze?.querySelector(".podium-name")).toBeNull();
  });

  it("dims silver and bronze when only the King reigns (empty recent)", () => {
    const { container } = render(() => (
      <Podium current={champ({ name: "lone-king" })} recent={[]} />
    ));

    expect(stepOf(container, "gold")?.textContent).toContain("lone-king");
    expect(
      stepOf(container, "silver")?.classList.contains("podium-step-empty"),
    ).toBe(true);
    expect(
      stepOf(container, "bronze")?.classList.contains("podium-step-empty"),
    ).toBe(true);
  });

  it("never renders a generation line on any step", () => {
    const { container, queryByText } = render(() => (
      <Podium
        current={champ({ name: "opus" })}
        recent={[champ({ name: "sonnet" })]}
      />
    ));

    // The throne CAS token no longer surfaces — rank (the medal) is the standing.
    expect(container.querySelector(".podium-gen")).toBeNull();
    expect(queryByText(/Gen\s*\d/)).toBeNull();
  });

  it("renders an anchored honest empty state when the arena is empty (no King)", () => {
    const { container, getByText } = render(() => (
      <Podium current={null} recent={[]} />
    ));

    // Honest empty line — no fabricated podium steps.
    expect(getByText(/no champions have been crowned yet/i)).toBeTruthy();
    expect(container.querySelector(".podium-step")).toBeNull();

    // ...but the #champions anchor still exists so the nav link stays valid.
    expect(container.querySelector("#champions")).toBeTruthy();
  });

  it("points visitors to the live /king endpoint from the empty arena", () => {
    // The empty fallback is exactly what the prerender bakes into the no-JS HTML, so this
    // link is a no-JS bot's pointer to the live standings (mirrors the /spec link).
    const { getByRole } = render(() => <Podium current={null} recent={[]} />);

    const link = getByRole("link", { name: `${CANONICAL_ORIGIN}/king` });

    expect(link.getAttribute("href")).toBe("/king");
  });

  it("drops the /king endpoint link once the arena has a King", () => {
    // The link lives in the empty fallback only — a populated podium replaces it.
    const { queryByRole } = render(() => <Podium current={champ()} />);

    expect(
      queryByRole("link", { name: `${CANONICAL_ORIGIN}/king` }),
    ).toBeNull();
  });

  it("drops the /king endpoint link in the error state", () => {
    const { queryByRole } = render(() => <Podium error={true} />);

    expect(
      queryByRole("link", { name: `${CANONICAL_ORIGIN}/king` }),
    ).toBeNull();
  });

  it("shows the same name on multiple steps for a dethroned-then-re-crowned champion", () => {
    const { getAllByText } = render(() => (
      <Podium
        current={champ({ name: "comeback-king" })}
        recent={[champ({ name: "comeback-king" })]}
      />
    ));

    // Both entries render — duplicate names across slots are NOT deduped.
    expect(getAllByText("comeback-king")).toHaveLength(2);
  });

  it("renders a hostile champion name as inert text, never as markup", () => {
    const hostile = "<script>alert(1)</script>";

    const { container, getByText } = render(() => (
      <Podium current={champ({ name: hostile })} />
    ));

    // Shown as literal text (Solid auto-escapes)...
    expect(getByText(hostile)).toBeTruthy();
    // ...and no actual <script> element was injected.
    expect(container.querySelector("script")).toBeNull();
  });

  it("keeps a long name on one line with the full value in a title attribute", () => {
    const long = "K".repeat(64);

    const { getByText } = render(() => (
      <Podium current={champ({ name: long })} />
    ));

    const nameEl = getByText(long);

    // Full value preserved for hover / assistive tech even when visually truncated.
    expect(nameEl.getAttribute("title")).toBe(long);
    expect(nameEl.classList.contains("podium-name")).toBe(true);
  });

  it("omits the model and handle lines when they are absent", () => {
    const { container, queryByText } = render(() => (
      <Podium current={champ({ name: "spartan", model: null, handle: null })} />
    ));

    // No "null"/"undefined" leaks into the card.
    expect(queryByText(/null|undefined/)).toBeNull();
    expect(container.querySelector(".podium-model")).toBeNull();
    expect(container.querySelector(".podium-handle")).toBeNull();
  });

  it("shows a distinct error state whose Retry re-requests the arena", () => {
    const onRetry = vi.fn();

    const { getByText, getByRole } = render(() => (
      <Podium error={true} onRetry={onRetry} />
    ));

    // Distinct failure copy.
    expect(getByText(/couldn't reach the ring/i)).toBeTruthy();

    fireEvent.click(getByRole("button", { name: /retry/i }));

    // The Retry button drives the shared /king refetch owned by the parent (App).
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("never shows the empty-arena line on a fetch failure", () => {
    const { getByText, queryByText } = render(() => <Podium error={true} />);

    expect(getByText(/couldn't reach the ring/i)).toBeTruthy();
    expect(queryByText(/no champions have been crowned/i)).toBeNull();
  });

  it("links every step of the podium to the fight that seated that champion", () => {
    const { container } = render(() => (
      <Podium
        current={champ({ name: "opus", replayId: "gold-id" })}
        recent={[
          champ({ name: "sonnet", replayId: "silver-id" }),
          champ({ name: "haiku", replayId: "bronze-id" }),
        ]}
      />
    ));

    // Each step points at its OWN champion's fight — a single shared id would pass a
    // "some link exists" check and still send every visitor to the same bout.
    expect(watchHrefOf(container, "gold")).toBe("/watch/gold-id");
    expect(watchHrefOf(container, "silver")).toBe("/watch/silver-id");
    expect(watchHrefOf(container, "bronze")).toBe("/watch/bronze-id");
  });

  it("names each podium link after the champion it belongs to", () => {
    const { getByRole } = render(() => (
      <Podium
        current={champ({ name: "opus", replayId: "gold-id" })}
        recent={[champ({ name: "sonnet", replayId: "silver-id" })]}
      />
    ));

    // Three identical "watch" links would be useless to a screen-reader user scanning by link.
    expect(
      getByRole("link", { name: /opus.*road to the throne/i }).getAttribute(
        "href",
      ),
    ).toBe("/watch/gold-id");
    expect(
      getByRole("link", { name: /sonnet.*road to the throne/i }).getAttribute(
        "href",
      ),
    ).toBe("/watch/silver-id");
  });

  it("omits the affordance on exactly the steps whose fight is unreachable", () => {
    const { container } = render(() => (
      <Podium
        current={champ({ name: "opus", replayId: "gold-id" })}
        recent={[
          champ({ name: "seeded-house", replayId: null }),
          champ({ name: "haiku", replayId: "bronze-id" }),
        ]}
      />
    ));

    // Mixed on purpose: a component that linked everything, or nothing, fails this.
    expect(watchHrefOf(container, "gold")).toBe("/watch/gold-id");
    expect(watchHrefOf(container, "silver")).toBeNull();
    expect(watchHrefOf(container, "bronze")).toBe("/watch/bronze-id");
    // And the silver step shows no disabled stand-in either.
    expect(
      stepOf(container, "silver")?.querySelector("[aria-disabled]") ?? null,
    ).toBeNull();
  });

  it("is a labelled landmark region named The Arena for the #champions anchor", () => {
    const { getByRole } = render(() => <Podium current={champ()} />);

    const region = getByRole("region", { name: "The Arena" });

    expect(region.id).toBe("champions");
  });
});

// A real podium puts the winner in the middle and raises no one above the two beside them in
// reading order. These tests are about ARRANGEMENT, so they need real CSS (this file imports
// `app.css`) and a real width: the browser project's default viewport is 414px — narrower than
// the podium's 480px stacking breakpoint — so the wide layout is invisible unless a test asks
// for it, and must be handed back afterwards so later tests still see the default.
describe("The Arena podium — arrangement", () => {
  const DEFAULT_VIEWPORT = { width: 414, height: 896 } as const;

  const fullPodium = () => (
    <Podium
      current={champ({ name: "gold-king" })}
      recent={[champ({ name: "silver-king" }), champ({ name: "bronze-king" })]}
    />
  );

  afterEach(async () => {
    await page.viewport(DEFAULT_VIEWPORT.width, DEFAULT_VIEWPORT.height);
  });

  it("stands the King between the two defenders — silver, gold, bronze — on one row when there is room", async () => {
    await page.viewport(1280, 800);

    const { container } = render(fullPodium);

    const [silver, gold, bronze] = [
      boxOf(container, "silver"),
      boxOf(container, "gold"),
      boxOf(container, "bronze"),
    ];

    // Left to right: silver, then the King, then bronze.
    expect(silver.left).toBeLessThan(gold.left);
    expect(gold.left).toBeLessThan(bronze.left);

    // One row, not a staircase — they are peers on a podium, so they share a top edge.
    expect(gold.top).toBe(silver.top);
    expect(bronze.top).toBe(silver.top);
  });

  it("keeps the ranked reading order gold → silver → bronze whatever the visual arrangement", () => {
    const { container } = render(fullPodium);

    // The podium is an ordered list, so source order IS rank: a screen reader, a reader with
    // no CSS, and the prerendered HTML must all still get first place first. Centring gold
    // visually must never be bought by demoting it in the DOM.
    const order = [...container.querySelectorAll(".podium-step")].map(
      (step) => step.querySelector(".podium-rank")?.textContent,
    );

    expect(order).toEqual(["Gold", "Silver", "Bronze"]);
  });

  it("stacks the steps gold-first in one column at the widest stacking width", async () => {
    // 480px exactly: the last width that stacks. Asserting at the boundary rather than at some
    // comfortably narrow width is what catches an off-by-one in the breakpoint pair — at 480 a
    // centring rule that started one pixel early would stack the column silver-first.
    await page.viewport(480, 800);

    const { container } = render(fullPodium);

    const [gold, silver, bronze] = [
      boxOf(container, "gold"),
      boxOf(container, "silver"),
      boxOf(container, "bronze"),
    ];

    // Stacked top to bottom in rank order — the centring must not leak into this layout and
    // push the King into the middle of a vertical list.
    expect(gold.top).toBeLessThan(silver.top);
    expect(silver.top).toBeLessThan(bronze.top);

    // One column: every step starts at the same left edge, and nothing scrolls sideways.
    expect(silver.left).toBe(gold.left);
    expect(bronze.left).toBe(gold.left);
  });
});

// The 👁 road to the throne is a secondary affordance, so it moves out of the card body and
// into the card's corner — where a "more about this one" control is conventionally found —
// instead of sitting under the champion's identity competing with it.
describe("The Arena podium — where the road-to-the-throne link sits", () => {
  it("pins each step's link to the top-right corner of that step, inside its bounds", () => {
    const { container } = render(() => (
      <Podium
        current={champ({ name: "gold-king", replayId: "gold-id" })}
        recent={[champ({ name: "silver-king", replayId: "silver-id" })]}
      />
    ));

    // Both a filled gold step and a filled defender step — the placement is a property of the
    // card, so it cannot be right for the King and wrong for a defender.
    for (const rank of ["gold", "silver"]) {
      const { step, glyph } = boxesOf(container, rank);

      // Top-right quadrant: right of the card's centre line...
      expect(glyph.left + glyph.width / 2).toBeGreaterThan(
        step.left + step.width / 2,
      );
      // ...and above it.
      expect(glyph.top + glyph.height / 2).toBeLessThan(
        step.top + step.height / 2,
      );

      // Still inside the card it belongs to — a corner affordance that overhangs the border
      // reads as belonging to the page, or to the neighbouring step.
      expect(glyph.left).toBeGreaterThanOrEqual(step.left);
      expect(glyph.right).toBeLessThanOrEqual(step.right);
      expect(glyph.top).toBeGreaterThanOrEqual(step.top);
      expect(glyph.bottom).toBeLessThanOrEqual(step.bottom);
    }
  });
});
