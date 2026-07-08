import { fireEvent, render } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";

import SpecPage from "./SpecPage";

// A small but representative slice of the spec markdown: a top heading, a
// blockquote, a bullet list, a fenced code block, and a GFM table — the
// constructs the real /spec document is built from. The page must turn these
// into SEMANTIC HTML, never show them as raw markdown text.
const SPEC_FIXTURE = [
  "# Bot authoring spec",
  "",
  "> Do not edit by hand.",
  "",
  "- first item",
  "- second item",
  "",
  "```jsonc",
  '{ "version": 1 }',
  "```",
  "",
  "| technique | score |",
  "| --- | --- |",
  "| `sweep` | 0 |",
].join("\n");

// A fetcher that never settles — holds the resource in its loading state.
const pending = (): Promise<string> => new Promise<string>(() => {});

// A one-shot resolved fetcher for the given markdown.
const resolves =
  (markdown: string): (() => Promise<string>) =>
  () =>
    Promise.resolve(markdown);

// A fetcher that always rejects — drives the error state.
const rejects = (): (() => Promise<string>) => () =>
  Promise.reject(new Error("/spec unreachable"));

describe("SpecPage", () => {
  it("shows an accessible loading state while the spec is being fetched", () => {
    const { getByRole, getByText } = render(() => (
      <SpecPage fetchSpec={pending} />
    ));

    expect(getByRole("status")).toBeTruthy();
    // Distinctive copy so an emptied status region is still caught.
    expect(getByText(/loading the spec/i)).toBeTruthy();
  });

  it("renders the fetched markdown as a semantic HTML document", async () => {
    const { findByRole, getByRole, getAllByRole, container } = render(() => (
      <SpecPage fetchSpec={resolves(SPEC_FIXTURE)} />
    ));

    // The '# ' heading becomes a real <h1> (awaiting the async fetch)...
    expect(
      await findByRole("heading", { level: 1, name: /bot authoring spec/i }),
    ).toBeTruthy();

    // ...the pipe table becomes a real <table> with the technique cell...
    expect(getByRole("table")).toBeTruthy();
    expect(getByRole("cell", { name: "sweep" })).toBeTruthy();

    // ...the bullet list becomes <li>s...
    expect(getAllByRole("listitem")).toHaveLength(2);

    // ...and the fenced block becomes <pre><code>, not inline prose.
    const code = container.querySelector("pre code");

    expect(code?.textContent).toContain('"version": 1');

    const quote = container.querySelector("blockquote");

    expect(quote?.textContent).toContain("Do not edit by hand.");
  });

  it("never leaves the raw markdown syntax visible as text", async () => {
    const { findByRole, queryByText } = render(() => (
      <SpecPage fetchSpec={resolves(SPEC_FIXTURE)} />
    ));

    await findByRole("heading", { level: 1 });

    // The literal '# ...' / '| ... |' source lines must not survive rendering.
    expect(queryByText("# Bot authoring spec")).toBeNull();
    expect(queryByText(/^\| technique \| score \|/)).toBeNull();
  });

  it("keeps the shared site footer on the page", () => {
    const { getByText } = render(() => <SpecPage fetchSpec={pending} />);

    expect(getByText(/deterministic karate ring/i)).toBeTruthy();
  });

  it("shows a distinct error state with a working Retry when the fetch fails", async () => {
    // Fail the first fetch, succeed on the retry.
    let calls = 0;

    const flaky = (): Promise<string> => {
      calls += 1;

      return calls === 1
        ? Promise.reject(new Error("/spec unreachable"))
        : Promise.resolve(SPEC_FIXTURE);
    };

    const { findByRole, findByText } = render(() => (
      <SpecPage fetchSpec={flaky} />
    ));

    // A distinct, announced error region — not a blank page — with real copy.
    expect(await findByRole("alert")).toBeTruthy();
    expect(await findByText(/couldn't load the spec/i)).toBeTruthy();

    const retry = await findByRole("button", { name: /retry/i });

    fireEvent.click(retry);

    // The retry succeeds and the rendered document appears.
    expect(
      await findByRole("heading", { level: 1, name: /bot authoring spec/i }),
    ).toBeTruthy();
  });

  it("never shows the document content while the fetch is failing", async () => {
    const { findByRole, queryByRole } = render(() => (
      <SpecPage fetchSpec={rejects()} />
    ));

    await findByRole("alert");

    // The success content (the rendered heading) must be absent in the error state.
    expect(queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("heads the page with a brand that links home", () => {
    const { getByRole } = render(() => <SpecPage fetchSpec={pending} />);

    const brand = getByRole("link", { name: "ModelKombat" });

    expect(brand.getAttribute("href")).toBe("/");
  });

  it("offers the raw markdown for machine consumers, opening in a new tab", () => {
    const { getByRole } = render(() => <SpecPage fetchSpec={pending} />);

    const raw = getByRole("link", { name: /raw markdown/i });

    // The LLM/curl version stays reachable straight from the human page.
    expect(raw.getAttribute("href")).toBe("/spec");
    expect(raw.getAttribute("target")).toBe("_blank");
  });

  it("titles the browser tab after the spec", () => {
    render(() => <SpecPage fetchSpec={pending} />);

    expect(document.title).toBe("ModelKombat — Bot authoring spec");
  });

  it("gives every section heading its own slug id, so any section is deep-linkable", async () => {
    const sections =
      "## Frame table\n\nnumbers\n\n## What ModelKombat is\n\nprose\n\n## Limits (hard caps)\n\nx";

    const { findByRole, container } = render(() => (
      <SpecPage fetchSpec={resolves(sections)} />
    ));

    await findByRole("heading", { name: /hard caps/i });

    // Generic slugging — NOT a frame-table special case: distinct headings each
    // get their own derived id, so `#frame-table`, `#what-modelkombat-is`, etc. all work.
    expect(container.querySelector("h2#frame-table")).toBeTruthy();
    expect(container.querySelector("h2#what-modelkombat-is")).toBeTruthy();
    // Punctuation is stripped and spaces collapse to hyphens.
    expect(container.querySelector("h2#limits-hard-caps")).toBeTruthy();
  });

  it("disambiguates repeated headings so ids stay unique", async () => {
    const dupes = "## Frame table\n\nfirst\n\n## Frame table\n\nsecond";

    const { findAllByRole, container } = render(() => (
      <SpecPage fetchSpec={resolves(dupes)} />
    ));

    const headings = await findAllByRole("heading", { name: "Frame table" });

    expect(headings).toHaveLength(2);
    // The first keeps the clean slug; the second is suffixed — both ids exist.
    expect(container.querySelector("#frame-table")).toBeTruthy();
    expect(container.querySelector("#frame-table-1")).toBeTruthy();
  });

  it("scrolls the hash-named section into view once the content has rendered", async () => {
    const spy = vi
      .spyOn(Element.prototype, "scrollIntoView")
      .mockImplementation(() => {});

    const original = window.location.hash;

    window.history.replaceState(null, "", "#frame-table");

    try {
      const { findByRole } = render(() => (
        <SpecPage fetchSpec={resolves("## Frame table\n\nnumbers")} />
      ));

      await findByRole("heading", { name: /frame table/i });

      // The fetched content arrives async, so the browser's native hash-scroll
      // can't work — the page scrolls the target itself, once it exists.
      expect(spy).toHaveBeenCalled();

      const scrolledTo = spy.mock.contexts as unknown as readonly Element[];

      expect(scrolledTo.some((el) => el?.id === "frame-table")).toBe(true);
    } finally {
      window.history.replaceState(
        null,
        "",
        window.location.pathname + original,
      );
      spy.mockRestore();
    }
  });

  it("does not scroll when the URL names no section", async () => {
    const spy = vi
      .spyOn(Element.prototype, "scrollIntoView")
      .mockImplementation(() => {});

    const original = window.location.hash;

    window.history.replaceState(null, "", window.location.pathname);

    try {
      const { findByRole } = render(() => (
        <SpecPage fetchSpec={resolves("## Frame table\n\nnumbers")} />
      ));

      await findByRole("heading", { name: /frame table/i });

      expect(spy).not.toHaveBeenCalled();
    } finally {
      window.history.replaceState(
        null,
        "",
        window.location.pathname + original,
      );
      spy.mockRestore();
    }
  });
});
