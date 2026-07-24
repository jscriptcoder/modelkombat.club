import { fireEvent, render } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";

import ReplayList from "./ReplayList";
import type { ReplayListLoad } from "./replay-loader";
import type { Fighter, ReplaySummary } from "./replay-contract";

// Per-test factories (no shared state): a fighter identity and a list summary. Overrides let each
// test pin exactly the identities / id it asserts on.
const fighter = (overrides: Partial<Fighter> = {}): Fighter => ({
  name: "challenger",
  model: "claude",
  ...overrides,
});

const summary = (overrides: Partial<ReplaySummary> = {}): ReplaySummary => ({
  id: "abc123",
  fighters: [fighter(), fighter({ name: "king" })],
  ...overrides,
});

const ready = (items: ReplaySummary[]) => (): Promise<ReplayListLoad> =>
  Promise.resolve({ kind: "ready", items });

describe("ReplayList — the /watch fight index", () => {
  it("shows an accessible loading state while the list is being fetched", () => {
    // A loader that never settles holds the view in its loading state.
    const load = () => new Promise<ReplayListLoad>(() => {});

    const { getByRole } = render(() => <ReplayList load={load} />);

    expect(getByRole("status")).toBeTruthy();
  });

  it("renders one card per fight, newest-first, each linking to that fight's permalink", async () => {
    const load = ready([
      summary({
        id: "newest",
        fighters: [fighter({ name: "aki" }), fighter({ name: "rex" })],
      }),
      summary({
        id: "older",
        fighters: [fighter({ name: "juno" }), fighter({ name: "rex" })],
      }),
    ]);

    const { findAllByRole } = render(() => <ReplayList load={load} />);

    const cards = await findAllByRole("link");

    // Two cards, in the list's newest-first order, each an <a href="/watch/{id}"> permalink.
    expect(cards.map((card) => card.getAttribute("href"))).toEqual([
      "/watch/newest",
      "/watch/older",
    ]);
    // The newest card carries both identities, challenger (fighters[0]) before King (fighters[1]).
    const text = cards[0]?.textContent ?? "";

    expect(text).toContain("aki");
    expect(text.indexOf("aki")).toBeLessThan(text.indexOf("rex"));
  });

  it("shows both a fighter's name and model when the model is present", async () => {
    const load = ready([
      summary({
        fighters: [
          fighter({ name: "aki", model: "claude-opus" }),
          fighter({ name: "rex", model: "gpt" }),
        ],
      }),
    ]);

    const { findByText, getByText } = render(() => <ReplayList load={load} />);

    expect(await findByText("aki")).toBeTruthy();
    expect(getByText("claude-opus")).toBeTruthy();
    expect(getByText("rex")).toBeTruthy();
    expect(getByText("gpt")).toBeTruthy();
  });

  it("flanks each fighter with its model's brand mark — left fighter's on the left, right fighter's on the right", async () => {
    const load = ready([
      summary({
        fighters: [
          fighter({ name: "aki", model: "claude-opus" }),
          fighter({ name: "rex", model: "gpt" }),
        ],
      }),
    ]);

    const { findByRole } = render(() => <ReplayList load={load} />);

    const card = await findByRole("link");

    // In document order the card reads: challenger's mark → challenger → King → King's mark, so
    // the Claude mark sits to the LEFT of "aki" and the OpenAI mark to the RIGHT of "rex".
    const sequence = [
      ...card.querySelectorAll(".brand-mark, .replay-card-name"),
    ].map((el) =>
      el.classList.contains("brand-mark")
        ? `brand:${el.getAttribute("data-brand")}`
        : `name:${el.textContent}`,
    );

    expect(sequence).toEqual([
      "brand:claude",
      "name:aki",
      "name:rex",
      "brand:openai",
    ]);
  });

  it("renders name-only for a fighter with no model, and no empty brand chip", async () => {
    const load = ready([
      summary({
        fighters: [
          fighter({ name: "solo", model: "" }),
          fighter({ name: "king", model: "gpt" }),
        ],
      }),
    ]);

    const { container, findByText, getByText } = render(() => (
      <ReplayList load={load} />
    ));

    // The un-branded fighter shows its name; the branded one still shows its model...
    expect(await findByText("solo")).toBeTruthy();
    expect(getByText("gpt")).toBeTruthy();
    // ...and exactly one model chip renders (the King's) — the empty model produces no chip.
    expect(container.querySelectorAll(".replay-card-model")).toHaveLength(1);
  });

  it("truncates a long name with the full value in a title tooltip", async () => {
    const longName = "a-really-long-fighter-name-that-overflows-the-card";

    const load = ready([
      summary({
        fighters: [fighter({ name: longName }), fighter({ name: "king" })],
      }),
    ]);

    const { findByText } = render(() => <ReplayList load={load} />);

    const nameEl = await findByText(longName);

    // The full name is preserved in a `title` so a CSS-truncated card is still readable on hover.
    expect(nameEl.getAttribute("title")).toBe(longName);
  });

  it("shows an empty state linking to /ring when the archive is empty", async () => {
    const load = () => Promise.resolve<ReplayListLoad>({ kind: "empty" });

    const { findByText, getByRole } = render(() => <ReplayList load={load} />);

    expect(await findByText(/no fights to watch yet/i)).toBeTruthy();
    expect(
      getByRole("link", { name: /send a bot into the ring/i }).getAttribute(
        "href",
      ),
    ).toBe("/ring");
  });

  it("shows a retryable error whose Retry re-runs the load and then renders the list", async () => {
    const load = vi
      .fn<() => Promise<ReplayListLoad>>()
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce({
        kind: "ready",
        items: [summary({ id: "back" })],
      });

    const { findByRole, findByText } = render(() => <ReplayList load={load} />);

    // First load fails → a distinct error with Retry (never the empty CTA).
    expect(await findByText(/couldn't load the fights/i)).toBeTruthy();

    fireEvent.click(await findByRole("button", { name: /retry/i }));

    // Retry re-runs the load and the card list then renders.
    expect((await findByRole("link")).getAttribute("href")).toBe("/watch/back");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("never shows the empty CTA on a load failure", async () => {
    const load = () => Promise.reject<ReplayListLoad>(new Error("down"));

    const { findByText, queryByText } = render(() => (
      <ReplayList load={load} />
    ));

    expect(await findByText(/couldn't load the fights/i)).toBeTruthy();
    expect(queryByText(/no fights to watch yet/i)).toBeNull();
  });

  it("shows a 6-char id fragment only on cards whose challenger↔King name pair repeats", async () => {
    // Two "aki vs rex" fights (indistinguishable by name) and one unique "juno vs rex" between them.
    const load = ready([
      summary({
        id: "abcdef01",
        fighters: [fighter({ name: "aki" }), fighter({ name: "rex" })],
      }),
      summary({
        id: "99887766",
        fighters: [fighter({ name: "juno" }), fighter({ name: "rex" })],
      }),
      summary({
        id: "123456ff",
        fighters: [fighter({ name: "aki" }), fighter({ name: "rex" })],
      }),
    ]);

    const { findAllByRole, container } = render(() => (
      <ReplayList load={load} />
    ));

    await findAllByRole("link");

    // Exactly two chips render — one per colliding card — each the 6-char prefix of its own id,
    // in card order. The unique middle card carries none.
    const chips = container.querySelectorAll(".replay-card-id");

    expect(Array.from(chips, (chip) => chip.textContent)).toEqual([
      "abcdef",
      "123456",
    ]);
  });
});
