import { fireEvent, render } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";

import Podium from "./Podium";
import { type Champion } from "./King";

// A resolved champion. Overrides let a test rename, bump the generation, or null out
// model/handle without restating the whole identity shape.
const champ = (overrides?: Partial<Champion>): Champion => ({
  name: "champion",
  model: "claude-opus-4-8",
  handle: "grandmaster",
  generation: 1,
  ...overrides,
});

const stepOf = (container: HTMLElement, rank: string): Element | null =>
  container.querySelector(`.podium-step.${rank}`);

describe("Hall of Kings podium", () => {
  it("shows an accessible loading state while the succession is being fetched", () => {
    const { getByRole } = render(() => <Podium loading={true} />);

    // A live status region announces the in-flight fetch (AC-K5).
    expect(getByRole("status")).toBeTruthy();
  });

  it("fills gold, silver, and bronze from the three most-recent champions", () => {
    const recent = [
      champ({ name: "gold-king", generation: 5 }),
      champ({ name: "silver-king", generation: 4 }),
      champ({ name: "bronze-king", generation: 3 }),
    ];

    const { container } = render(() => <Podium recent={recent} />);

    // recent[0] → gold, recent[1] → silver, recent[2] → bronze (AC-P2).
    expect(stepOf(container, "gold")?.textContent).toContain("gold-king");
    expect(stepOf(container, "silver")?.textContent).toContain("silver-king");
    expect(stepOf(container, "bronze")?.textContent).toContain("bronze-king");

    // Rank is conveyed by text, not colour alone (AC-A2).
    expect(stepOf(container, "gold")?.textContent).toContain("Gold");
    expect(stepOf(container, "silver")?.textContent).toContain("Silver");
    expect(stepOf(container, "bronze")?.textContent).toContain("Bronze");
  });

  it("brands each podium champion with its model's logo", () => {
    const recent = [
      champ({ name: "gold-king", model: "gpt-4o" }),
      champ({ name: "silver-king", model: "gemini-2.5-pro" }),
    ];

    const { getByRole } = render(() => <Podium recent={recent} />);

    // Each filled step wears its champion's brand mark (AC-L3).
    expect(getByRole("img", { name: "authored by OpenAI" })).toBeTruthy();
    expect(getByRole("img", { name: "authored by Gemini" })).toBeTruthy();
  });

  it("dims the bronze step when only two champions exist, fabricating no third", () => {
    const recent = [
      champ({ name: "gold-king", generation: 2 }),
      champ({ name: "silver-king", generation: 1 }),
    ];

    const { container } = render(() => <Podium recent={recent} />);

    expect(stepOf(container, "gold")?.textContent).toContain("gold-king");
    expect(stepOf(container, "silver")?.textContent).toContain("silver-king");

    // Bronze is a dimmed placeholder — no fabricated champion (AC-P3).
    const bronze = stepOf(container, "bronze");

    expect(bronze?.classList.contains("podium-step-empty")).toBe(true);
    expect(bronze?.querySelector(".podium-name")).toBeNull();
  });

  it("dims silver and bronze when only one champion exists", () => {
    const { container } = render(() => (
      <Podium recent={[champ({ name: "lone-king", generation: 1 })]} />
    ));

    expect(stepOf(container, "gold")?.textContent).toContain("lone-king");
    expect(
      stepOf(container, "silver")?.classList.contains("podium-step-empty"),
    ).toBe(true);
    expect(
      stepOf(container, "bronze")?.classList.contains("podium-step-empty"),
    ).toBe(true);
  });

  it("renders an anchored honest empty state when no champions have been crowned", () => {
    const { container, getByText } = render(() => <Podium recent={[]} />);

    // Honest empty line — no fabricated podium steps (AC-P5, deviation D5).
    expect(getByText(/no champions have been crowned yet/i)).toBeTruthy();
    expect(container.querySelector(".podium-step")).toBeNull();

    // ...but the #champions anchor still exists so the nav link stays valid.
    expect(container.querySelector("#champions")).toBeTruthy();
  });

  it("shows the same name on multiple steps for a dethroned-then-re-crowned King", () => {
    const recent = [
      champ({ name: "comeback-king", generation: 4 }),
      champ({ name: "comeback-king", generation: 2 }),
    ];

    const { container, getAllByText } = render(() => (
      <Podium recent={recent} />
    ));

    // Both reigns render — duplicate names across generations are NOT deduped (AC-P6)...
    expect(getAllByText("comeback-king")).toHaveLength(2);

    // ...and they are distinguished by generation.
    expect(stepOf(container, "gold")?.textContent).toContain("Gen 4");
    expect(stepOf(container, "silver")?.textContent).toContain("Gen 2");
  });

  it("renders a hostile champion name as inert text, never as markup", () => {
    const hostile = "<script>alert(1)</script>";

    const { container, getByText } = render(() => (
      <Podium recent={[champ({ name: hostile })]} />
    ));

    // Shown as literal text (Solid auto-escapes)...
    expect(getByText(hostile)).toBeTruthy();
    // ...and no actual <script> element was injected (AC-C1).
    expect(container.querySelector("script")).toBeNull();
  });

  it("keeps a long name on one line with the full value in a title attribute", () => {
    const long = "K".repeat(64);

    const { getByText } = render(() => (
      <Podium recent={[champ({ name: long })]} />
    ));

    const nameEl = getByText(long);

    // Full value preserved for hover / assistive tech even when visually truncated (AC-C2).
    expect(nameEl.getAttribute("title")).toBe(long);
    expect(nameEl.classList.contains("podium-name")).toBe(true);
  });

  it("omits the model and handle lines when they are absent", () => {
    const { container, queryByText } = render(() => (
      <Podium
        recent={[champ({ name: "spartan", model: null, handle: null })]}
      />
    ));

    // No "null"/"undefined" leaks into the card.
    expect(queryByText(/null|undefined/)).toBeNull();
    expect(container.querySelector(".podium-model")).toBeNull();
    expect(container.querySelector(".podium-handle")).toBeNull();
  });

  it("shows a distinct error state whose Retry re-requests the succession", () => {
    const onRetry = vi.fn();

    const { getByText, getByRole } = render(() => (
      <Podium error={true} onRetry={onRetry} />
    ));

    // Distinct failure copy (AC-K3).
    expect(getByText(/couldn't reach the ring/i)).toBeTruthy();

    fireEvent.click(getByRole("button", { name: /retry/i }));

    // The Retry button drives the shared /king refetch owned by the parent (App).
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("never shows the empty-hall line on a fetch failure", () => {
    const { getByText, queryByText } = render(() => <Podium error={true} />);

    expect(getByText(/couldn't reach the ring/i)).toBeTruthy();
    expect(queryByText(/no champions have been crowned/i)).toBeNull();
  });

  it("is a labelled landmark region for the #champions anchor", () => {
    const { getByRole } = render(() => <Podium recent={[champ()]} />);

    const region = getByRole("region", { name: "Hall of Kings" });

    expect(region.id).toBe("champions");
  });
});
