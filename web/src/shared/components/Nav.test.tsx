import { render, within } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import Nav from "./Nav";
import { VARIETY_PATH } from "../lib/paths";

describe("Nav", () => {
  it("brands the header with the site name linking back to the home page top", () => {
    const { getByRole } = render(() => <Nav />);

    const brand = getByRole("link", { name: "ModelKombat" });

    // Absolute (`/#top`, not `#top`) so the brand is a way HOME from /ring — a separate page —
    // as much as a scroll-to-top on the home page itself.
    expect(brand.getAttribute("href")).toBe("/#top");
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

  it("points every nav link home absolutely so the same nav works from any page", () => {
    const { getByRole } = render(() => <Nav />);

    const hrefs = within(getByRole("navigation"))
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));

    // In-page section anchors are absolute `/#section` (not bare `#section`) so the shared nav
    // resolves from /ring — a full, separate page — exactly as it does on the home page. `/ring`
    // and `/spec-guide` are already real paths, so they're unchanged.
    expect(hrefs).toEqual([
      "/#top",
      "/#how-it-works",
      "/#arsenal",
      "/#gauntlet",
      "/#king",
      "/#champions",
      "/#fights",
      "/ring",
      "/spec-guide",
    ]);
  });

  it("marks no link as the current page by default (the home nav)", () => {
    const { getByRole } = render(() => <Nav />);

    // On the home page nothing is the "current page" — the sections are in-page anchors.
    expect(
      getByRole("link", { name: "Ring" }).getAttribute("aria-current"),
    ).toBe(null);
  });

  it("marks the Ring link as the current page when told it is on /ring", () => {
    const { getByRole } = render(() => <Nav current="ring" />);

    // Rendered on /ring, the shared header names where the visitor is (aria-current), so it isn't
    // ambiguous about which page is active.
    expect(
      getByRole("link", { name: "Ring" }).getAttribute("aria-current"),
    ).toBe("page");
  });

  it("keeps the move-variety board out of the primary nav (a caveated diagnostic, not a primary destination)", () => {
    const { getByRole } = render(() => <Nav />);

    const hrefs = within(getByRole("navigation"))
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));

    // /variety is deliberately NOT top-level site IA — its discoverability is sitemap +
    // llms.txt + the Arsenal hand-off, so a reference-population diagnostic never reads as
    // a first-class destination. This absence is a decision, asserted as one.
    expect(hrefs).not.toContain(VARIETY_PATH);
  });
});
