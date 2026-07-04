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

// The real zoner gauntlet document — a range-gated spacer. Post S2 it extends its
// descending-range kick ladder BEYOND neutral: `yoko-geri` (reach 315k, gated
// 310k–320k) and `ushiro-geri` (reach 330k, gated 320k–330k) — the top of the
// range, past even its own roundhouse (300k). The bands are DELIBERATELY narrow:
// these slow, punishable kicks have no healthy niche in the frozen matchups (firing
// them broadly cost zoner its vulture matchup), so they are gated to the sliver of
// spacings that almost never arises in a fight — genuinely reachable + reference the
// two moves (coverage) while leaving the v12 calibration untouched. These tests pin
// zoner's DECISION contract (state → action) through the public interpreter. zoner
// is DATA; its behaviour is the action it emits.
const zoner = loadBotDoc(
  readFileSync(
    fileURLToPath(new URL("../../bots/zoner.json", import.meta.url)),
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

describe("zoner — beyond-neutral long-kick zoning", () => {
  it("fires ushiro-geri high in its 320k–330k band", () => {
    // 325000: past even the roundhouse (300k). The old zoner had no rule here and
    // walked forward; now it thrusts the longest kick (jodan ippon reach 330k).
    const action = runTick(
      zoner,
      state({ opponent: { distance: 325000 } }),
      {},
      CANONICAL_RULES,
    );

    expect(action).toEqual({
      type: "attack",
      move: "ushiro-geri",
      band: "high",
    });
  });

  it("fires yoko-geri mid in its 310k–320k band", () => {
    const action = runTick(
      zoner,
      state({ opponent: { distance: 315000 } }),
      {},
      CANONICAL_RULES,
    );

    expect(action).toEqual({ type: "attack", move: "yoko-geri", band: "mid" });
  });

  it("still opens with the roundhouse at exactly 300k — the yoko gate is strictly >300k", () => {
    const action = runTick(
      zoner,
      state({ opponent: { distance: 300000 } }),
      {},
      CANONICAL_RULES,
    );

    expect(action).toEqual({
      type: "attack",
      move: "mawashi-geri",
      band: "high",
    });
  });

  it("uses yoko-geri at the 320k upper edge (inclusive), ushiro just past it", () => {
    const atEdge = runTick(
      zoner,
      state({ opponent: { distance: 320000 } }),
      {},
      CANONICAL_RULES,
    );

    const pastEdge = runTick(
      zoner,
      state({ opponent: { distance: 321000 } }),
      {},
      CANONICAL_RULES,
    );

    expect(atEdge).toEqual({ type: "attack", move: "yoko-geri", band: "mid" });
    expect(pastEdge).toEqual({
      type: "attack",
      move: "ushiro-geri",
      band: "high",
    });
  });

  it("keeps its mid-range front kick — the long kicks do not cannibalise the ladder", () => {
    const action = runTick(
      zoner,
      state({ opponent: { distance: 250000 } }),
      {},
      CANONICAL_RULES,
    );

    expect(action).toEqual({ type: "attack", move: "mae-geri", band: "mid" });
  });

  it("retreats rather than attempting an unaffordable long kick when gassed (with room behind)", () => {
    // A gassed zoner (stamina at/below the gas line) cannot afford the gas-LOCKED
    // long kicks (cost 48/52). The gassed-retreat rule sits ABOVE the new kicks, so
    // even at 325000 (an ushiro band) it backs off instead of degrading to idle —
    // PROVIDED it has room behind it (self.x safely inside the ring; see ring-aware
    // tests below).
    const action = runTick(
      zoner,
      state({ self: { gassed: 1, x: 300000 }, opponent: { distance: 325000 } }),
      {},
      CANONICAL_RULES,
    );

    expect(action).toEqual({ type: "move", dir: -1 });
  });

  // ── Ring-awareness (v15 jogai adoption): both retreat rules gate on `self.x`
  // being inside the safe band (110000, 490000) — a near-edge boundary read — so
  // the zoner never back-pedals itself out of the ring (jogai). Near a wall it
  // falls through to its offense instead.
  it("retreats from a crowding opponent when it has room behind (mid-ring)", () => {
    const action = runTick(
      zoner,
      state({ self: { x: 300000 }, opponent: { distance: 100000 } }),
      {},
      CANONICAL_RULES,
    );

    expect(action).toEqual({ type: "move", dir: -1 });
  });

  it("is ring-aware: cornered against its back wall it fights instead of backing out", () => {
    // self.x = 105000 lies in the near-edge zone (just inside margin 100000); the
    // close-retreat rule's `self.x > 110000` guard is false, so it is suppressed and
    // the zoner falls through to its point-blank gyaku-zuki (dist ≤ 240k) — a boundary
    // decision that keeps it in bounds rather than ringing itself out.
    const action = runTick(
      zoner,
      state({ self: { x: 105000 }, opponent: { distance: 100000 } }),
      {},
      CANONICAL_RULES,
    );

    expect(action).toEqual({ type: "attack", move: "gyaku-zuki", band: "mid" });
  });
});
