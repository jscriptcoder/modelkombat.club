import { createEffect, type Component } from "solid-js";
import { fireEvent, render, within } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import DojoApp from "./DojoApp";
import type { DojoStageProps } from "./DojoStage";
import type { ReplayTape } from "../replay/replay-contract";

// /dojo is the pose lab: a dark dev route that renders two fighters through the real replay pipeline
// so the pose model can be tuned in isolation. The scene-graph maths is asserted in dojo-tape.test /
// controls.test (pure builder + mapper + the shipped projection) and figures.test (the draw layer).
// Here we prove the PAGE mounts and that the per-figure controls re-pose the fighters — the Pixi mount
// is injected as a spy so the control→tape wiring is asserted without a WebGL canvas (which is opaque
// to DOM assertions and hangs agent-browser).

// A spy render sink capturing every tape DojoApp hands the stage, newest last.
const spyStage = () => {
  const tapes: ReplayTape[] = [];

  const Stage: Component<DojoStageProps> = (props) => {
    createEffect(() => {
      tapes.push(props.tape);
    });

    return <div data-testid="spy-stage" />;
  };

  return { Stage, latest: () => tapes[tapes.length - 1] };
};

describe("DojoApp — the pose-lab page", () => {
  it("names itself with a pose-lab heading", async () => {
    const { findByRole } = render(() => <DojoApp />);

    expect(await findByRole("heading", { name: /pose lab/i })).toBeTruthy();
  });

  it("renders the fighter stage host the Pixi canvas mounts into", async () => {
    const { findByRole } = render(() => <DojoApp />);

    expect(await findByRole("img", { name: /fighters/i })).toBeTruthy();
  });
});

describe("DojoApp — per-figure pose controls", () => {
  it("gives each fighter its own control panel", () => {
    const { getByRole } = render(() => <DojoApp />);

    expect(getByRole("group", { name: "Challenger" })).toBeTruthy();
    expect(getByRole("group", { name: "King" })).toBeTruthy();
  });

  it("re-poses the challenger when its posture changes, leaving the king untouched", () => {
    const { Stage, latest } = spyStage();
    const { getByRole } = render(() => <DojoApp stage={Stage} />);

    const challenger = getByRole("group", { name: "Challenger" });

    fireEvent.click(within(challenger).getByRole("button", { name: "Crouch" }));

    expect(latest()[0].a.posture).toBe(1); // challenger now crouches
    expect(latest()[0].b.posture).toBe(0); // king unchanged
  });

  it("re-poses the king independently of the challenger", () => {
    const { Stage, latest } = spyStage();
    const { getByRole } = render(() => <DojoApp stage={Stage} />);

    const king = getByRole("group", { name: "King" });

    fireEvent.click(within(king).getByRole("button", { name: "Air" }));

    expect(latest()[0].b.posture).toBe(2); // king now airborne
    expect(latest()[0].a.posture).toBe(0); // challenger unchanged from default
  });

  it("reaches an engine-impossible combo — knockdown AND throwing on one fighter (free combos)", () => {
    const { Stage, latest } = spyStage();
    const { getByRole } = render(() => <DojoApp stage={Stage} />);

    const challenger = getByRole("group", { name: "Challenger" });

    fireEvent.click(within(challenger).getByRole("checkbox", { name: "Knockdown" }));
    fireEvent.click(within(challenger).getByRole("checkbox", { name: "Throwing" }));

    expect(latest()[0].a.knockdown).toBe(true);
    expect(latest()[0].a.throwing).toBe(true);
  });

  it("sets a fighter's guard band from its control", () => {
    const { Stage, latest } = spyStage();
    const { getByRole } = render(() => <DojoApp stage={Stage} />);

    const challenger = getByRole("group", { name: "Challenger" });

    const guardBand = within(challenger).getByRole("combobox", {
      name: "Guard band",
    });

    fireEvent.change(guardBand, { target: { value: "3" } });

    expect(latest()[0].a.guardBand).toBe(3);
  });

  it("flips a fighter's facing from its control", () => {
    const { Stage, latest } = spyStage();
    const { getByRole } = render(() => <DojoApp stage={Stage} />);

    const king = getByRole("group", { name: "King" });

    // The default king faces left (−1); pressing Right flips it.
    fireEvent.click(within(king).getByRole("button", { name: "Face right" }));

    expect(latest()[0].b.facing).toBe(1);
  });

  it("marks the active posture segment as pressed and moves the mark on change", () => {
    const { getByRole } = render(() => <DojoApp />);

    const challenger = getByRole("group", { name: "Challenger" });

    // The default posture is Stand (0): Stand reads pressed, Crouch does not.
    expect(
      within(challenger).getByRole("button", { name: "Stand", pressed: true }),
    ).toBeTruthy();
    expect(
      within(challenger).getByRole("button", { name: "Crouch", pressed: false }),
    ).toBeTruthy();

    fireEvent.click(within(challenger).getByRole("button", { name: "Crouch" }));

    // The pressed mark follows the selection.
    expect(
      within(challenger).getByRole("button", { name: "Crouch", pressed: true }),
    ).toBeTruthy();
    expect(
      within(challenger).getByRole("button", { name: "Stand", pressed: false }),
    ).toBeTruthy();
  });
});
