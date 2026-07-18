import { describe, expect, it } from "vitest";

import { BODY_HEIGHT_SUB, scene, type Viewport } from "../replay/scene";
import type { ReplayFrame } from "../replay/replay-contract";
import {
  controlsToFrame,
  DEFAULT_CHALLENGER_CONTROLS,
  DEFAULT_KING_CONTROLS,
  type FigureControls,
} from "./controls";

// Story 3 — world scale. The shipped projection world-scales the pose, so the reference-frame
// constants render at ×(BODY_HEIGHT_SUB · pxPerSubunit / 76), rounded. Computed from the documented
// knob + the fixed 1200-wide viewport (not the production scale fn), so a scale mutant is caught.
const BODY_SCALE = (BODY_HEIGHT_SUB * (1200 / 600_000)) / 76;

const scaled = (joint: { x: number; y: number }) => ({
  x: Math.round(joint.x * BODY_SCALE),
  y: Math.round(joint.y * BODY_SCALE),
});

// The pose lab exposes the RAW frame pose fields as controls (not a mutually-exclusive action enum),
// so engine-impossible combos are reachable by design and `poseFor` resolves precedence. `controlsToFrame`
// is the pure mapper from that control state to a render `ReplayFrame`; the lab feeds it through the SAME
// scene()/poseFor projection /watch ships. web/ is not Stryker-reachable, so exact cases stand in for
// mutation coverage.

// A neutral control state — override only the fields a case exercises.
const controls = (overrides: Partial<FigureControls> = {}): FigureControls => ({
  posture: 0,
  facing: 1,
  attacking: false,
  attackBand: 0,
  guardBand: 0,
  throwing: false,
  knockdown: false,
  attackReach: 0,
  ...overrides,
});

describe("controlsToFrame — maps the lab's raw pose controls to a render frame", () => {
  it("passes every pose field straight through, unclamped (free combos)", () => {
    const frame = controlsToFrame({
      posture: 1,
      facing: -1,
      attacking: true,
      attackBand: 3,
      guardBand: 2,
      throwing: true,
      knockdown: true,
      attackReach: 250_000,
    });

    // Every tuned field survives verbatim; the render-only fields are filled with grounded, neutral
    // defaults (x is owned by the builder's centering, y 0 plants the fighter on the ring floor).
    expect(frame).toEqual({
      posture: 1,
      facing: -1,
      attacking: true,
      attackBand: 3,
      guardBand: 2,
      throwing: true,
      knockdown: true,
      attackReach: 250_000,
      x: 0,
      y: 0,
      points: 0,
      stamina: 100,
    } satisfies ReplayFrame);
  });

  it("grounds the fighter and fills render-neutral score/stamina for a minimal control state", () => {
    const frame = controlsToFrame(controls());

    expect(frame.x).toBe(0);
    expect(frame.y).toBe(0); // grounded on the ring floor
    expect(frame.points).toBe(0);
    expect(frame.stamina).toBe(100);
  });

  it("passes an out-of-range posture through unclamped (poseFor owns the STAND fallback)", () => {
    expect(controlsToFrame(controls({ posture: 5 })).posture).toBe(5);
  });

  it("passes an engine-impossible knockdown+throwing combo through unchanged", () => {
    const frame = controlsToFrame(
      controls({ knockdown: true, throwing: true }),
    );

    expect(frame.knockdown).toBe(true);
    expect(frame.throwing).toBe(true);
  });
});

describe("the mapped control frame renders through the real scene()/poseFor projection", () => {
  const VIEWPORT: Viewport = { width: 1200, height: 600 };

  // The pose the shipped projection derives for a given control state (challenger slot).
  const poseOf = (c: FigureControls) => {
    const frame = controlsToFrame(c);

    return scene([{ tick: 0, a: frame, b: frame }], 0, VIEWPORT).a.pose;
  };

  it("drives the front hand forward for a standing mid strike (floored point-blank)", () => {
    // The strike control reaches the reach-to-target solve via the shipped projection. This helper
    // renders one figure against ITSELF (a === b), so the fighters overlap and the reach floors to
    // the point-blank forward technique (x 24) — still forward of the neutral stance hand (x 18).
    // The true in-range landing distance is exercised in scene.test.
    const handR = poseOf(
      controls({ attacking: true, attackBand: 2, attackReach: 240_000 }),
    ).handR;

    expect(handR).toEqual(scaled({ x: 24, y: -46 }));
    expect(handR.x).toBeGreaterThan(scaled({ x: 18, y: 0 }).x);
  });

  it("drops the stance for a crouch (posture 1)", () => {
    const pose = poseOf(controls({ posture: 1 }));

    expect(pose.head).toEqual(scaled({ x: 0, y: -58 })); // CROUCH head sits lower than STAND (-76)
    expect(pose.shoulder).toEqual(scaled({ x: 0, y: -46 }));
  });

  it("tucks the legs for an air posture (posture 2)", () => {
    expect(poseOf(controls({ posture: 2 })).footL).toEqual(
      scaled({ x: -10, y: -18 }),
    );
  });

  it("falls back to the standing skeleton for an out-of-range posture", () => {
    const pose = poseOf(controls({ posture: 7 }));

    expect(pose.head).toEqual(scaled({ x: 0, y: -76 })); // STAND
    expect(pose.footL).toEqual(scaled({ x: -14, y: 0 })); // planted, not tucked
  });

  it("lifts the rear hand to the incoming band for a raised guard", () => {
    expect(poseOf(controls({ guardBand: 3 })).handL).toEqual(
      scaled({ x: 8, y: -68 }),
    );
  });

  it("locks both hands into a forward grab for a throw", () => {
    const pose = poseOf(controls({ throwing: true }));

    expect(pose.handL).toEqual(scaled({ x: 28, y: -44 }));
    expect(pose.handR).toEqual(scaled({ x: 36, y: -44 }));
  });

  it("lays the fighter prone for a knockdown, overriding a simultaneous throw (precedence)", () => {
    const pose = poseOf(controls({ knockdown: true, throwing: true }));

    // PRONE wins by poseFor precedence — the head lies at the ground, NOT a standing grab.
    expect(pose.head).toEqual(scaled({ x: -40, y: -10 }));
    expect(pose.handR).not.toEqual(scaled({ x: 36, y: -44 })); // not the throw grab
  });
});

describe("default control states seed the pose lab's opening scene", () => {
  it("poses the default challenger as a standing mid-strike facing right", () => {
    expect(DEFAULT_CHALLENGER_CONTROLS).toEqual({
      posture: 0,
      facing: 1,
      attacking: true,
      attackBand: 2,
      guardBand: 0,
      throwing: false,
      knockdown: false,
      attackReach: 240_000, // gyaku reach — lands at the default gap
    } satisfies FigureControls);
  });

  it("poses the default king as a fully idle stand facing left", () => {
    expect(DEFAULT_KING_CONTROLS).toEqual({
      posture: 0,
      facing: -1,
      attacking: false,
      attackBand: 0,
      guardBand: 0,
      throwing: false,
      knockdown: false,
      attackReach: 0, // idle
    } satisfies FigureControls);
  });
});
