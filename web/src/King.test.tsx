import { fireEvent, render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import King, { type Champion, type KingView } from "./King";

// A resolved King view. Overrides let a test null out `model`/`handle` or inject a
// hostile `name` without restating the whole shape.
const kingView = (overrides?: Partial<Champion>): KingView => ({
  current: {
    name: "reigning-king",
    model: "claude-opus-4-8",
    handle: "grandmaster",
    generation: 3,
    ...overrides,
  },
});

// A fetcher that never settles — holds the resource in its loading state.
const pending = (): Promise<KingView> => new Promise<KingView>(() => {});

// A one-shot resolved/ rejected fetcher.
const resolves =
  (view: KingView): (() => Promise<KingView>) =>
  () =>
    Promise.resolve(view);

const rejects = (): (() => Promise<KingView>) => () =>
  Promise.reject(new Error("throne store unreachable"));

describe("King section", () => {
  it("shows an accessible loading state while the throne is being fetched", () => {
    const { getByRole } = render(() => <King fetchKing={pending} />);

    // A live status region announces the in-flight fetch (AC-K5).
    expect(getByRole("status")).toBeTruthy();
  });

  it("shows the reigning champion's name, model, and generation once loaded", async () => {
    const { findByText } = render(() => (
      <King fetchKing={resolves(kingView())} />
    ));

    expect(await findByText("reigning-king")).toBeTruthy();
    expect(await findByText("claude-opus-4-8")).toBeTruthy();
    expect(await findByText(/Gen\s*3/)).toBeTruthy();
  });

  it("renders a hostile champion name as inert text, never as markup", async () => {
    const hostile = "<script>alert(1)</script>";

    const { findByText, container } = render(() => (
      <King fetchKing={resolves(kingView({ name: hostile }))} />
    ));

    // The literal string is shown as text (Solid auto-escapes)...
    expect(await findByText(hostile)).toBeTruthy();
    // ...and no actual <script> element was injected into the DOM.
    expect(container.querySelector("script")).toBeNull();
  });

  it("omits the model label and handle byline when they are absent", async () => {
    const { findByText, queryByText } = render(() => (
      <King fetchKing={resolves(kingView({ model: null, handle: null }))} />
    ));

    // The name still anchors the card...
    expect(await findByText("reigning-king")).toBeTruthy();
    // ...but no "null"/"undefined" leaks, and the handle byline is gone.
    expect(queryByText(/null|undefined/)).toBeNull();
    expect(queryByText(/grandmaster/)).toBeNull();
  });

  it("invites the first challenger when the throne is empty", async () => {
    const { findByText, getByRole } = render(() => (
      <King fetchKing={resolves({ current: null })} />
    ));

    expect(await findByText(/throne awaits/i)).toBeTruthy();

    // The empty state links onward to the spec so a newcomer can enter.
    const specLink = getByRole("link", { name: /spec/i });

    expect(specLink.getAttribute("href")).toBe("/spec");
  });

  it("shows a distinct error state with a working Retry when the fetch fails", async () => {
    // Fail the first fetch, succeed on the retry.
    let calls = 0;

    const flaky = (): Promise<KingView> => {
      calls += 1;

      return calls === 1
        ? Promise.reject(new Error("throne store unreachable"))
        : Promise.resolve(kingView());
    };

    const { findByText, findByRole } = render(() => <King fetchKing={flaky} />);

    // Distinct failure copy — NOT the empty-throne CTA.
    expect(await findByText(/couldn't reach the ring/i)).toBeTruthy();

    const retry = await findByRole("button", { name: /retry/i });

    fireEvent.click(retry);

    // The retry succeeds and the King appears.
    expect(await findByText("reigning-king")).toBeTruthy();
  });

  it("never shows the empty-throne CTA on a fetch failure", async () => {
    const { findByText, queryByText } = render(() => (
      <King fetchKing={rejects()} />
    ));

    expect(await findByText(/couldn't reach the ring/i)).toBeTruthy();
    expect(queryByText(/throne awaits/i)).toBeNull();
  });
});
