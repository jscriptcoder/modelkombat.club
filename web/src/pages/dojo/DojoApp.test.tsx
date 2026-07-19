import { createEffect, type Component } from "solid-js";
import { fireEvent, render, within } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import DojoApp from "./DojoApp";
import { durationOf, REACH_PRESETS } from "./reach-presets";
import type { DojoStageProps } from "./DojoStage";
import type { ReplayTape } from "../replay/replay-contract";
import type { Brand } from "../../shared/lib/brand";

// Look a move up in the engine-mirror table. Tests assert AGAINST the table rather than against
// transcribed literals (decision 9), so re-tuning a move's reach or timing never breaks a test —
// only a move DISAPPEARING does, which is exactly the drift worth failing on.
const presetOf = (move: string) => {
  const preset = REACH_PRESETS.find((p) => p.move === move);

  if (!preset) throw new Error(`no preset mirrors "${move}"`);

  return preset;
};

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
  const ticks: number[] = [];
  let mounts = 0;

  const Stage: Component<DojoStageProps> = (props) => {
    mounts += 1;

    createEffect(() => {
      tapes.push(props.tape);
    });

    createEffect(() => {
      brandPairs.push(props.brands);
    });

    // The playhead the page hands down (S2). The spy never runs a clock of its own, so playback stays
    // deterministic here — only the transport controls move it.
    createEffect(() => {
      ticks.push(props.tick);
    });

    return <div data-testid="spy-stage" />;
  };

  return {
    Stage,
    latest: () => tapes[tapes.length - 1],
    latestBrands: () => brandPairs[brandPairs.length - 1],
    latestTick: () => ticks[ticks.length - 1],
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
    const { getByRole } = render(() => <DojoApp />);

    // Scope to the Spacing control — each figure now also carries a "k" reach read-out (M10), so the
    // gap read-out must be read within its own group to stay unambiguous.
    const spacing = getByRole("group", { name: "Spacing" });

    // Opens at the default 240k gap.
    expect(within(spacing).getByText("240k")).toBeTruthy();

    fireEvent.input(getByRole("slider", { name: "Gap" }), {
      target: { value: "100000" },
    });

    expect(within(spacing).getByText("100k")).toBeTruthy(); // the read-out follows the gap
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

describe("DojoApp — per-figure attack-reach control (M10)", () => {
  it("opens each fighter at its default committed reach — challenger at mae-geri, king idle", () => {
    const { Stage, latest } = spyStage();
    const { getByRole } = render(() => <DojoApp stage={Stage} />);

    const frame = latest()[0];

    expect(frame.a.attackReach).toBe(270_000); // mae-geri reach — the default committed move
    expect(frame.b.attackReach).toBe(0); // idle king — no committed reach

    // ...and each figure's slider read-out reflects that default (the control shows what it drives).
    const challenger = getByRole("group", { name: "Challenger" });
    const king = getByRole("group", { name: "King" });

    expect(within(challenger).getByText("270k")).toBeTruthy();
    expect(within(king).getByText("0k")).toBeTruthy();
  });

  it("dials a fighter's committed reach from its own slider, leaving the other untouched", () => {
    const { Stage, latest } = spyStage();
    const { getByRole } = render(() => <DojoApp stage={Stage} />);

    const challenger = getByRole("group", { name: "Challenger" });

    // Dial the challenger's reach DOWN to empi (elbow) distance — short of the default gap, so it now
    // whiffs where the opening gyaku reach landed (the contact behaviour is asserted in scene.test).
    fireEvent.input(
      within(challenger).getByRole("slider", { name: "Attack reach" }),
      { target: { value: "95000" } },
    );

    expect(latest()[0].a.attackReach).toBe(95_000); // challenger's reach dialed down
    expect(latest()[0].b.attackReach).toBe(0); // king untouched
  });

  it("dials the king's reach independently of the challenger", () => {
    const { Stage, latest } = spyStage();
    const { getByRole } = render(() => <DojoApp stage={Stage} />);

    const king = getByRole("group", { name: "King" });

    fireEvent.input(
      within(king).getByRole("slider", { name: "Attack reach" }),
      {
        target: { value: "300000" },
      },
    );

    expect(latest()[0].b.attackReach).toBe(300_000); // king's reach set
    expect(latest()[0].a.attackReach).toBe(270_000); // challenger unchanged from default
  });
});

// S2 · Slice 2 — the lab plays a technique through its real duration. The transport state lives in
// the PAGE (above the injectable stage seam) so every control transition is assertable without a
// WebGL mount; the Pixi ticker at the impure edge only calls back into it. The clock model itself is
// pure and already covered in transport.test — these assert the WIRING.
describe("DojoApp — playing a technique through its duration", () => {
  it("opens on the first tick of the technique and hands the playhead to the stage", () => {
    const { Stage, latestTick, latest } = spyStage();

    render(() => <DojoApp stage={Stage} />);

    expect(latestTick()).toBe(0);
    expect(latest()).toHaveLength(28); // the default mae-geri, spanning its 9/3/16 timing
  });

  it("steps one tick forward and back, holding at the ends of the tape", () => {
    const { Stage, latestTick } = spyStage();
    const { getByRole } = render(() => <DojoApp stage={Stage} />);

    const forward = getByRole("button", { name: /step forward/i });
    const back = getByRole("button", { name: /step back/i });

    fireEvent.click(forward);
    expect(latestTick()).toBe(1);

    fireEvent.click(forward);
    expect(latestTick()).toBe(2);

    fireEvent.click(back);
    expect(latestTick()).toBe(1);

    // Stepping past the start holds at tick 0 rather than running negative.
    fireEvent.click(back);
    fireEvent.click(back);
    expect(latestTick()).toBe(0);
  });

  it("scrubs to any tick of the technique, including its last", () => {
    const { Stage, latestTick } = spyStage();
    const { getByRole } = render(() => <DojoApp stage={Stage} />);

    const scrub = getByRole("slider", { name: /scrub/i });

    fireEvent.input(scrub, { target: { value: "9" } }); // mae-geri's contact tick
    expect(latestTick()).toBe(9);

    fireEvent.input(scrub, { target: { value: "27" } }); // its final recovery tick
    expect(latestTick()).toBe(27);
  });

  it("pauses playback whenever the developer takes manual control", () => {
    // `seek`/`step` always pause (transport.ts) — this pins that the page dispatches THOSE, so a
    // running clock can never fight a developer who is scrubbing to a frame to tune it.
    const { Stage } = spyStage();
    const { getByRole } = render(() => <DojoApp stage={Stage} />);

    const toggle = getByRole("button", { name: /pause|play/i });

    expect(toggle.textContent).toBe("Pause"); // opens playing — the technique plays on load

    fireEvent.click(getByRole("button", { name: /step forward/i }));
    expect(toggle.textContent).toBe("Play"); // a step paused it

    fireEvent.click(toggle);
    expect(toggle.textContent).toBe("Pause"); // and it resumes on demand

    fireEvent.input(getByRole("slider", { name: /scrub/i }), {
      target: { value: "5" },
    });
    expect(toggle.textContent).toBe("Play"); // a scrub paused it too
  });

  it("re-spans the tape and pulls the playhead back in range when a shorter technique is selected", () => {
    // The tape length is a function of the committed move, so a control edit can shrink it out from
    // under the playhead. Dialing the challenger idle collapses the tape to one tick.
    const { Stage, latestTick, latest } = spyStage();
    const { getByRole } = render(() => <DojoApp stage={Stage} />);

    fireEvent.input(getByRole("slider", { name: /scrub/i }), {
      target: { value: "27" },
    });
    expect(latestTick()).toBe(27);

    const challenger = getByRole("group", { name: "Challenger" });

    fireEvent.click(
      within(challenger).getByRole("checkbox", { name: /attacking/i }),
    );

    expect(latest()).toHaveLength(1); // nothing committed ⇒ a single static tick
    expect(latestTick()).toBe(0); // ...and the playhead is no longer off the end
  });
});

describe("DojoApp — replaying a technique from the start", () => {
  // Playback auto-pauses on the final tick, so without a restart the lab settles on a recovery
  // frame and the only way back is to scrub to 0 and press Play. Restart is that in one control:
  // it returns to the first tick AND resumes, so the technique plays rather than sitting at 0.

  it("returns to the first tick and resumes from a technique parked at its end", () => {
    const { Stage, latestTick } = spyStage();
    const { getByRole } = render(() => <DojoApp stage={Stage} />);

    // Scrubbing to the last tick is how the lab actually ends up here — and it pauses on the way.
    fireEvent.input(getByRole("slider", { name: /scrub/i }), {
      target: { value: "27" },
    });

    const toggle = getByRole("button", { name: /pause|play/i });

    expect(latestTick()).toBe(27);
    expect(toggle.textContent).toBe("Play"); // parked and paused

    fireEvent.click(getByRole("button", { name: /restart/i }));

    expect(latestTick()).toBe(0);
    expect(toggle.textContent).toBe("Pause"); // ...and running again, not merely rewound
  });

  it("rewinds a technique that is still playing, without pausing it", () => {
    const { Stage, latestTick } = spyStage();
    const { getByRole } = render(() => <DojoApp stage={Stage} />);

    const toggle = getByRole("button", { name: /pause|play/i });

    fireEvent.input(getByRole("slider", { name: /scrub/i }), {
      target: { value: "9" }, // mae-geri's contact tick — a scrub pauses
    });
    fireEvent.click(toggle); // ...so resume, to reach mid-tape AND playing

    expect(latestTick()).toBe(9);
    expect(toggle.textContent).toBe("Pause");

    fireEvent.click(getByRole("button", { name: /restart/i }));

    expect(latestTick()).toBe(0);
    expect(toggle.textContent).toBe("Pause");
  });
});

// S3 · Slice 2 — the arsenal becomes browsable. Until now the committed technique was a constant in
// controls.ts, so seeing any move but mae-geri meant editing source. The picker is a per-figure raw
// control like every other (M10): selecting STAMPS the move's mirrored reach and lets go, leaving
// every slider free afterward (decision 6). The pose each move DRAWS is scene.test's subject — these
// assert the wiring from the control to the tape.
describe("DojoApp — per-figure move picker (S3)", () => {
  it("offers every arsenal technique, plus an idle row for no committed move", () => {
    const { getByRole } = render(() => <DojoApp />);

    const challenger = getByRole("group", { name: "Challenger" });
    const picker = within(challenger).getByRole("combobox", { name: "Move" });

    const values = within(picker)
      .getAllByRole("option")
      .map((option) => option.getAttribute("value"));

    // Idle first (the "" the engine itself uses for nothing committed), then the mirror's own order.
    expect(values).toEqual(["", ...REACH_PRESETS.map((p) => p.move)]);
  });

  it("shows which technique each fighter is committed to, opening on the lab's defaults", () => {
    // The picker must READ BACK, not just write: it is the only place the committed move is
    // visible, so a picker that drives the pose without reflecting it would leave the developer
    // unable to tell what they are looking at.
    const { getByRole } = render(() => <DojoApp />);

    const challenger = getByRole("group", { name: "Challenger" });
    const king = getByRole("group", { name: "King" });

    expect(
      within(challenger).getByRole("option", {
        name: "mae-geri",
        selected: true,
      }),
    ).toBeTruthy();

    expect(
      within(king).getByRole("option", { name: "idle", selected: true }),
    ).toBeTruthy();

    fireEvent.change(
      within(challenger).getByRole("combobox", { name: "Move" }),
      { target: { value: "shuto" } },
    );

    expect(
      within(challenger).getByRole("option", { name: "shuto", selected: true }),
    ).toBeTruthy();
  });

  it("plays the selected technique over its own duration, at its own reach", () => {
    const { Stage, latest } = spyStage();
    const { getByRole } = render(() => <DojoApp stage={Stage} />);

    const challenger = getByRole("group", { name: "Challenger" });
    const mawashi = presetOf("mawashi-geri");

    fireEvent.change(
      within(challenger).getByRole("combobox", { name: "Move" }),
      { target: { value: "mawashi-geri" } },
    );

    expect(latest()).toHaveLength(durationOf(mawashi)); // the tape re-spans to the new timing
    expect(latest()[0].a.attackMove).toBe("mawashi-geri");
    expect(latest()[0].a.attackReach).toBe(mawashi.reach); // reach stamped from the mirror
    expect(latest()[0].a.attacking).toBe(true); // ...and the figure is committed to it
  });

  it("restarts playback from the first tick when a move is selected", () => {
    // Playback auto-pauses at the end, so without this a selection would land on the new move's
    // final recovery frame — the picker would look broken from the second selection onward.
    const { Stage, latestTick } = spyStage();
    const { getByRole } = render(() => <DojoApp stage={Stage} />);

    fireEvent.input(getByRole("slider", { name: /scrub/i }), {
      target: { value: "27" }, // park at the end of the default mae-geri, which also pauses
    });
    expect(latestTick()).toBe(27);

    const challenger = getByRole("group", { name: "Challenger" });

    fireEvent.change(
      within(challenger).getByRole("combobox", { name: "Move" }),
      { target: { value: "mawashi-geri" } },
    );

    expect(latestTick()).toBe(0);
    expect(getByRole("button", { name: /pause|play/i }).textContent).toBe(
      "Pause",
    ); // ...and running, so the technique plays rather than sitting at tick 0
  });

  it("stands a fighter down when the idle row is selected", () => {
    const { Stage, latest } = spyStage();
    const { getByRole } = render(() => <DojoApp stage={Stage} />);

    const challenger = getByRole("group", { name: "Challenger" });

    fireEvent.change(
      within(challenger).getByRole("combobox", { name: "Move" }),
      { target: { value: "" } },
    );

    expect(latest()[0].a.attacking).toBe(false);
    expect(latest()[0].a.attackMove).toBe("");
    expect(latest()[0].a.attackReach).toBe(0);
    expect(latest()).toHaveLength(1); // nothing committed on either figure ⇒ one static tick
  });

  it("commits the king to its own technique, leaving the challenger untouched", () => {
    const { Stage, latest } = spyStage();
    const { getByRole } = render(() => <DojoApp stage={Stage} />);

    const king = getByRole("group", { name: "King" });
    const yoko = presetOf("yoko-geri");

    fireEvent.change(within(king).getByRole("combobox", { name: "Move" }), {
      target: { value: "yoko-geri" },
    });

    expect(latest()[0].b.attackMove).toBe("yoko-geri");
    expect(latest()[0].b.attackReach).toBe(yoko.reach);
    expect(latest()[0].a.attackMove).toBe("mae-geri"); // challenger keeps its default
    expect(latest()[0].a.attackReach).toBe(presetOf("mae-geri").reach);
  });

  it("leaves the stamped reach free to be dialed away without changing the move", () => {
    // Stamp-then-let-go (decision 6): the picker seeds a real fighting distance, then every slider
    // stays live — deviating from it is the point of the lab, not a mistake to be corrected.
    const { Stage, latest } = spyStage();
    const { getByRole } = render(() => <DojoApp stage={Stage} />);

    const challenger = getByRole("group", { name: "Challenger" });

    fireEvent.change(
      within(challenger).getByRole("combobox", { name: "Move" }),
      { target: { value: "mawashi-geri" } },
    );

    fireEvent.input(
      within(challenger).getByRole("slider", { name: "Attack reach" }),
      { target: { value: "95000" } },
    );

    expect(latest()[0].a.attackReach).toBe(95_000); // dialed to point-blank...
    expect(latest()[0].a.attackMove).toBe("mawashi-geri"); // ...still a roundhouse
    expect(
      within(challenger).getByRole("option", {
        name: "mawashi-geri",
        selected: true,
      }),
    ).toBeTruthy(); // ...and the picker still says so
  });

  it("commits an unauthored move so the renderer's generic fallback draws it (M7)", () => {
    // 12 of the 13 have no descriptor yet. The picker must still commit them — the fallback to the
    // generic hand pose lives in the renderer (scene.test owns that), so what matters here is that
    // the id reaches the tape rather than being filtered out as unknown.
    const { Stage, latest } = spyStage();
    const { getByRole } = render(() => <DojoApp stage={Stage} />);

    const challenger = getByRole("group", { name: "Challenger" });

    fireEvent.change(
      within(challenger).getByRole("combobox", { name: "Move" }),
      { target: { value: "uraken" } },
    );

    expect(latest()[0].a.attackMove).toBe("uraken");
    expect(latest()).toHaveLength(durationOf(presetOf("uraken")));
  });
});
