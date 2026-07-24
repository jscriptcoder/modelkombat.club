import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import SpecPage from "./SpecPage";

// A small but representative slice of the spec markdown: a top heading, a
// blockquote, a bullet list, a fenced code block, and a GFM table — the
// constructs the real /spec document is built from. The page must turn these
// into SEMANTIC HTML, never show them as raw markdown text.
//
// The page is now PURELY PRESENTATIONAL: it is handed the spec markdown as a
// prop and renders it synchronously (the build-time prerender passes in
// `generateSpec()`). There is no fetch, no loading/error state, and no client
// JS — so these render straight through with no async waiting.
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

describe("SpecPage", () => {
  it("renders the given spec markdown as a semantic HTML document", () => {
    const { getByRole, getAllByRole, container } = render(() => (
      <SpecPage spec={SPEC_FIXTURE} />
    ));

    // The '# ' heading becomes a real <h1>...
    expect(
      getByRole("heading", { level: 1, name: /bot authoring spec/i }),
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

  it("never leaves the raw markdown syntax visible as text", () => {
    const { queryByText } = render(() => <SpecPage spec={SPEC_FIXTURE} />);

    // The literal '# ...' / '| ... |' source lines must not survive rendering.
    expect(queryByText("# Bot authoring spec")).toBeNull();
    expect(queryByText(/^\| technique \| score \|/)).toBeNull();
  });

  it("is a bare document — no nav header and no footer, just the spec to read and close", () => {
    const { container, queryByRole, queryByText } = render(() => (
      <SpecPage spec={SPEC_FIXTURE} />
    ));

    // No nav header: no brand link home, no raw-markdown escape hatch.
    expect(container.querySelector("nav")).toBeNull();
    expect(queryByRole("link", { name: "ModelKombat" })).toBeNull();
    expect(queryByRole("link", { name: /raw markdown/i })).toBeNull();
    // No shared site footer either.
    expect(container.querySelector("footer")).toBeNull();
    expect(queryByText(/Author:/i)).toBeNull();
  });

  it("gives every section heading its own slug id, so any section is deep-linkable", () => {
    const sections =
      "## Frame table\n\nnumbers\n\n## What ModelKombat is\n\nprose\n\n## Limits (hard caps)\n\nx";

    const { container } = render(() => <SpecPage spec={sections} />);

    // Generic slugging — NOT a frame-table special case: distinct headings each
    // get their own derived id, so `#frame-table`, `#what-modelkombat-is`, etc. all work.
    expect(container.querySelector("h2#frame-table")).toBeTruthy();
    expect(container.querySelector("h2#what-modelkombat-is")).toBeTruthy();
    // Punctuation is stripped and spaces collapse to hyphens.
    expect(container.querySelector("h2#limits-hard-caps")).toBeTruthy();
  });

  it("disambiguates repeated headings so ids stay unique", () => {
    const dupes = "## Frame table\n\nfirst\n\n## Frame table\n\nsecond";

    const { getAllByRole, container } = render(() => <SpecPage spec={dupes} />);

    expect(getAllByRole("heading", { name: "Frame table" })).toHaveLength(2);
    // The first keeps the clean slug; the second is suffixed — both ids exist.
    expect(container.querySelector("#frame-table")).toBeTruthy();
    expect(container.querySelector("#frame-table-1")).toBeTruthy();
  });
});
