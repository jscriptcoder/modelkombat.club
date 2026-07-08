import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import "./app.css";
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

  it("keeps the wordmark one heading but tints 'Kombat' in the brand accent", () => {
    const { getByRole, container } = render(() => <Hero />);

    // Still a single wordmark for assistive tech...
    const heading = getByRole("heading", { level: 1, name: "ModelKombat" });

    // ...while 'Kombat' is split out and painted the brand accent (#7aa2ff),
    // visibly distinct from the inherited white of the 'Model' half.
    const accent = container.querySelector(".hero-title-accent");

    if (!(accent instanceof HTMLElement)) {
      throw new Error("expected a .hero-title-accent element in the heading");
    }

    expect(accent.textContent).toBe("Kombat");
    expect(heading.textContent).toBe("ModelKombat");

    const accentColor = getComputedStyle(accent).color;

    expect(accentColor).toBe("rgb(122, 162, 255)");
    expect(accentColor).not.toBe(getComputedStyle(heading).color);
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
