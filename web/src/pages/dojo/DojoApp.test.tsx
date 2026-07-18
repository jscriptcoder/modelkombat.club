import { createEffect, type Component } from "solid-js";
import { fireEvent, render, within } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import DojoApp from "./DojoApp";
import type { DojoStageProps } from "./DojoStage";
import type { ReplayTape } from "../replay/replay-contract";
import type { Brand } from "../../shared/lib/brand";

// /dojo is the pose lab: a dark dev route that renders two fighters through the real replay pipeline
// so the pose model can be tuned in isolation. The scene-graph maths is asserted in dojo-tape.test /
// controls.test (pure builder + mapper + the shipped projection) and figures.test (the draw layer).
// Here we prove the PAGE mounts and that the per-figure controls re-pose the fighters — the Pixi mount
// is injected as a spy so the control→tape wiring is asserted without a WebGL canvas (which is opaque
// to DOM assertions and hangs agent-browser).

// A spy render sink capturing every tape AND brand pair DojoApp hands the stage, newest last, plus a
// mount count — each fresh Stage instance is one mount, so a remount (brand change) increments it.
const spyStage = () => {
  const tapes: ReplayTape[] = [];
  const brandPairs: (readonly [Brand, Brand])[] = [];
  let mounts = 0;

  const Stage: Component<DojoStageProps> = (props) => {
    mounts += 1;

    createEffect(() => {
      tapes.push(props.tape);
    });

    createEffect(() => {
      brandPairs.push(props.brands);
    });

    return <div data-testid="spy-stage" />;
  };

  return {
    Stage,
    latest: () => tapes[tapes.length - 1],
    latestBrands: () => brandPairs[brandPairs.length - 1],
    mounts: () => mounts,
  };
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

    fireEvent.click(
      within(challenger).getByRole("checkbox", { name: "Knockdown" }),
    );
    fireEvent.click(
      within(challenger).getByRole("checkbox", { name: "Throwing" }),
    );

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
      within(challenger).getByRole("button", {
        name: "Crouch",
        pressed: false,
      }),
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

describe("DojoApp — per-figure brand picker", () => {
  it("opens with the challenger's Claude head and the king's generic head (M10 default)", () => {
    const { Stage, latestBrands } = spyStage();

    render(() => <DojoApp stage={Stage} />);

    expect(latestBrands()).toEqual(["claude", "generic"]);
  });

  it("offers all five brand marks as options on a figure's picker", () => {
    const { getByRole } = render(() => <DojoApp />);

    const challenger = getByRole("group", { name: "Challenger" });
    const picker = within(challenger).getByRole("combobox", { name: "Brand" });

    const values = within(picker)
      .getAllByRole("option")
      .map((option) => option.getAttribute("value"));

    expect(values).toEqual(["claude", "openai", "gemini", "grok", "generic"]);
  });

  it("sets the challenger's brand from its picker, leaving the king's untouched", () => {
    const { Stage, latestBrands } = spyStage();
    const { getByRole } = render(() => <DojoApp stage={Stage} />);

    const challenger = getByRole("group", { name: "Challenger" });

    fireEvent.change(
      within(challenger).getByRole("combobox", { name: "Brand" }),
      { target: { value: "grok" } },
    );

    expect(latestBrands()).toEqual(["grok", "generic"]);
  });

  it("sets the king's brand independently of the challenger's", () => {
    const { Stage, latestBrands } = spyStage();
    const { getByRole } = render(() => <DojoApp stage={Stage} />);

    const king = getByRole("group", { name: "King" });

    fireEvent.change(within(king).getByRole("combobox", { name: "Brand" }), {
      target: { value: "gemini" },
    });

    expect(latestBrands()).toEqual(["claude", "gemini"]);
  });

  it("remounts the stage on a brand change but not on a pose change (brand is baked at figure creation)", () => {
    const { Stage, mounts } = spyStage();
    const { getByRole } = render(() => <DojoApp stage={Stage} />);

    const challenger = getByRole("group", { name: "Challenger" });
    const afterFirstMount = mounts();

    // A pose edit re-applies the tape on the SAME stage — no rebuild (Q3).
    fireEvent.click(within(challenger).getByRole("button", { name: "Crouch" }));

    expect(mounts()).toBe(afterFirstMount);

    // A brand edit rebuilds the stage — createStage bakes the brand into each figure at creation.
    fireEvent.change(
      within(challenger).getByRole("combobox", { name: "Brand" }),
      { target: { value: "grok" } },
    );

    expect(mounts()).toBe(afterFirstMount + 1);
  });

  it("keeps the chosen brand when a pose control changes (independent signal)", () => {
    const { Stage, latestBrands, latest } = spyStage();
    const { getByRole } = render(() => <DojoApp stage={Stage} />);

    const challenger = getByRole("group", { name: "Challenger" });

    fireEvent.change(
      within(challenger).getByRole("combobox", { name: "Brand" }),
      { target: { value: "grok" } },
    );
    fireEvent.click(within(challenger).getByRole("button", { name: "Crouch" }));

    expect(latestBrands()[0]).toBe("grok"); // the brand survived the pose edit
    expect(latest()[0].a.posture).toBe(1); // and the pose still applied
  });
});

describe("DojoApp — world-gap spacing control", () => {
  it("snaps the fighter gap to a preset move's reach, repositioning both fighters", () => {
    const { Stage, latest } = spyStage();
    const { getByRole } = render(() => <DojoApp stage={Stage} />);

    // Snap to the longest reach in the arsenal.
    fireEvent.change(getByRole("combobox", { name: "Reach preset" }), {
      target: { value: "ushiro-geri" },
    });

    const frame = latest()[0];

    expect(frame.b.x - frame.a.x).toBe(330_000); // ushiro-geri reach
    expect((frame.a.x + frame.b.x) / 2).toBe(300_000); // still centered on the ring
  });

  it("sets a free gap from the slider, repositioning both fighters symmetrically", () => {
    const { Stage, latest } = spyStage();
    const { getByRole } = render(() => <DojoApp stage={Stage} />);

    fireEvent.input(getByRole("slider", { name: "Gap" }), {
      target: { value: "100000" },
    });

    const frame = latest()[0];

    expect(frame.b.x - frame.a.x).toBe(100_000);
    expect((frame.a.x + frame.b.x) / 2).toBe(300_000);
  });

  it("shows the current gap as a numeric read-out that tracks the slider", () => {
    const { getByRole, getByText } = render(() => <DojoApp />);

    // Opens at the default 240k gap.
    expect(getByText("240k")).toBeTruthy();

    fireEvent.input(getByRole("slider", { name: "Gap" }), {
      target: { value: "100000" },
    });

    expect(getByText("100k")).toBeTruthy(); // the read-out follows the gap
  });

  it("reflects the current gap in the preset selector — a matching reach, else Custom", () => {
    const { getByRole } = render(() => <DojoApp />);

    // The lab opens at the default 240k gap, which IS gyaku-zuki's reach.
    expect(
      getByRole("option", { name: /gyaku-zuki/, selected: true }),
    ).toBeTruthy();

    // Drag to a value that matches no preset → the selector falls back to Custom.
    fireEvent.input(getByRole("slider", { name: "Gap" }), {
      target: { value: "123000" },
    });

    expect(
      getByRole("option", { name: "Custom", selected: true }),
    ).toBeTruthy();
  });
});
