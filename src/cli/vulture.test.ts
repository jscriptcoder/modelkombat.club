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

// The real vulture gauntlet document — a reactive parry→counter defender. These
// tests pin its DECISION contract (input state → chosen action) through the public
// interpreter, so the bot's behaviour is locked as a characterization the way the
// dogfood benchmark record is. vulture is DATA; its behaviour is the action it emits.
const vulture = loadBotDoc(
  readFileSync(
    fileURLToPath(new URL("../../bots/vulture.json", import.meta.url)),
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
    posture: 0,
    y: 0,
    vy: 0,
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

describe("vulture — disciplined parry→counter", () => {
  it("counters with a gas-proof uraken when its counter window is open", () => {
    // A parry has just opened the window (foe is in parryRecovery, not throwing/
    // attacking). vulture must swoop: strike the gas-proof uraken while the foe
    // cannot answer. Today's counter-less vulture falls through to walk-forward.
    const action = runTick(
      vulture,
      state({ self: { counterWindow: 1, canAct: true } }),
      {},
      CANONICAL_RULES,
    );

    expect(action).toEqual({ type: "attack", move: "uraken", band: "high" });
  });

  it("does NOT attack in neutral (window shut, foe not gassed) — the anti-backfire discipline", () => {
    // counterWindow 0, foe healthy and idle: the only offence vulture has is the
    // counter (and the pre-existing gassed-punish, off here). An over-broad counter
    // rule (>= 0, or unconditional) would attack here — this pins that it does not.
    const action = runTick(
      vulture,
      state({
        self: { counterWindow: 0, canAct: true },
        opponent: { gassed: false, throwing: false, attackBand: 0 },
      }),
      {},
      CANONICAL_RULES,
    );

    expect(action.type).not.toBe("attack");
  });

  it("counters rather than re-blocks when a window is open — counter takes priority over the band read", () => {
    // counterWindow open AND an attackBand present: counter-first placement means
    // vulture swoops instead of raising another guard. Today's vulture blocks high.
    const action = runTick(
      vulture,
      state({
        self: { counterWindow: 1, canAct: true },
        opponent: { attackBand: 3 },
      }),
      {},
      CANONICAL_RULES,
    );

    expect(action).toEqual({ type: "attack", move: "uraken", band: "high" });
  });
});
