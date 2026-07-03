import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { runTick } from "../engine/dsl.js";
import { CANONICAL_RULES } from "../engine/rules.js";
import type {
  State,
  SelfState,
  OpponentState,
  RingState,
  ClockState,
} from "../engine/types.js";
import { loadBotDoc } from "./load.js";

// The real grappler gauntlet document — an advance-and-throw infighter. Post S3 it
// gains a real close-range strike layer BELOW its throw's 120k reach: `empi` (elbow,
// reach 95k) at d ≤ 85k, and `hiza-geri` (knee, reach 110k) at 85k–95k which KNOCKS
// DOWN and opens the okizeme finishWindow for a `gyaku-zuki` finish (the sweeper's
// C8 okizeme pattern, lifted to a standing mid knee). The throw is kept as the ippon
// at the 95k–120k contact band (where it engages — and beats — the spacer vulture,
// whose parry→counter would feast on a strike there); the defensive `throw-break`
// still sits ABOVE the strikes. The strikes fire vs the RUSHERS that close inside 95k
// (a genuine close infight, not a cosmetic gate) without disturbing the calibrated
// band. These tests pin grappler's DECISION contract (state → action) through the
// public interpreter. grappler is DATA; its behaviour is the action it emits.
const grappler = loadBotDoc(
  readFileSync(
    fileURLToPath(new URL("../../bots/grappler.json", import.meta.url)),
    "utf8",
  ),
);

// Full-State factory (the interpreter reads a complete perceived snapshot). Neutral
// defaults: standing, mid-range, no incoming attack/throw, no open windows — so a
// test only sets the fields whose behaviour it exercises.
type StateOverrides = {
  self?: Partial<SelfState>;
  opponent?: Partial<OpponentState>;
  ring?: Partial<RingState>;
  clock?: Partial<ClockState>;
};

const state = (o: StateOverrides = {}): State => ({
  self: {
    x: 0,
    facing: 1,
    points: 0,
    canAct: true,
    phaseRemaining: 0,
    counterWindow: 0,
    cancelWindow: 0,
    finishWindow: 0,
    stamina: 100,
    gassed: 0,
    penalties: 0,
    passivityRemaining: 0,
    senshu: 0,
    ...o.self,
  },
  opponent: {
    x: 150000,
    y: 0,
    facing: -1,
    distance: 150000,
    attacking: false,
    attackBand: 0,
    posture: 0,
    throwing: false,
    knockdown: false,
    vx: 0,
    predictedDistance: 150000,
    stamina: 100,
    gassed: false,
    points: 0,
    penalties: 0,
    passivityRemaining: 0,
    senshu: 0,
    ...o.opponent,
  },
  ring: { width: 600000, ...o.ring },
  clock: { tick: 0, ticksRemaining: 600, overtime: 0, ...o.clock },
});

describe("grappler — close-range knee + elbow infight", () => {
  it("throws the point-blank elbow at d ≤ 85k", () => {
    // 80000: inside empi's band. The old grappler threw here (d ≤ 120k); now the
    // deepest sliver is the elbow's (waza-ari 2), the tightest rung of the infight.
    const action = runTick(
      grappler,
      state({ opponent: { distance: 80000 } }),
      {},
      CANONICAL_RULES,
    );

    expect(action).toEqual({ type: "attack", move: "empi", band: "mid" });
  });

  it("drives the knee in the 85k–95k band", () => {
    // 90000: past the elbow (85k), inside the knee band (95k). The knee scores 0 but
    // DOWNS the foe, opening the okizeme finishWindow (the points live in the finish).
    const action = runTick(
      grappler,
      state({ opponent: { distance: 90000 } }),
      {},
      CANONICAL_RULES,
    );

    expect(action).toEqual({ type: "attack", move: "hiza-geri", band: "mid" });
  });

  it("finishes a downed foe with gyaku-zuki while its finishWindow is open", () => {
    // After a knee knockdown grappler's own finishWindow opens; a gyaku-zuki inside it
    // is the guaranteed okizeme FINISH (finishScore 3), regardless of range — so this
    // fires even at neutral distance (150000), where the old grappler merely advanced.
    const action = runTick(
      grappler,
      state({ self: { finishWindow: 1 }, opponent: { distance: 150000 } }),
      {},
      CANONICAL_RULES,
    );

    expect(action).toEqual({ type: "attack", move: "gyaku-zuki", band: "mid" });
  });

  it("layers the close ladder at its band edges (elbow → knee split at 85k)", () => {
    const atElbowEdge = runTick(
      grappler,
      state({ opponent: { distance: 85000 } }),
      {},
      CANONICAL_RULES,
    );

    const justPastElbow = runTick(
      grappler,
      state({ opponent: { distance: 85001 } }),
      {},
      CANONICAL_RULES,
    );

    const atKneeEdge = runTick(
      grappler,
      state({ opponent: { distance: 95000 } }),
      {},
      CANONICAL_RULES,
    );

    expect(atElbowEdge).toEqual({ type: "attack", move: "empi", band: "mid" });
    expect(justPastElbow).toEqual({
      type: "attack",
      move: "hiza-geri",
      band: "mid",
    });
    expect(atKneeEdge).toEqual({
      type: "attack",
      move: "hiza-geri",
      band: "mid",
    });
  });

  it("keeps the throw as the ippon in the 95k–120k contact band, and advances beyond it", () => {
    // The strikes do not cannibalise the throw: past the knee band's 95k top the throw
    // (ippon 3) is still the pick up to its own 120k reach — the band where grappler
    // engages, and beats, the spacer vulture; beyond 120k grappler closes.
    const justPastKnee = runTick(
      grappler,
      state({ opponent: { distance: 95001 } }),
      {},
      CANONICAL_RULES,
    );

    const atThrowEdge = runTick(
      grappler,
      state({ opponent: { distance: 120000 } }),
      {},
      CANONICAL_RULES,
    );

    const beyondThrow = runTick(
      grappler,
      state({ opponent: { distance: 120001 } }),
      {},
      CANONICAL_RULES,
    );

    expect(justPastKnee).toEqual({ type: "throw" });
    expect(atThrowEdge).toEqual({ type: "throw" });
    expect(beyondThrow).toEqual({ type: "move", dir: 1 });
  });

  it("breaks a read throw before striking — throw-break stays above the close ladder", () => {
    // opponent.throwing at point-blank (80000, an elbow band): the defensive throw-break
    // sits ABOVE the strike rules, so grappler answers the grab instead of elbowing —
    // pinning that the new close ladder did not displace the anti-throw core.
    const action = runTick(
      grappler,
      state({ opponent: { throwing: true, distance: 80000 } }),
      {},
      CANONICAL_RULES,
    );

    expect(action).toEqual({ type: "throw-break" });
  });
});
