import { render, within } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import App from "./App";

const isDark = (color: string): boolean => {
  const channels = color.match(/\d+/g)?.map(Number) ?? [];
  const [r, g, b] = channels;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance < 0.35;
};

describe("App (landing page)", () => {
  it("names the site in the top-level heading", () => {
    const { getByRole } = render(() => <App />);

    expect(
      getByRole("heading", { level: 1, name: "ModelKombat" }),
    ).toBeTruthy();
  });

  it("links to the bot spec at exactly /spec", () => {
    const { getByRole } = render(() => <App />);

    const specLink = getByRole("link", { name: /spec/i });

    expect(specLink.getAttribute("href")).toBe("/spec");
  });

  it("sets a descriptive document title naming ModelKombat", () => {
    render(() => <App />);

    expect(document.title).toMatch(/ModelKombat/);
  });

  it("sets a meta description naming ModelKombat", () => {
    render(() => <App />);

    const description = document
      .querySelector('meta[name="description"]')
      ?.getAttribute("content");

    expect(description).toMatch(/ModelKombat/i);
  });

  it("paints an opaque dark background (dark theme)", () => {
    render(() => <App />);

    const background = getComputedStyle(document.body).backgroundColor;

    // Default (unstyled) body reports the transparent "rgba(0, 0, 0, 0)";
    // an applied opaque colour reports "rgb(...)".
    expect(background).toMatch(/^rgb\(/);
    expect(isDark(background)).toBe(true);
  });

  it("explains the game in exactly four ordered steps", () => {
    const { getByRole } = render(() => <App />);

    const section = getByRole("region", { name: "How it works" });

    // The id is the in-page anchor target the nav will link to (Slice 1c).
    expect(section.id).toBe("how-it-works");

    const stepTitles = within(section)
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);

    expect(stepTitles).toEqual([
      "Read the spec",
      "Write a JSON bot",
      "Clear the gauntlet",
      "Challenge the King",
    ]);
  });

  it("gives a prominent 'Read the spec' call to action to /spec", () => {
    const { getByRole } = render(() => <App />);

    const cta = getByRole("link", { name: "Read the spec" });

    expect(cta.getAttribute("href")).toBe("/spec");
  });

  it("shows a runnable POST /fight snippet", () => {
    const { container } = render(() => <App />);

    const snippet = container.querySelector("pre");

    if (!(snippet instanceof HTMLElement)) {
      throw new Error("expected a <pre> code snippet on the page");
    }

    const text = snippet.textContent ?? "";

    expect(text).toContain("POST");
    expect(text).toContain("https://modelkombat.club/fight");
    expect(text).toContain("X-Author-Handle");
  });
});
