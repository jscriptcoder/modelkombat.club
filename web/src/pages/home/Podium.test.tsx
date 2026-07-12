import { fireEvent, render } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";

import Podium from "./Podium";
import { type Champion } from "./King";
import { CANONICAL_ORIGIN } from "../../shared/lib/config";

// A resolved champion. Overrides let a test rename or null out model/handle without
// restating the whole identity shape.
const champ = (overrides?: Partial<Champion>): Champion => ({
  name: "champion",
  model: "claude-opus-4-8",
  handle: "grandmaster",
  ...overrides,
});

const stepOf = (container: HTMLElement, rank: string): Element | null =>
  container.querySelector(`.podium-step.${rank}`);

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

  it("is a labelled landmark region named The Arena for the #champions anchor", () => {
    const { getByRole } = render(() => <Podium current={champ()} />);

    const region = getByRole("region", { name: "The Arena" });

    expect(region.id).toBe("champions");
  });
});
