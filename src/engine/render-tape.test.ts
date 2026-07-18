import { describe, it, expect } from "vitest";
import { runFight, renderTape, type FightConfig } from "./sim.js";
import type { BotDoc } from "./dsl.js";
import type { Rules, Action } from "./types.js";

// ─── factories ───────────────────────────────────────────────────────────────
const bot = (dflt: Action, rules: BotDoc["rules"] = []): BotDoc => ({
  version: 1,
  name: "b",
  model: "test",
  rules,
  default: dflt,
});

const IDLE = bot({ type: "idle" });
const ADVANCE = bot({ type: "move", dir: 1 });
const ATTACK_MID = bot({ type: "attack", move: "gyaku-zuki", band: "mid" });
const CROUCH = bot({ type: "crouch" });
const JUMP = bot({ type: "jump", dir: 0 });
const THROW = bot({ type: "throw" });
const BLOCK_LOW = bot({ type: "block", band: "low" });
const BLOCK_MID = bot({ type: "block", band: "mid" });
const BLOCK_HIGH = bot({ type: "block", band: "high" });

// Jumps the instant it is free (grounded, neutral), then — committed mid-air — its default
// air-strikes: an `attack` on an `air:true` move is the airborne exception to commitment, so
// the fighter enters the `air-attacking` state. Exercises the render frame's air-strike pose.
const AIR_STRIKER = bot({ type: "attack", move: "gyaku-zuki", band: "mid" }, [
  {
    when: {
      op: "eq",
      args: [
        { op: "field", path: "self.canAct" },
        { op: "const", value: 1 },
      ],
    },
    do: { type: "jump", dir: 0 },
  },
]);

// Strikes the instant it is free (grounded, neutral), then returns its IDLE default while
// committed — so the strike's active/recovery frames carry an idle LIVE action even though the
// fighter is still `attacking`. Exercises "reach comes from the committed state, not the action".
const STRIKE_ONCE = bot({ type: "idle" }, [
  {
    when: {
      op: "eq",
      args: [
        { op: "field", path: "self.canAct" },
        { op: "const", value: 1 },
      ],
    },
    do: { type: "attack", move: "gyaku-zuki", band: "mid" },
  },
]);

const getMockRules = (o: Partial<Rules> = {}): Rules => ({
  tickRate: 60,
  walkSpeed: 4000,
  ring: { width: 600000 },
  startGap: 200000,
  moves: {
    "gyaku-zuki": {
      startup: 4,
      active: 2,
      recovery: 6,
      score: 1,
      reach: 250000,
    },
  },
  ...o,
});

const getMockConfig = (o: Partial<FightConfig> = {}): FightConfig => ({
  rules: getMockRules(),
  botA: ATTACK_MID,
  botB: IDLE,
  maxTicks: 10,
  seed: 1,
  ...o,
});

const aStartX = (r: Rules): number =>
  Math.trunc((r.ring.width - r.startGap) / 2);

describe("renderTape — per-tick render state for the viewer", () => {
  it("emits one entry per executed tick, each carrying both fighters", () => {
    const tape = renderTape(getMockConfig({ maxTicks: 10 }));

    expect(tape).toHaveLength(10);
    expect(tape[0].tick).toBe(0);
    expect(tape[9].tick).toBe(9);
    expect(tape[0]).toHaveProperty("a");
    expect(tape[0]).toHaveProperty("b");
  });

  it("surfaces the striking pose the thin events tape cannot show", () => {
    // A commits a mid gyaku-zuki on tick 0 while B idles. Stamina is configured so
    // the meter reads a real (non-sentinel) value after the commit spend.
    const rules = getMockRules({
      stamina: { max: 100, regen: 10 },
      moves: {
        "gyaku-zuki": {
          startup: 4,
          active: 2,
          recovery: 6,
          score: 1,
          reach: 250000,
          staminaCost: 20,
        },
      },
    });

    const tape = renderTape(
      getMockConfig({ rules, botA: ATTACK_MID, botB: IDLE }),
    );

    // The attacker: committed to a mid strike, grounded, facing right, at its start X.
    expect(tape[0].a).toEqual({
      x: aStartX(rules),
      y: 0,
      facing: 1,
      posture: 0, // standing
      attacking: true,
      attackBand: 2, // mid
      guardBand: 0, // committed to a strike ⇒ not guarding
      throwing: false,
      attackReach: 250000, // gyaku-zuki reach
      knockdown: false,
      points: 0,
      stamina: 80, // 100 − 20 spent on commit, no regen while committed
    });

    // The idle defender: neutral, facing left.
    expect(tape[0].b.attacking).toBe(false);
    expect(tape[0].b.attackBand).toBe(0);
    expect(tape[0].b.posture).toBe(0);
    expect(tape[0].b.facing).toBe(-1);
  });

  it("shows a crouching posture", () => {
    const tape = renderTape(getMockConfig({ botA: CROUCH, botB: IDLE }));

    expect(tape[0].a.posture).toBe(1); // crouching
  });

  it("shows an airborne posture lifting off the ground", () => {
    // `lowClearance` is the height at which the arc reads as `airborne` posture (it has
    // cleared the low band); below it the jumper is still grounded for occupancy.
    const rules = getMockRules({
      jumpImpulse: 24000,
      gravity: 6000,
      lowClearance: 10000,
    });

    const tape = renderTape(getMockConfig({ rules, botA: JUMP, botB: IDLE }));

    expect(tape.some((t) => t.a.posture === 2 && t.a.y > 0)).toBe(true);
  });

  it("shows an air strike as attacking at its band while airborne", () => {
    // An `air:true` move lets an airborne fighter commit a strike (the air-attacking state) —
    // the render frame must still read attacking at its band, distinctly from a grounded strike.
    const rules = getMockRules({
      jumpImpulse: 24000,
      gravity: 6000,
      lowClearance: 10000,
      moves: {
        "gyaku-zuki": {
          startup: 2,
          active: 3,
          recovery: 4,
          score: 2,
          reach: 250000,
          air: true,
        },
      },
    });

    const tape = renderTape(
      getMockConfig({ rules, botA: AIR_STRIKER, botB: IDLE }),
    );

    // Airborne (posture 2) AND attacking mid (band 2) ⇒ the air-attacking state specifically.
    expect(
      tape.some(
        (t) => t.a.posture === 2 && t.a.attacking && t.a.attackBand === 2,
      ),
    ).toBe(true);

    // Posture is coherent with the resolved (post-advance) height: an airborne posture
    // never appears at ground level (it would, if posture were the stale pre-intake value
    // carried into the landing tick).
    expect(tape.every((t) => !(t.a.posture === 2 && t.a.y === 0))).toBe(true);
  });

  it("shows a thrower grabbing and its target knocked down", () => {
    const rules = getMockRules({
      throw: { startup: 1, active: 3, recovery: 3, reach: 250000, score: 3 },
      knockdownDuration: 5,
    });

    const tape = renderTape(getMockConfig({ rules, botA: THROW, botB: IDLE }));

    expect(tape.some((t) => t.a.throwing)).toBe(true);
    expect(tape.some((t) => t.b.knockdown)).toBe(true);
  });

  it("emits the band code of the guard a neutral fighter raises", () => {
    // A raises a fixed-band block each tick (block keeps it neutral, so it re-guards
    // every tick); B idles. The guard reads as the raised band's code — low 1 / mid 2 /
    // high 3 — distinctly, and the non-guarding idler reads 0.
    const guardOf = (blocker: BotDoc): number =>
      renderTape(getMockConfig({ botA: blocker, botB: IDLE }))[0].a.guardBand;

    expect(guardOf(BLOCK_LOW)).toBe(1);
    expect(guardOf(BLOCK_MID)).toBe(2);
    expect(guardOf(BLOCK_HIGH)).toBe(3);

    // The idle defender guards nothing.
    const tape = renderTape(getMockConfig({ botA: BLOCK_MID, botB: IDLE }));

    expect(tape[0].b.guardBand).toBe(0);
  });

  it("reads no guard for an attacker while its neutral opponent blocks", () => {
    // A commits a mid strike (the `attacking` state, not neutral) while B blocks mid.
    // A committed fighter cannot guard, so its guardBand is 0 even mid-strike; B's stays 2.
    const tape = renderTape(
      getMockConfig({ botA: ATTACK_MID, botB: BLOCK_MID }),
    );

    expect(tape[0].a.attacking).toBe(true);
    expect(tape[0].a.guardBand).toBe(0);
    expect(tape[0].b.guardBand).toBe(2);
  });

  it("tracks an advancing fighter's position moving toward centre", () => {
    const rules = getMockRules();

    const tape = renderTape(
      getMockConfig({ rules, botA: ADVANCE, botB: IDLE }),
    );

    // A starts left of centre and walks right, so its x strictly increases early on.
    expect(tape[1].a.x).toBeGreaterThan(tape[0].a.x);
  });

  it("agrees with runFight on the final score, winner, and tick count", () => {
    const cfg = getMockConfig({ botA: ATTACK_MID, botB: IDLE });
    const tape = renderTape(cfg);
    const result = runFight(cfg);

    const last = tape[tape.length - 1];
    expect(last.a.points).toBe(result.scores.a);
    expect(last.b.points).toBe(result.scores.b);
    expect(tape).toHaveLength(result.ticks);
    // A cleanly lands the strike on an idle, unguarded defender, so it scores.
    expect(result.scores.a).toBeGreaterThan(0);
  });
});

describe("renderTape — attackReach (the committed action's reach)", () => {
  it("reports a grounded strike's move reach, and 0 for the idle defender", () => {
    const tape = renderTape(getMockConfig({ botA: ATTACK_MID, botB: IDLE }));

    expect(tape[0].a.attackReach).toBe(250000); // gyaku-zuki reach
    expect(tape[0].b.attackReach).toBe(0); // idle ⇒ no reach
  });

  it("reports the committed move's reach through the whole strike — even on recovery frames whose live action is idle", () => {
    // STRIKE_ONCE fires only when free (tick 0); once committed it returns its idle default, so the
    // strike's later frames carry an IDLE live action while the fighter is still `attacking`. The
    // reach must come from the committed `state.spec`, not the live action — so EVERY attacking
    // frame reads the move's reach (kills a "read reach from the live action" implementation).
    const tape = renderTape(getMockConfig({ botA: STRIKE_ONCE, botB: IDLE }));

    expect(tape.every((t) => t.a.attacking)).toBe(true); // committed the whole window
    expect(tape.every((t) => t.a.attackReach === 250000)).toBe(true);
  });

  it("reports an air strike's move reach while airborne", () => {
    const rules = getMockRules({
      jumpImpulse: 24000,
      gravity: 6000,
      lowClearance: 10000,
      moves: {
        "gyaku-zuki": {
          startup: 2,
          active: 3,
          recovery: 4,
          score: 2,
          reach: 250000,
          air: true,
        },
      },
    });

    const tape = renderTape(
      getMockConfig({ rules, botA: AIR_STRIKER, botB: IDLE }),
    );

    expect(
      tape.some(
        (t) => t.a.posture === 2 && t.a.attacking && t.a.attackReach === 250000,
      ),
    ).toBe(true);
  });

  it("reports the throw's grab reach on a throwing frame — not a move reach", () => {
    // throw.reach (120000) is distinct from the move reach (250000), so a throwing frame reading
    // 120000 proves the reach came from the THROW spec, not the moves table.
    const rules = getMockRules({
      throw: { startup: 1, active: 3, recovery: 3, reach: 120000, score: 3 },
      knockdownDuration: 5,
    });

    const tape = renderTape(getMockConfig({ rules, botA: THROW, botB: IDLE }));

    expect(tape.some((t) => t.a.throwing && t.a.attackReach === 120000)).toBe(
      true,
    );
    // The idle defender never throws: even with a throw CONFIGURED in the rules, a non-throwing
    // frame reads 0 — the throw reach must not leak onto a fighter that is merely idle (kills the
    // "any non-strike frame ⇒ throw reach" mutant).
    expect(tape.every((t) => t.b.attackReach === 0)).toBe(true);
  });

  it("reports 0 reach for a fighter that never commits an action", () => {
    const tape = renderTape(getMockConfig({ botA: IDLE, botB: IDLE }));

    expect(
      tape.every((t) => t.a.attackReach === 0 && t.b.attackReach === 0),
    ).toBe(true);
  });
});
