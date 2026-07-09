import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import Nav from "./Nav";

describe("Nav", () => {
  it("brands the header with the site name linking back to the top", () => {
    const { getByRole } = render(() => <Nav />);

    const brand = getByRole("link", { name: "ModelKombat" });

    expect(brand.getAttribute("href")).toBe("#top");
  });

  it("badges the brand with a decorative logo mark that leaves the link name clean", () => {
    const { getByRole } = render(() => <Nav />);

    // The wordmark already names the link, so the mark is presentational: it must be
    // hidden from assistive tech (both so the accessible name stays exactly
    // "ModelKombat" — getByRole matches it exactly above — and by an explicit flag).
    const brand = getByRole("link", { name: "ModelKombat" });
    const logo = brand.querySelector(".nav-logo");

    if (!(logo instanceof SVGElement)) {
      throw new Error("expected a .nav-logo SVG inside the brand link");
    }

    expect(logo.getAttribute("aria-hidden")).toBe("true");
  });

  it("links Spec to the rendered spec page, opening it in a new tab", () => {
    const { getByRole } = render(() => <Nav />);

    const spec = getByRole("link", { name: /spec/i });

    // The human-readable rendered page, not the raw /spec markdown endpoint.
    expect(spec.getAttribute("href")).toBe("/spec-guide");
    expect(spec.getAttribute("target")).toBe("_blank");
  });

  it("links Ring to the submit page in the same tab", () => {
    const { getByRole } = render(() => <Nav />);

    const ring = getByRole("link", { name: "Ring" });

    // /ring is a primary site destination (its own full page) — navigated in the same
    // tab, unlike the raw-markdown Spec link which opens a new tab.
    expect(ring.getAttribute("href")).toBe("/ring");
    expect(ring.getAttribute("target")).toBe(null);
  });
});
