import { describe, it, expect } from "vitest";
import { runFight, renderTape, type FightConfig } from "./sim.js";
import type { BotDoc } from "./dsl.js";
import type { Rules, Action, Band, MoveId } from "./types.js";

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
      attackMove: "gyaku-zuki",
      attackPhase: 1, // commit tick renders elapsed 1, inside startup 4 ⇒ winding up
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

// ─── attackMove / attackPhase ────────────────────────────────────────────────
// Which technique a fighter committed to, and which phase of it a frame shows. Render-only
// (like `guardBand` / `attackReach`): the viewer picks a per-move pose; resolution never reads
// either field.
//
// TIMING NOTE — a rendered frame's `elapsed` is ALREADY ADVANCED. The tick order is
// resolve → advance (sim.ts:1369) → render (sim.ts:1414), so the commit tick renders
// `elapsed: 1`, and a move's rendered `elapsed` equals `tick + 1` for its whole commitment.
// Phase is derived from that rendered value with the engine's OWN active-window inequality
// (sim.ts:802-803): `elapsed < startup ⇒ 1`, `elapsed < startup + active ⇒ 2`, else `3`.
// The consequence is deliberate: the FIRST contact tick still renders phase 2 (a strike's
// `scored` flag latches on first contact), and an air strike's landing park at
// `elapsed = startup + active` (sim.ts:1049) correctly reads phase 3 (recovery).

// Commits `move` on exactly one tick, idling otherwise — so the strike's later frames carry an
// IDLE live action while the fighter is still committed. Proves the id comes from the committed
// STATE, not the live action (the same property the attackReach suite pins for reach).
const attackAtTick = (tick: number, move: MoveId, band: Band = "mid"): BotDoc =>
  bot({ type: "idle" }, [
    {
      when: {
        op: "eq",
        args: [
          { op: "field", path: "clock.tick" },
          { op: "const", value: tick },
        ],
      },
      do: { type: "attack", move, band },
    },
  ]);

const SWEEPER = bot({ type: "sweep" });

// Jumps the instant it is free, then air-strikes with a REAL air technique (`tobi-geri`), so
// the emitted id proves the air-attacking branch reads its own committed move.
const TOBI = bot({ type: "attack", move: "tobi-geri", band: "mid" }, [
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

const GYAKU: Rules["moves"]["gyaku-zuki"] = {
  startup: 4,
  active: 2,
  recovery: 6,
  score: 1,
  reach: 250000,
};

describe("renderTape — attackMove (the committed technique's id)", () => {
  it("names the committed move through the whole strike, even on frames whose live action is idle", () => {
    const tape = renderTape(
      getMockConfig({ botA: attackAtTick(0, "gyaku-zuki"), botB: IDLE }),
    );

    const committed = tape.filter((t) => t.a.attacking);

    expect(committed.length).toBeGreaterThan(0);
    expect(committed.every((t) => t.a.attackMove === "gyaku-zuki")).toBe(true);
  });

  it("names the move actually committed — a different move reads a different id", () => {
    // Two different moves through the same path: kills a hardcoded id at the commit site.
    const rules = getMockRules({
      moves: { "gyaku-zuki": GYAKU, "mae-geri": { ...GYAKU, score: 2 } },
    });

    expect(
      renderTape(
        getMockConfig({ rules, botA: attackAtTick(0, "mae-geri"), botB: IDLE }),
      )[0].a.attackMove,
    ).toBe("mae-geri");
    expect(
      renderTape(
        getMockConfig({
          rules,
          botA: attackAtTick(0, "gyaku-zuki"),
          botB: IDLE,
        }),
      )[0].a.attackMove,
    ).toBe("gyaku-zuki");
  });

  it("names a sweep `sweep` and a throw `throw` — the two non-MoveId techniques", () => {
    const sweepTape = renderTape(
      getMockConfig({
        rules: getMockRules({
          moves: { "gyaku-zuki": GYAKU, sweep: { ...GYAKU, score: 0 } },
          knockdownDuration: 5,
        }),
        botA: SWEEPER,
        botB: IDLE,
      }),
    );

    expect(sweepTape[0].a.attacking).toBe(true);
    expect(sweepTape[0].a.attackMove).toBe("sweep");

    const throwTape = renderTape(
      getMockConfig({
        rules: getMockRules({
          throw: {
            startup: 4,
            active: 3,
            recovery: 3,
            reach: 250000,
            score: 3,
          },
          knockdownDuration: 5,
        }),
        botA: THROW,
        botB: IDLE,
      }),
    );

    expect(throwTape[0].a.throwing).toBe(true);
    expect(throwTape[0].a.attackMove).toBe("throw");
  });

  it("names an air technique while airborne, and keeps naming it through the grounded landing recovery", () => {
    // Landing is master: an air-attacking state converts to a grounded `attacking` state parked
    // at the start of recovery (sim.ts:1040-1052) — a FIFTH construction site. The committed id
    // must survive that conversion, or a landed tobi-geri loses its identity mid-recovery.
    const rules = getMockRules({
      jumpImpulse: 24000,
      gravity: 6000,
      lowClearance: 10000,
      moves: {
        "gyaku-zuki": GYAKU,
        "tobi-geri": {
          ...GYAKU,
          startup: 2,
          active: 3,
          recovery: 8,
          air: true,
        },
      },
    });

    const tape = renderTape(
      getMockConfig({ rules, botA: TOBI, botB: IDLE, maxTicks: 20 }),
    );

    // Airborne AND attacking ⇒ the air-attacking state specifically.
    expect(
      tape.some(
        (t) =>
          t.a.posture === 2 && t.a.attacking && t.a.attackMove === "tobi-geri",
      ),
    ).toBe(true);

    // Back on the ground (y === 0) and still committed ⇒ the landing recovery.
    const landed = tape.filter(
      (t) => t.a.attacking && t.a.y === 0 && t.tick > 0,
    );

    expect(landed.length).toBeGreaterThan(0);
    expect(landed.every((t) => t.a.attackMove === "tobi-geri")).toBe(true);
  });

  it("renames the move when an on-contact cancel interrupts into a follow-up", () => {
    // The cancel path is its own commit site (sim.ts:599). An opener that CONNECTS opens the
    // cancel window; cancelling into a DIFFERENT move must re-name the frame — kills both a
    // hardcoded id and a "keep the original move" implementation at that site.
    const rules = getMockRules({
      startGap: 200000, // inside reach ⇒ the opener connects and opens the window
      cancelWindow: 10,
      moves: {
        "gyaku-zuki": { ...GYAKU, cancelInto: ["mae-geri"] },
        "mae-geri": { ...GYAKU, score: 2 },
      },
    });

    const botA = bot({ type: "idle" }, [
      {
        when: {
          op: "eq",
          args: [
            { op: "field", path: "clock.tick" },
            { op: "const", value: 0 },
          ],
        },
        do: { type: "attack", move: "gyaku-zuki", band: "mid" },
      },
      {
        when: {
          op: "eq",
          args: [
            { op: "field", path: "clock.tick" },
            { op: "const", value: 6 },
          ],
        },
        do: { type: "attack", move: "mae-geri", band: "mid" },
      },
    ]);

    const tape = renderTape(
      getMockConfig({ rules, botA, botB: IDLE, maxTicks: 16 }),
    );

    expect(tape[0].a.attackMove).toBe("gyaku-zuki"); // the opener
    expect(tape[6].a.attackMove).toBe("mae-geri"); // cancelled into the follow-up
  });

  it("names nothing for a fighter that is neutral, merely airborne, or knocked down", () => {
    const idle = renderTape(getMockConfig({ botA: IDLE, botB: IDLE }));

    expect(
      idle.every(
        (t) => t.a.attackMove === "" && t.a.attackPhase === 0 && !t.a.attacking,
      ),
    ).toBe(true);

    // A jumper that never strikes: airborne is a committed state, but not an ATTACK.
    const jump = renderTape(
      getMockConfig({
        rules: getMockRules({
          jumpImpulse: 24000,
          gravity: 6000,
          lowClearance: 10000,
        }),
        botA: JUMP,
        botB: IDLE,
      }),
    );

    const aloft = jump.filter((t) => t.a.posture === 2);

    expect(aloft.length).toBeGreaterThan(0);
    expect(
      aloft.every((t) => t.a.attackMove === "" && t.a.attackPhase === 0),
    ).toBe(true);

    // The thrown defender: downed carries no technique of its own.
    const thrown = renderTape(
      getMockConfig({
        rules: getMockRules({
          throw: {
            startup: 1,
            active: 3,
            recovery: 3,
            reach: 250000,
            score: 3,
          },
          knockdownDuration: 5,
        }),
        botA: THROW,
        botB: IDLE,
      }),
    );

    const downed = thrown.filter((t) => t.b.knockdown);

    expect(downed.length).toBeGreaterThan(0);
    expect(
      downed.every((t) => t.b.attackMove === "" && t.b.attackPhase === 0),
    ).toBe(true);
  });
});

describe("renderTape — attackPhase (startup / active / recovery)", () => {
  // startup 7, active 3, recovery 6 (total 16). Rendered `elapsed` is `tick + 1`, so:
  //   ticks 0–5 ⇒ elapsed 1–6  ⇒ phase 1 (startup)
  //   ticks 6–8 ⇒ elapsed 7–9  ⇒ phase 2 (active)
  //   ticks 9–14 ⇒ elapsed 10–15 ⇒ phase 3 (recovery)
  // The fighters start OUT OF RANGE so the strike whiffs — timing is isolated from contact.
  const phaseRules = (): Rules =>
    getMockRules({
      startGap: 400000, // beyond reach (250000) ⇒ no contact, no cancel window, no score
      moves: {
        "gyaku-zuki": {
          startup: 7,
          active: 3,
          recovery: 6,
          score: 1,
          reach: 250000,
        },
      },
    });

  const phaseTape = () =>
    renderTape(
      getMockConfig({
        rules: phaseRules(),
        botA: attackAtTick(0, "gyaku-zuki"),
        botB: IDLE,
        maxTicks: 16,
      }),
    );

  it("winds up, extends, then recovers — switching phase exactly on the frame boundaries", () => {
    const tape = phaseTape();

    // Both boundaries asserted from BOTH sides: these four pin the `<` / `>=` comparisons and
    // are what a `<`-to-`<=` mutant on either inequality has to survive.
    expect(tape[5].a.attackPhase).toBe(1); // elapsed 6 — last startup frame
    expect(tape[6].a.attackPhase).toBe(2); // elapsed 7 — first active frame
    expect(tape[8].a.attackPhase).toBe(2); // elapsed 9 — last active frame
    expect(tape[9].a.attackPhase).toBe(3); // elapsed 10 — first recovery frame
  });

  it("reads a phase on every committed frame and none once the move ends", () => {
    const tape = phaseTape();

    expect(
      tape.every((t) =>
        t.a.attacking
          ? t.a.attackPhase >= 1 && t.a.attackPhase <= 3
          : t.a.attackPhase === 0,
      ),
    ).toBe(true);

    // The move runs out during the window: the last tick is free again (total 16 frames, and a
    // rendered `elapsed` of 16 releases the state) — so phase 0 is genuinely reached.
    expect(tape[15].a.attacking).toBe(false);
    expect(tape[15].a.attackPhase).toBe(0);
  });

  it("winds up, grabs, then recovers on the THROW's own frame table", () => {
    // A throw's phase comes from `rules.throw` (startup 4 / active 3 / recovery 3) — a different
    // table from the moves one — so the grab reads extended exactly on its grab-active ticks.
    const tape = renderTape(
      getMockConfig({
        rules: getMockRules({
          throw: {
            startup: 4,
            active: 3,
            recovery: 3,
            reach: 250000,
            score: 3,
          },
          knockdownDuration: 5,
        }),
        botA: THROW,
        botB: IDLE,
        maxTicks: 12,
      }),
    );

    expect(tape[3].a.throwing).toBe(true); // it is the grab being phased, not a strike
    expect(tape[2].a.attackPhase).toBe(1); // elapsed 3 — still winding up
    expect(tape[3].a.attackPhase).toBe(2); // elapsed 4 — the grab goes live
    expect(tape[5].a.attackPhase).toBe(2); // elapsed 6 — last grab-active frame
    expect(tape[6].a.attackPhase).toBe(3); // elapsed 7 — recovering
  });

  it("phases an air technique while it is still airborne", () => {
    // The air-attacking state runs its own move clock mid-arc, so an air strike must read a real
    // phase BEFORE it lands — otherwise the viewer draws a jumping kick frozen at stance.
    const rules = getMockRules({
      jumpImpulse: 24000,
      gravity: 6000,
      lowClearance: 10000,
      moves: {
        "gyaku-zuki": GYAKU,
        "tobi-geri": {
          ...GYAKU,
          startup: 2,
          active: 3,
          recovery: 8,
          air: true,
        },
      },
    });

    const tape = renderTape(
      getMockConfig({ rules, botA: TOBI, botB: IDLE, maxTicks: 20 }),
    );

    const aloftStriking = tape.filter(
      (t) => t.a.posture === 2 && t.a.attacking,
    );

    expect(aloftStriking.length).toBeGreaterThan(0);
    expect(
      aloftStriking.every((t) => t.a.attackPhase >= 1 && t.a.attackPhase <= 3),
    ).toBe(true);
    // The kick genuinely extends mid-air rather than landing still winding up.
    expect(aloftStriking.some((t) => t.a.attackPhase === 2)).toBe(true);
  });

  it("holds the recovery pose longer when a parry extends it, without a fourth phase", () => {
    // A parried strike accrues `extra` recovery ticks (sim.ts:166). Phase derivation's ELSE
    // branch absorbs them (M5), so the tail stays phase 3 rather than inventing a new code.
    const rules = getMockRules({
      startGap: 200000, // in range ⇒ the mid guard can parry
      moves: { "gyaku-zuki": GYAKU },
    });

    const tape = renderTape(
      getMockConfig({
        rules,
        botA: attackAtTick(0, "gyaku-zuki"),
        botB: BLOCK_MID,
        maxTicks: 20,
      }),
    );

    const tail = tape.filter((t) => t.a.attacking && t.a.attackPhase !== 1);

    expect(tail.length).toBeGreaterThan(0);
    expect(
      tail.every((t) => t.a.attackPhase === 2 || t.a.attackPhase === 3),
    ).toBe(true);
  });
});
