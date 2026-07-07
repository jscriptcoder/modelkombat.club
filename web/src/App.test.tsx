import { render } from "@solidjs/testing-library";
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
});
