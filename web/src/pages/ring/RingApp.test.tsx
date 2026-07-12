import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import RingApp from "./RingApp";

// /ring is a full, standalone page (its own HTML entry), but it must feel part of the site: the
// shared header (nav) and footer wrap the submit surface so a visitor is never stranded on a page
// with no way back. Mirrors App — the home-page shell — for the ring page.
describe("RingApp (the /ring page shell)", () => {
  it("wraps the ring submit surface in the shared site nav and footer", () => {
    const { getByRole } = render(() => <RingApp />);

    // The three landmarks of the page: the primary nav, the submit surface, and the footer.
    expect(getByRole("navigation")).toBeTruthy();
    expect(getByRole("button", { name: /send into the ring/i })).toBeTruthy();
    expect(getByRole("contentinfo").textContent).toContain("ModelKombat");
  });

  it("gives the visitor a way back home via the site brand", () => {
    const { getByRole } = render(() => <RingApp />);

    // The brand doubles as the way OUT of /ring: an absolute link to the home page top (absolute
    // because /ring is a separate page, not an in-page anchor).
    expect(
      getByRole("link", { name: "ModelKombat" }).getAttribute("href"),
    ).toBe("/#top");
  });

  it("marks the Ring nav link as the current page", () => {
    const { getByRole } = render(() => <RingApp />);

    expect(
      getByRole("link", { name: "Ring" }).getAttribute("aria-current"),
    ).toBe("page");
  });

  it("orders the page header before the submit surface before the footer", () => {
    const { getByRole } = render(() => <RingApp />);

    const nav = getByRole("navigation");

    const heading = getByRole("heading", {
      name: /send your bot into the ring/i,
    });

    const footer = getByRole("contentinfo");

    // Header precedes the content...
    expect(
      nav.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // ...which precedes the footer.
    expect(
      heading.compareDocumentPosition(footer) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
