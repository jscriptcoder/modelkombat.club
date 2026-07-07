import { fireEvent, render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

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

// A fetcher that never settles — holds the resource in its loading state.
const pending = (): Promise<Champion[]> => new Promise<Champion[]>(() => {});

// One-shot resolved / rejected fetchers over the recent-succession array.
const resolves =
  (recent: Champion[]): (() => Promise<Champion[]>) =>
  () =>
    Promise.resolve(recent);

const rejects = (): (() => Promise<Champion[]>) => () =>
  Promise.reject(new Error("throne store unreachable"));

const stepOf = (container: HTMLElement, rank: string): Element | null =>
  container.querySelector(`.podium-step.${rank}`);

describe("Hall of Kings podium", () => {
  it("shows an accessible loading state while the succession is being fetched", () => {
    const { getByRole } = render(() => <Podium fetchRecent={pending} />);

    // A live status region announces the in-flight fetch (AC-K5).
    expect(getByRole("status")).toBeTruthy();
  });

  it("fills gold, silver, and bronze from the three most-recent champions", async () => {
    const recent = [
      champ({ name: "gold-king", generation: 5 }),
      champ({ name: "silver-king", generation: 4 }),
      champ({ name: "bronze-king", generation: 3 }),
    ];

    const { container, findByText } = render(() => (
      <Podium fetchRecent={resolves(recent)} />
    ));

    await findByText("gold-king");

    // recent[0] → gold, recent[1] → silver, recent[2] → bronze (AC-P2).
    expect(stepOf(container, "gold")?.textContent).toContain("gold-king");
    expect(stepOf(container, "silver")?.textContent).toContain("silver-king");
    expect(stepOf(container, "bronze")?.textContent).toContain("bronze-king");

    // Rank is conveyed by text, not colour alone (AC-A2).
    expect(stepOf(container, "gold")?.textContent).toContain("Gold");
    expect(stepOf(container, "silver")?.textContent).toContain("Silver");
    expect(stepOf(container, "bronze")?.textContent).toContain("Bronze");
  });

  it("dims the bronze step when only two champions exist, fabricating no third", async () => {
    const recent = [
      champ({ name: "gold-king", generation: 2 }),
      champ({ name: "silver-king", generation: 1 }),
    ];

    const { container, findByText } = render(() => (
      <Podium fetchRecent={resolves(recent)} />
    ));

    await findByText("gold-king");

    expect(stepOf(container, "gold")?.textContent).toContain("gold-king");
    expect(stepOf(container, "silver")?.textContent).toContain("silver-king");

    // Bronze is a dimmed placeholder — no fabricated champion (AC-P3).
    const bronze = stepOf(container, "bronze");

    expect(bronze?.classList.contains("podium-step-empty")).toBe(true);
    expect(bronze?.querySelector(".podium-name")).toBeNull();
  });

  it("dims silver and bronze when only one champion exists", async () => {
    const { container, findByText } = render(() => (
      <Podium
        fetchRecent={resolves([champ({ name: "lone-king", generation: 1 })])}
      />
    ));

    await findByText("lone-king");

    expect(stepOf(container, "gold")?.textContent).toContain("lone-king");
    expect(
      stepOf(container, "silver")?.classList.contains("podium-step-empty"),
    ).toBe(true);
    expect(
      stepOf(container, "bronze")?.classList.contains("podium-step-empty"),
    ).toBe(true);
  });

  it("renders an anchored honest empty state when no champions have been crowned", async () => {
    const { container, findByText } = render(() => (
      <Podium fetchRecent={resolves([])} />
    ));

    // Honest empty line — no fabricated podium steps (AC-P5, deviation D5).
    expect(
      await findByText(/no champions have been crowned yet/i),
    ).toBeTruthy();
    expect(container.querySelector(".podium-step")).toBeNull();

    // ...but the #champions anchor still exists so the nav link stays valid.
    expect(container.querySelector("#champions")).toBeTruthy();
  });

  it("shows the same name on multiple steps for a dethroned-then-re-crowned King", async () => {
    const recent = [
      champ({ name: "comeback-king", generation: 4 }),
      champ({ name: "comeback-king", generation: 2 }),
    ];

    const { container, findAllByText } = render(() => (
      <Podium fetchRecent={resolves(recent)} />
    ));

    // Both reigns render — duplicate names across generations are NOT deduped (AC-P6)...
    const names = await findAllByText("comeback-king");

    expect(names).toHaveLength(2);

    // ...and they are distinguished by generation.
    expect(stepOf(container, "gold")?.textContent).toContain("Gen 4");
    expect(stepOf(container, "silver")?.textContent).toContain("Gen 2");
  });

  it("renders a hostile champion name as inert text, never as markup", async () => {
    const hostile = "<script>alert(1)</script>";

    const { container, findByText } = render(() => (
      <Podium fetchRecent={resolves([champ({ name: hostile })])} />
    ));

    // Shown as literal text (Solid auto-escapes)...
    expect(await findByText(hostile)).toBeTruthy();
    // ...and no actual <script> element was injected (AC-C1).
    expect(container.querySelector("script")).toBeNull();
  });

  it("keeps a long name on one line with the full value in a title attribute", async () => {
    const long = "K".repeat(64);

    const { findByText } = render(() => (
      <Podium fetchRecent={resolves([champ({ name: long })])} />
    ));

    const nameEl = await findByText(long);

    // Full value preserved for hover / assistive tech even when visually truncated (AC-C2).
    expect(nameEl.getAttribute("title")).toBe(long);
    expect(nameEl.classList.contains("podium-name")).toBe(true);
  });

  it("omits the model and handle lines when they are absent", async () => {
    const { container, findByText, queryByText } = render(() => (
      <Podium
        fetchRecent={resolves([
          champ({ name: "spartan", model: null, handle: null }),
        ])}
      />
    ));

    await findByText("spartan");

    // No "null"/"undefined" leaks into the card.
    expect(queryByText(/null|undefined/)).toBeNull();
    expect(container.querySelector(".podium-model")).toBeNull();
    expect(container.querySelector(".podium-handle")).toBeNull();
  });

  it("shows a distinct error state with a working Retry when the fetch fails", async () => {
    // Fail the first fetch, succeed on the retry.
    let calls = 0;

    const flaky = (): Promise<Champion[]> => {
      calls += 1;

      return calls === 1
        ? Promise.reject(new Error("throne store unreachable"))
        : Promise.resolve([champ({ name: "recovered-king" })]);
    };

    const { findByText, findByRole } = render(() => (
      <Podium fetchRecent={flaky} />
    ));

    // Distinct failure copy (AC-K3).
    expect(await findByText(/couldn't reach the ring/i)).toBeTruthy();

    const retry = await findByRole("button", { name: /retry/i });

    fireEvent.click(retry);

    // The retry succeeds and the podium appears.
    expect(await findByText("recovered-king")).toBeTruthy();
  });

  it("never shows the empty-hall line on a fetch failure", async () => {
    const { findByText, queryByText } = render(() => (
      <Podium fetchRecent={rejects()} />
    ));

    expect(await findByText(/couldn't reach the ring/i)).toBeTruthy();
    expect(queryByText(/no champions have been crowned/i)).toBeNull();
  });

  it("is a labelled landmark region for the #champions anchor", async () => {
    const { getByRole, findByText } = render(() => (
      <Podium fetchRecent={resolves([champ()])} />
    ));

    await findByText("champion");

    const region = getByRole("region", { name: "Hall of Kings" });

    expect(region.id).toBe("champions");
  });
});
