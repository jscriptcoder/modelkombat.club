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

// The real jabber gauntlet document. Post S-jabber it is a pressure fighter with
// REACTIVE DEFENCE: it still advances and jabs in close, but now parries incoming
// attacks by band and — when the parry opens a counter window — swoops with a
// shuto counter. S1's vulture parry→counter had feasted on the old pure jab-spam
// (jabber fell 28→19% OUT-low); the reactive layer lifts it back into the
// [25,75] band (it flips the rekka matchup and holds zoner). These tests pin its
// DECISION contract (state → action) through the public interpreter. jabber is
// DATA; its behaviour is the action it emits. (The counter also covers `shuto`.)
const jabber = loadBotDoc(
  readFileSync(
    fileURLToPath(new URL("../../bots/jabber.json", import.meta.url)),
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

describe("jabber — pressure with reactive block+counter", () => {
  it("counters with a shuto when its counter window is open", () => {
    // A parry has just opened the window. jabber swoops with the knife-hand — even
    // out at 250000 (past its jab), where the old jab-spammer merely walked forward.
    const action = runTick(
      jabber,
      state({ self: { counterWindow: 1 }, opponent: { distance: 250000 } }),
      {},
      CANONICAL_RULES,
    );

    expect(action).toEqual({ type: "attack", move: "shuto", band: "high" });
  });

  it("counters rather than raising another guard when a window is open", () => {
    // counterWindow open AND a read attack incoming: counter-first ordering means
    // jabber swoops instead of blocking. Pins the counter rule ABOVE the block rules.
    const action = runTick(
      jabber,
      state({
        self: { counterWindow: 1 },
        opponent: { attackBand: 3, distance: 200000 },
      }),
      {},
      CANONICAL_RULES,
    );

    expect(action).toEqual({ type: "attack", move: "shuto", band: "high" });
  });

  it("blocks a read high attack on reaction", () => {
    const action = runTick(
      jabber,
      state({ opponent: { attackBand: 3, distance: 200000 } }),
      {},
      CANONICAL_RULES,
    );

    expect(action).toEqual({ type: "block", band: "high" });
  });

  it("blocks a read mid attack on reaction — even inside its own jab range", () => {
    // attackBand present at 200000 (jab range): the block rule takes PRIORITY over
    // the jab, so jabber defends the read instead of trading. The old jabber jabbed
    // mid here — this is the reactive layer that de-fangs the pressure bots.
    const action = runTick(
      jabber,
      state({ opponent: { attackBand: 2, distance: 200000 } }),
      {},
      CANONICAL_RULES,
    );

    expect(action).toEqual({ type: "block", band: "mid" });
  });

  it("blocks a read low attack on reaction", () => {
    const action = runTick(
      jabber,
      state({ opponent: { attackBand: 1, distance: 200000 } }),
      {},
      CANONICAL_RULES,
    );

    expect(action).toEqual({ type: "block", band: "low" });
  });

  it("still jabs in close when unthreatened — the pressure core is intact", () => {
    const action = runTick(
      jabber,
      state({ opponent: { distance: 150000 } }),
      {},
      CANONICAL_RULES,
    );

    expect(action).toEqual({
      type: "attack",
      move: "kizami-zuki",
      band: "mid",
    });
  });

  it("advances when out of range and unthreatened", () => {
    const action = runTick(
      jabber,
      state({ opponent: { distance: 300000 } }),
      {},
      CANONICAL_RULES,
    );

    expect(action).toEqual({ type: "move", dir: 1 });
  });

  it("idles when it cannot act (recovery/hitstun)", () => {
    const action = runTick(
      jabber,
      state({ self: { canAct: false } }),
      {},
      CANONICAL_RULES,
    );

    expect(action).toEqual({ type: "idle" });
  });
});
