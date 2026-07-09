import { fireEvent, render } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";

import King, { type Champion } from "./King";

// A resolved champion. Overrides let a test null out `model`/`handle` or inject a
// hostile `name` without restating the whole identity shape.
const champion = (overrides?: Partial<Champion>): Champion => ({
  name: "reigning-king",
  model: "claude-opus-4-8",
  handle: "grandmaster",
  generation: 3,
  ...overrides,
});

describe("King section", () => {
  it("shows an accessible loading state while the throne is being fetched", () => {
    const { getByRole } = render(() => <King loading={true} />);

    // A live status region announces the in-flight fetch (AC-K5).
    expect(getByRole("status")).toBeTruthy();
  });

  it("shows the reigning champion's name, model, and generation", () => {
    const { getByText } = render(() => <King current={champion()} />);

    expect(getByText("reigning-king")).toBeTruthy();
    expect(getByText("claude-opus-4-8")).toBeTruthy();
    expect(getByText(/Gen\s*3/)).toBeTruthy();
  });

  it("brands the reigning champion with its model's logo", () => {
    const { getByRole } = render(() => (
      <King current={champion({ model: "gpt-4o" })} />
    ));

    // The card head is the model's brand mark, not a generic placeholder (AC-L3).
    expect(getByRole("img", { name: "authored by OpenAI" })).toBeTruthy();
  });

  it("renders a hostile champion name as inert text, never as markup", () => {
    const hostile = "<script>alert(1)</script>";

    const { getByText, container } = render(() => (
      <King current={champion({ name: hostile })} />
    ));

    // The literal string is shown as text (Solid auto-escapes)...
    expect(getByText(hostile)).toBeTruthy();
    // ...and no actual <script> element was injected into the DOM.
    expect(container.querySelector("script")).toBeNull();
  });

  it("omits the model label and handle byline when they are absent", () => {
    const { getByText, getByRole, queryByText } = render(() => (
      <King current={champion({ model: null, handle: null })} />
    ));

    // The name still anchors the card...
    expect(getByText("reigning-king")).toBeTruthy();
    // ...an absent model falls back to the generic mystery-challenger mark (AC-C4)...
    expect(getByRole("img", { name: /mystery challenger/i })).toBeTruthy();
    // ...but no "null"/"undefined" leaks, and the handle byline is gone.
    expect(queryByText(/null|undefined/)).toBeNull();
    expect(queryByText(/grandmaster/)).toBeNull();
  });

  it("invites the first challenger when the throne is empty", () => {
    const { getByText } = render(() => <King current={null} />);

    expect(getByText(/throne awaits/i)).toBeTruthy();
  });

  it("shows a distinct error state whose Retry re-requests the throne", () => {
    const onRetry = vi.fn();

    const { getByText, getByRole } = render(() => (
      <King error={true} onRetry={onRetry} />
    ));

    // Distinct failure copy — NOT the empty-throne CTA.
    expect(getByText(/couldn't reach the ring/i)).toBeTruthy();

    fireEvent.click(getByRole("button", { name: /retry/i }));

    // The Retry button drives the shared /king refetch owned by the parent (App).
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("never shows the empty-throne CTA on a fetch failure", () => {
    const { getByText, queryByText } = render(() => <King error={true} />);

    expect(getByText(/couldn't reach the ring/i)).toBeTruthy();
    expect(queryByText(/throne awaits/i)).toBeNull();
  });
});
