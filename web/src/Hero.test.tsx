import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import Hero from "./Hero";

// The composed face-off (left → right): OpenAI throws a reverse punch toward the centre,
// Claude holds the horse stance facing the viewer, Gemini sweeps a lower block toward the
// centre. Each fighter's stance + facing is a pinned contract (data-pose / data-facing);
// the SVG geometry that draws each pose is presentation and is not asserted here.
const readFighters = (container: HTMLElement) =>
  [...container.querySelectorAll(".hero-fighter")].map((fighter) => ({
    brand: fighter.querySelector("[data-brand]")?.getAttribute("data-brand"),
    pose: fighter.getAttribute("data-pose"),
    facing: fighter.getAttribute("data-facing"),
  }));

describe("Hero", () => {
  it("greets with the ModelKombat top-level heading", () => {
    const { getByRole } = render(() => <Hero />);

    expect(
      getByRole("heading", { level: 1, name: "ModelKombat" }),
    ).toBeTruthy();
  });

  it("stages the three fighters left → right, each in its named stance facing the centre", () => {
    const { container } = render(() => <Hero />);

    expect(readFighters(container)).toEqual([
      { brand: "openai", pose: "gyaku-zuki", facing: "right" },
      { brand: "claude", pose: "kiba-dachi", facing: "front" },
      { brand: "gemini", pose: "gedan-barai", facing: "left" },
    ]);
  });

  it("exposes the face-off as a single labelled image, its fighter heads decorative", () => {
    const { getAllByRole } = render(() => <Hero />);

    // The whole scene carries one meaningful description; the individual marks are
    // presentational, so assistive tech announces the art once, not four times.
    const images = getAllByRole("img");

    expect(images).toHaveLength(1);
    expect(images[0].getAttribute("aria-label")).toMatch(
      /openai.*claude.*gemini/i,
    );
  });
});
