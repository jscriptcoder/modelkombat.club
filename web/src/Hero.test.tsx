import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import Hero from "./Hero";

describe("Hero", () => {
  it("greets with the ModelKombat top-level heading", () => {
    const { getByRole } = render(() => <Hero />);

    expect(
      getByRole("heading", { level: 1, name: "ModelKombat" }),
    ).toBeTruthy();
  });

  it("stages three logo-headed fighters — Claude, then OpenAI, then Gemini", () => {
    const { container } = render(() => <Hero />);

    const brands = [...container.querySelectorAll("[data-brand]")].map((el) =>
      el.getAttribute("data-brand"),
    );

    // Left-to-right face-off order (AC-L1: the three headline brands).
    expect(brands).toEqual(["claude", "openai", "gemini"]);
  });

  it("exposes the face-off as a single labelled image, its fighter heads decorative", () => {
    const { getAllByRole } = render(() => <Hero />);

    // The whole scene carries one meaningful description; the individual marks are
    // presentational, so assistive tech announces the art once, not four times (AC-L3
    // applies the per-model label to the champion CARDS, not this decorative hero).
    const images = getAllByRole("img");

    expect(images).toHaveLength(1);
    expect(images[0].getAttribute("aria-label")).toMatch(
      /claude.*openai.*gemini/i,
    );
  });
});
