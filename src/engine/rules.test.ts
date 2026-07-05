import { describe, it, expect } from "vitest";
import { runFight, type FightConfig, type FightEvent } from "./sim.js";
import type { BotDoc, BoolExpr } from "./dsl.js";
import type {
  Rules,
  Band,
  Action,
  MoveSpec,
  ThrowSpec,
  MoveId,
} from "./types.js";
import { CANONICAL_RULES } from "./rules.js";

// ─── bot fixtures (mirroring the engine-test helpers — fixtures, not shared knowledge) ──
const bot = (rules: BotDoc["rules"], dflt: Action): BotDoc => ({
  version: 1,
  name: "b",
  rules,
  default: dflt,
});

const IDLE = bot([], { type: "idle" });

// Commits exactly one strike (at the given band) on the first tick, then idles.
const strikeOnce = (band: Band): BotDoc => ({
  version: 1,
  name: "atk1",
  memory: { fired: 0 },
  rules: [
    {
      when: {
        op: "eq",
        args: [
          { op: "mem", cell: "fired" },
          { op: "const", value: 0 },
        ],
      },
      set: [{ cell: "fired", to: { op: "const", value: 1 } }],
      do: { type: "attack", move: "gyaku-zuki", band },
    },
  ],
  default: { type: "idle" },
});

// Mirrors the PERCEIVED incoming attack band into a same-band guard (3 ⇒ high,
// 2 ⇒ mid, 1 ⇒ low; 0 ⇒ idle). A pure read of the L_act-delayed opponent.attackBand.
const BAND_MIRROR: BotDoc = bot(
  [
    {
      when: {
        op: "eq",
        args: [
          { op: "field", path: "opponent.attackBand" },
          { op: "const", value: 3 },
        ],
      },
      do: { type: "block", band: "high" },
    },
    {
      when: {
        op: "eq",
        args: [
          { op: "field", path: "opponent.attackBand" },
          { op: "const", value: 2 },
        ],
      },
      do: { type: "block", band: "mid" },
    },
    {
      when: {
        op: "eq",
        args: [
          { op: "field", path: "opponent.attackBand" },
          { op: "const", value: 1 },
        ],
      },
      do: { type: "block", band: "low" },
    },
  ],
  { type: "idle" },
);

// ─── small expression helpers ────────────────────────────────────────────────
const clk = (op: "eq" | "gt" | "lt" | "gte" | "lte", n: number): BoolExpr => ({
  op,
  args: [
    { op: "field", path: "clock.tick" },
    { op: "const", value: n },
  ],
});

const all = (...args: BoolExpr[]): BoolExpr => ({ op: "and", args });

// Strikes `band` whenever free to act — so its recorded attack ticks reveal recovery
// length (the gap between strikes is how long it was committed).
const restrikeWhenFree = (band: Band): BotDoc =>
  bot(
    [
      {
        when: {
          op: "eq",
          args: [
            { op: "field", path: "self.canAct" },
            { op: "const", value: 1 },
          ],
        },
        do: { type: "attack", move: "gyaku-zuki", band },
      },
    ],
    { type: "idle" },
  );

// Blocks `band` from tick `from` onward — `from` sets the guard's age at the active frame.
const guardFrom = (from: number, band: Band): BotDoc =>
  bot([{ when: clk("gte", from), do: { type: "block", band } }], {
    type: "idle",
  });

// Crouches (vacating `high`) while tick < until, then stands — ducks a high opener's active
// frame yet stands later, so a wrongly-cancelled follow-up WOULD land (proving it doesn't).
const crouchUntil = (until: number): BotDoc =>
  bot([{ when: clk("lt", until), do: { type: "crouch" } }], { type: "idle" });

// Strikes `band` at each listed tick — a tick-0 opener plus later cancel attempts.
const strikeAtTicks = (ticks: number[], band: Band): BotDoc =>
  bot(
    ticks.map((t) => ({
      when: clk("eq", t),
      do: { type: "attack", move: "gyaku-zuki", band },
    })),
    { type: "idle" },
  );

// Strikes mid on every free tick (an attacker that gets parried, then sits in recovery).
const STRIKER = bot([], { type: "attack", move: "gyaku-zuki", band: "mid" });

// Parries with a fresh mid guard at `parryTick`, then throws a mid counter the next tick.
const parryThenCounter = (parryTick: number): BotDoc =>
  bot(
    [
      { when: clk("eq", parryTick), do: { type: "block", band: "mid" } },
      {
        when: clk("eq", parryTick + 1),
        do: { type: "attack", move: "gyaku-zuki", band: "mid" },
      },
    ],
    { type: "idle" },
  );

// The ticks a side started a fresh move (a gap between them is its recovery length).
const attackTicks = (events: FightEvent[], side: "a" | "b"): number[] =>
  events.flatMap((e, t) => (e[side].action.type === "attack" ? [t] : []));

// ─── lazy readers of the canonical numbers ────────────────────────────────────
// Read on call (inside tests/builders), never at module load — so a malformed table
// fails an assertion in a test rather than throwing at collection time.
const lAct = (): number => CANONICAL_RULES.perception?.lAct ?? 0;

const throwSpec = (): ThrowSpec => {
  const t = CANONICAL_RULES.throw;
  if (!t) throw new Error("CANONICAL_RULES.throw is not configured");

  return t;
};

const sweepSpec = (): MoveSpec => {
  const s = CANONICAL_RULES.moves.sweep;
  if (!s) throw new Error("CANONICAL_RULES.moves.sweep is not configured");

  return s;
};

const fight = (o: Partial<FightConfig> = {}): FightConfig => ({
  rules: CANONICAL_RULES,
  botA: IDLE,
  botB: IDLE,
  maxTicks: 60,
  seed: 1,
  ...o,
});

// The canonical table positioned inside strike range and de-jittered, so the read-game
// inequalities resolve deterministically (jitter's seed-dependence at the knife-edge is
// proven generically in perception.test.ts — here we pin the nominal-latency backbone).
const deterministic = (o: Partial<Rules> = {}): Rules => ({
  ...CANONICAL_RULES,
  startGap: 200000, // inside strike.reach (240000) ⇒ a strike can connect
  perception: { ...CANONICAL_RULES.perception, jitter: 0 },
  ...o,
});

const withStartup = (startup: number): Rules =>
  deterministic({
    moves: {
      ...CANONICAL_RULES.moves,
      "gyaku-zuki": { ...gyaku(), startup },
    },
  });

// Positioned inside GRAB range (closer than strike range) and de-jittered — the throw
// reach (120000) is shorter than the strike's, so the deterministic() gap (200000) is
// out of grab range; grab tests need the pair closer.
const grappleFight = (o: Partial<FightConfig> = {}): FightConfig =>
  fight({ rules: deterministic({ startGap: 100000 }), ...o });

const withThrowStartup = (startup: number): Rules =>
  deterministic({
    startGap: 100000, // within grab reach ⇒ a grab can connect or be broken
    throw: { ...throwSpec(), startup },
  });

// Positioned inside SWEEP range (180000) — between grab range and the deterministic() gap —
// and de-jittered, so an in-range sweep connects on a grounded target.
const sweepFight = (o: Partial<FightConfig> = {}): FightConfig =>
  fight({ rules: deterministic({ startGap: 150000 }), ...o });

// ─── C9 arsenal: lazy readers + bot builders for the four named techniques ──────
// Each reader throws if its technique is not configured — so a malformed table fails an
// assertion in a test, not at collection time (mirrors gyaku()/sweepSpec()).
const armed =
  (
    id:
      | "kizami-zuki"
      | "gyaku-zuki"
      | "mae-geri"
      | "mawashi-geri"
      | "uraken"
      | "shuto"
      | "yoko-geri"
      | "ushiro-geri"
      | "empi"
      | "hiza-geri"
      | "tobi-geri",
  ) =>
  (): MoveSpec => {
    const m = CANONICAL_RULES.moves[id];
    if (!m) throw new Error(`CANONICAL_RULES.moves['${id}'] is not configured`);

    return m;
  };

const kizami = armed("kizami-zuki"); // jab
const gyaku = armed("gyaku-zuki"); // reverse punch
const mae = armed("mae-geri"); // front kick
const mawashi = armed("mawashi-geri"); // roundhouse
const uraken = armed("uraken"); // backfist (Batch-1 expansion #1)
const shuto = armed("shuto"); // knife-hand (Batch-1 expansion #2)
const yoko = armed("yoko-geri"); // side kick (Batch-1 expansion #3)
const ushiro = armed("ushiro-geri"); // back kick (Batch-1 expansion #4)
const empi = armed("empi"); // elbow (Batch-1 expansion #5)
const hizaGeri = armed("hiza-geri"); // knee (Batch-1 expansion #6)

// Commits a single named technique at `band` on tick 0, then idles (generalizes strikeOnce).
const attackOnce = (move: MoveId, band: Band): BotDoc =>
  bot([{ when: clk("eq", 0), do: { type: "attack", move, band } }], {
    type: "idle",
  });

// Throws the listed techniques at the listed ticks — an opener plus its cancel attempts.
const comboAtTicks = (
  steps: { tick: number; move: MoveId; band: Band }[],
): BotDoc =>
  bot(
    steps.map((s) => ({
      when: clk("eq", s.tick),
      do: { type: "attack", move: s.move, band: s.band },
    })),
    { type: "idle" },
  );

describe("CANONICAL_RULES — structural shape", () => {
  it("scores a clean strike as a single WKF yuko", () => {
    expect(gyaku().score).toBe(1);
  });

  it("starts fighters outside strike range (must close to hit)", () => {
    expect(CANONICAL_RULES.startGap).toBeGreaterThan(gyaku().reach);
  });

  it("makes the strike reactable but only just (startup = lAct + 1)", () => {
    expect(gyaku().startup).toBe(lAct() + 1);
  });

  it("makes a whiff punishable (recovery ≥ lAct + startup)", () => {
    expect(gyaku().recovery).toBeGreaterThanOrEqual(lAct() + gyaku().startup);
  });

  it("ships a reaction-viable, jittered perception layer", () => {
    expect(CANONICAL_RULES.perception?.lPos).toBe(1);
    expect(CANONICAL_RULES.perception?.lAct).toBe(6);
    expect(CANONICAL_RULES.perception?.jitter).toBe(1);
  });
});

describe("CANONICAL_RULES — neutral game (start out of range)", () => {
  it("an idle pair never scores — the start gap exceeds strike reach", () => {
    const result = runFight(fight({ botA: IDLE, botB: IDLE }));
    expect(result.scores).toEqual({ a: 0, b: 0 });
  });

  it("a strike thrown from the start position whiffs — you must close before you can hit", () => {
    // strikeOnce fires at tick 0 from the full start gap (300000) with reach 240000 ⇒ out of range.
    const result = runFight(
      fight({ botA: strikeOnce("mid"), botB: IDLE, maxTicks: 30 }),
    );

    expect(result.scores.a).toBe(0);
  });
});

describe("CANONICAL_RULES — a clean strike scores", () => {
  it("scores exactly 1 against an undefended foe in range", () => {
    const result = runFight(
      fight({
        rules: deterministic(),
        botA: strikeOnce("mid"),
        botB: IDLE,
        maxTicks: 30,
      }),
    );

    expect(result.scores.a).toBe(1);
  });
});

describe("CANONICAL_RULES — the strike read-game (reactable iff startup ≥ lAct+1)", () => {
  // BAND_MIRROR reads the delayed attackBand and guards that height; strikeOnce commits the strike.
  // scores.b is the attacker's score: 0 ⇒ the guard read & blocked, 1 ⇒ the strike landed.
  const counterEats = (band: Band, startup: number): number =>
    runFight(
      fight({
        rules: withStartup(startup),
        botA: BAND_MIRROR,
        botB: strikeOnce(band),
        maxTicks: 40,
      }),
    ).scores.b;

  it("a band-reading guard blocks the canonical strike at either height (the read is load-bearing)", () => {
    expect(counterEats("high", gyaku().startup)).toBe(0);
    expect(counterEats("low", gyaku().startup)).toBe(0);
  });

  it("no single fixed-height guard could do this — a fixed mid guard eats the high strike", () => {
    const fixedMid = bot([], { type: "block", band: "mid" });

    const scoreB = runFight(
      fight({
        rules: withStartup(gyaku().startup),
        botA: fixedMid,
        botB: strikeOnce("high"),
        maxTicks: 40,
      }),
    ).scores.b;

    expect(scoreB).toBe(1);
  });

  it("one tick faster (startup = lAct) beats the same read — the tell arrives too late", () => {
    expect(counterEats("high", lAct())).toBe(1);
  });
});

describe("CANONICAL_RULES — a whiffed strike is punishable", () => {
  it("a high strike whiffed over a croucher is punished during its long recovery", () => {
    const S = gyaku().startup; // active window opens at elapsed = startup
    const A = gyaku().active;

    // Punisher: crouch through the attacker's active window (duck the high strike), then strike
    // into its recovery. recovery ≥ lAct + startup is what lets the reaction land before wake-up.
    const punisher = bot(
      [
        {
          when: all(clk("gte", S), clk("lte", S + A - 1)),
          do: { type: "crouch" },
        },
        {
          when: clk("eq", S + A),
          do: { type: "attack", move: "gyaku-zuki", band: "mid" },
        },
      ],
      { type: "idle" },
    );

    const result = runFight(
      fight({
        rules: deterministic(),
        botA: punisher,
        botB: strikeOnce("high"),
        maxTicks: 40,
      }),
    );

    expect(result.scores.b).toBe(0); // the high strike whiffed over the crouch
    expect(result.scores.a).toBe(1); // and was punished during recovery
  });
});

// ─── Slice 3: the strike's defensive answers (parry / counter / cancel / crouch) ──

describe("CANONICAL_RULES — parry deflects and punishes (C5)", () => {
  // Runs a re-striking attacker into a `from`-aged mid guard; reports when its 2nd strike starts
  // (a later tick = longer recovery) and whether it scored. Comparing across guard ages — never
  // against a config-derived constant — is what gives the parry numbers real teeth.
  const vsGuard = (from: number): { secondStrike: number; scoreA: number } => {
    const result = runFight(
      fight({
        rules: deterministic(),
        botA: restrikeWhenFree("mid"),
        botB: guardFrom(from, "mid"),
        maxTicks: 60,
      }),
    );

    return {
      secondStrike: attackTicks(result.events, "a")[1],
      scoreA: result.scores.a,
    };
  };

  it("a fresh matching guard parries — no score, and the attacker eats extra recovery", () => {
    const firstActive = gyaku().startup; // the active window opens at elapsed = startup
    const fresh = vsGuard(firstActive); // guard up on the active frame ⇒ age 1 ⇒ PARRY
    const stale = vsGuard(0); // held since tick 0 ⇒ stale ⇒ BLOCK

    expect(fresh.scoreA).toBe(0); // deflected — never scored
    expect(fresh.secondStrike).toBeGreaterThan(stale.secondStrike); // parry adds recovery
  });

  it("the parry window is tight: a guard one tick older only blocks", () => {
    // A guard raised at `from` has age (firstActive − from + 1) on the active frame. With
    // parryWindow 2: age 2 (from = firstActive−1) parries; age 3 (from = firstActive−2) blocks —
    // so the younger guard's attacker eats strictly more recovery only at exactly window 2.
    const firstActive = gyaku().startup;

    expect(vsGuard(firstActive - 1).secondStrike).toBeGreaterThan(
      vsGuard(firstActive - 2).secondStrike,
    );
  });
});

describe("CANONICAL_RULES — counter rewards the read (C5)", () => {
  it("a counter strike after a parry scores base + counterBonus (≈ waza-ari)", () => {
    const result = runFight(
      fight({
        rules: deterministic(),
        botA: STRIKER, // strikes mid, gets parried, sits in extended recovery
        botB: parryThenCounter(gyaku().startup), // parry on the active frame, counter next tick
        maxTicks: 40,
      }),
    );

    expect(result.scores).toEqual({ a: 0, b: 2 }); // base 1 + counterBonus 1
  });
});

describe("CANONICAL_RULES — on-contact cancel (C6 rekka, cross-move)", () => {
  it("a connecting reverse cancels into a different technique — two hits in one exchange", () => {
    // Opener gyaku-zuki at tick 0 connects on its active frame, opening the cancel window; a
    // follow-up `attack` one tick into recovery cancels into mawashi-geri (a real canonical route)
    // that also lands ⇒ score 3 (reverse 1 + roundhouse chudan 2). The retired `strike` had a
    // self-rekka route; the canonical reverse cancels into the kicks instead.
    const cancelTick = gyaku().startup + gyaku().active; // the first recovery frame

    const result = runFight(
      fight({
        rules: deterministic(),
        botA: comboAtTicks([
          { tick: 0, move: "gyaku-zuki", band: "mid" },
          { tick: cancelTick, move: "mawashi-geri", band: "mid" },
        ]),
        botB: IDLE,
        maxTicks: 40,
      }),
    );

    expect(result.scores.a).toBe(3); // opener + cancelled cross-move follow-up
  });

  it("a whiffed reverse never opens the cancel window (no feint)", () => {
    // The high opener whiffs over a croucher (never connects), so the cancel attempt is inert. The
    // croucher stands again from the cancel tick, so a wrongly-enabled cancel's follow-up WOULD
    // land — proving it does not.
    const cancelTick = gyaku().startup + gyaku().active;

    const result = runFight(
      fight({
        rules: deterministic(),
        botA: comboAtTicks([
          { tick: 0, move: "gyaku-zuki", band: "high" },
          { tick: cancelTick, move: "mawashi-geri", band: "mid" },
        ]),
        botB: crouchUntil(cancelTick),
        maxTicks: 40,
      }),
    );

    expect(result.scores.a).toBe(0); // whiff ⇒ no cancel ⇒ no follow-up
  });
});

describe("CANONICAL_RULES — crouch ducks a high strike (occupancy)", () => {
  it("a high canonical strike whiffs a croucher", () => {
    const result = runFight(
      fight({
        rules: deterministic(),
        botA: strikeOnce("high"),
        botB: crouchUntil(60), // crouches the whole fight ⇒ vacates high
        maxTicks: 30,
      }),
    );

    expect(result.scores.a).toBe(0);
  });
});

// ─── Batch-1 expansion #1: uraken (backfist) — the cheapest, shortest, high-only snap ──
describe("CANONICAL_RULES — uraken (the backfist: cheapest, shortest, high-only snap)", () => {
  it("scores a clean high backfist as a single yuko", () => {
    const result = runFight(
      fight({
        rules: deterministic({ startGap: 150000 }), // inside uraken reach (200000)
        botA: attackOnce("uraken", "high"),
        botB: IDLE,
        maxTicks: 30,
      }),
    );

    expect(result.scores.a).toBe(1);
  });

  it("fizzles at mid — the high-only band gate (unlike the high·mid punches)", () => {
    const result = runFight(
      fight({
        rules: deterministic({ startGap: 150000 }),
        botA: attackOnce("uraken", "mid"),
        botB: IDLE,
        maxTicks: 30,
      }),
    );

    expect(result.scores.a).toBe(0);
  });

  it("fizzles at low — the high-only band gate", () => {
    const result = runFight(
      fight({
        rules: deterministic({ startGap: 150000 }),
        botA: attackOnce("uraken", "low"),
        botB: IDLE,
        maxTicks: 30,
      }),
    );

    expect(result.scores.a).toBe(0);
  });

  it("has the shortest hand reach — whiffs at a gap where the jab still lands", () => {
    // A gap beyond uraken's reach (200000) but within the jab's (kizami 210000).
    const gap = { startGap: 205000 };

    const backfist = runFight(
      fight({
        rules: deterministic(gap),
        botA: attackOnce("uraken", "high"),
        botB: IDLE,
        maxTicks: 30,
      }),
    );

    const jab = runFight(
      fight({
        rules: deterministic(gap),
        botA: attackOnce("kizami-zuki", "high"),
        botB: IDLE,
        maxTicks: 30,
      }),
    );

    expect(backfist.scores.a).toBe(0); // out of the backfist's shorter reach
    expect(jab.scores.a).toBe(1); // …but inside the jab's
    expect(uraken().reach).toBeLessThan(kizami().reach);
  });

  it("is the cheapest commit and stays affordable when gassed (basic ≤ gas line)", () => {
    const gas = CANONICAL_RULES.stamina?.gasThreshold ?? 0;

    expect(uraken().staminaCost ?? 0).toBeLessThan(kizami().staminaCost ?? 0);
    expect(uraken().staminaCost ?? 0).toBeLessThanOrEqual(gas);
  });

  it("opens the rekka — a connecting backfist cancels into the reverse", () => {
    const cancelTick = uraken().startup + uraken().active; // the first recovery frame

    const result = runFight(
      fight({
        rules: deterministic({ startGap: 150000 }),
        botA: comboAtTicks([
          { tick: 0, move: "uraken", band: "high" },
          { tick: cancelTick, move: "gyaku-zuki", band: "high" },
        ]),
        botB: IDLE,
        maxTicks: 40,
      }),
    );

    expect(result.scores.a).toBe(2); // backfist 1 + cancelled reverse 1
    expect(uraken().cancelInto).toContain("gyaku-zuki");
  });

  it("stays reactable and whiff-punishable (the invariant floor)", () => {
    expect(uraken().startup).toBeGreaterThanOrEqual(lAct() + 1);
    expect(uraken().recovery).toBeGreaterThanOrEqual(lAct() + kizami().startup);
  });

  it("is a single-band high yuko (score 1, no jodan bonus)", () => {
    expect(uraken().score).toBe(1);
    expect(uraken().bands).toEqual(["high"]);
  });
});

// ─── Batch-1 expansion #2: shuto (knife-hand) — the longest hand, out-ranges the reverse ──
describe("CANONICAL_RULES — shuto (the knife-hand: longest hand, out-ranges the reverse)", () => {
  it("scores a clean high knife-hand as a single yuko", () => {
    const result = runFight(
      fight({
        rules: deterministic({ startGap: 150000 }), // inside shuto reach (260000)
        botA: attackOnce("shuto", "high"),
        botB: IDLE,
        maxTicks: 30,
      }),
    );

    expect(result.scores.a).toBe(1);
  });

  it("scores a clean mid knife-hand — the high·mid gate (unlike uraken's high-only)", () => {
    const result = runFight(
      fight({
        rules: deterministic({ startGap: 150000 }),
        botA: attackOnce("shuto", "mid"),
        botB: IDLE,
        maxTicks: 30,
      }),
    );

    expect(result.scores.a).toBe(1);
  });

  it("fizzles at low — outside the high·mid band gate", () => {
    const result = runFight(
      fight({
        rules: deterministic({ startGap: 150000 }),
        botA: attackOnce("shuto", "low"),
        botB: IDLE,
        maxTicks: 30,
      }),
    );

    expect(result.scores.a).toBe(0);
  });

  it("out-ranges the reverse — lands at a gap where gyaku-zuki whiffs", () => {
    // A gap beyond the reverse's reach (gyaku 240000) but within shuto's (260000).
    const gap = { startGap: 250000 };

    const knifeHand = runFight(
      fight({
        rules: deterministic(gap),
        botA: attackOnce("shuto", "high"),
        botB: IDLE,
        maxTicks: 30,
      }),
    );

    const reverse = runFight(
      fight({
        rules: deterministic(gap),
        botA: attackOnce("gyaku-zuki", "high"),
        botB: IDLE,
        maxTicks: 30,
      }),
    );

    expect(knifeHand.scores.a).toBe(1); // inside the knife-hand's longer reach
    expect(reverse.scores.a).toBe(0); // …but out of the reverse's
    expect(shuto().reach).toBeGreaterThan(gyaku().reach);
  });

  it("is the priciest gas-proof hand — dearer than jab and backfist, still ≤ the gas line", () => {
    const gas = CANONICAL_RULES.stamina?.gasThreshold ?? 0;

    expect(shuto().staminaCost ?? 0).toBeGreaterThan(kizami().staminaCost ?? 0);
    expect(shuto().staminaCost ?? 0).toBeGreaterThan(uraken().staminaCost ?? 0);
    expect(shuto().staminaCost ?? 0).toBeLessThanOrEqual(gas);
  });

  it("opens the rekka — a connecting knife-hand cancels into the reverse", () => {
    const cancelTick = shuto().startup + shuto().active; // the first recovery frame

    const result = runFight(
      fight({
        rules: deterministic({ startGap: 150000 }),
        botA: comboAtTicks([
          { tick: 0, move: "shuto", band: "high" },
          { tick: cancelTick, move: "gyaku-zuki", band: "high" },
        ]),
        botB: IDLE,
        maxTicks: 40,
      }),
    );

    expect(result.scores.a).toBe(2); // knife-hand 1 + cancelled reverse 1
    expect(shuto().cancelInto).toContain("gyaku-zuki");
  });

  it("stays reactable and whiff-punishable (the invariant floor)", () => {
    expect(shuto().startup).toBeGreaterThanOrEqual(lAct() + 1);
    expect(shuto().recovery).toBeGreaterThanOrEqual(lAct() + kizami().startup);
  });

  it("is a high·mid yuko (score 1, no jodan bonus)", () => {
    expect(shuto().score).toBe(1);
    expect(shuto().bands).toEqual(["high", "mid"]);
  });
});

// ─── Batch-1 expansion #3: yoko-geri (side kick) — the beyond-neutral zoning thrust ──
// Drains itself with the basic poke, then switches to the side kick the moment it reads
// GASSED — where the special (48 > gasThreshold 30) is unaffordable and degrades to idle,
// so the meter never floors past the band (the special lockout, proven for the new kick).
const DRAIN_THEN_YOKO: BotDoc = bot(
  [
    {
      when: {
        op: "eq",
        args: [
          { op: "field", path: "self.gassed" },
          { op: "const", value: 1 },
        ],
      },
      do: { type: "attack", move: "yoko-geri", band: "mid" },
    },
  ],
  { type: "attack", move: "gyaku-zuki", band: "mid" },
);

describe("CANONICAL_RULES — yoko-geri (the side kick: beyond-neutral zoning thrust)", () => {
  it("scores a clean mid side kick as a waza-ari (2) — the expansion's first score-2 move", () => {
    const result = runFight(
      fight({
        rules: deterministic({ startGap: 250000 }), // inside yoko reach (315000)
        botA: attackOnce("yoko-geri", "mid"),
        botB: IDLE,
        maxTicks: 30,
      }),
    );

    expect(result.scores.a).toBe(2);
  });

  it("fizzles off its band — mid-only, so high and low both whiff (no jodan ippon)", () => {
    const scoreAt = (band: Band): number =>
      runFight(
        fight({
          rules: deterministic({ startGap: 250000 }),
          botA: attackOnce("yoko-geri", band),
          botB: IDLE,
          maxTicks: 30,
        }),
      ).scores.a;

    expect(scoreAt("high")).toBe(0);
    expect(scoreAt("low")).toBe(0);
  });

  it("reaches beyond neutral — lands at a gap where even the roundhouse whiffs", () => {
    // A gap beyond the roundhouse's reach (mawashi 300000) but within yoko's (315000) — a
    // gap where NO existing move connects. This is yoko-geri's signature.
    const gap = { startGap: 310000 };

    const sideKick = runFight(
      fight({
        rules: deterministic(gap),
        botA: attackOnce("yoko-geri", "mid"),
        botB: IDLE,
        maxTicks: 30,
      }),
    );

    const roundhouse = runFight(
      fight({
        rules: deterministic(gap),
        botA: attackOnce("mawashi-geri", "mid"),
        botB: IDLE,
        maxTicks: 30,
      }),
    );

    expect(sideKick.scores.a).toBe(2); // inside the side kick's beyond-neutral reach
    expect(roundhouse.scores.a).toBe(0); // …but out of the roundhouse's
    expect(yoko().reach).toBeGreaterThan(mawashi().reach);
    expect(yoko().reach).toBeGreaterThan(CANONICAL_RULES.startGap); // out-reaches the neutral gap
  });

  it("is gas-LOCKED — a gassed fighter can no longer commit it (special > gas line)", () => {
    // Same canonical table, out of range (both whiff ⇒ no score noise). The always-striker keeps
    // committing its BASIC poke (20 ≤ the band) and floors the meter to 0; the drain-then-yoko bot
    // can only answer the gas band with the side kick (48 > the band), which degrades to idle — so
    // it stalls at the band and never empties. The mirror image of the gas-proof hands.
    const staminaSeries = (botA: BotDoc): number[] =>
      runFight(fight({ botA, botB: IDLE, maxTicks: 150 })).events.map(
        (e) => e.a.stamina,
      );

    const gas = CANONICAL_RULES.stamina?.gasThreshold ?? 0;

    expect(yoko().staminaCost ?? 0).toBeGreaterThan(gas); // priced above the gas line ⇒ locks out
    expect(Math.min(...staminaSeries(STRIKER))).toBe(0); // basic commits even gassed ⇒ floors
    expect(Math.min(...staminaSeries(DRAIN_THEN_YOKO))).toBeGreaterThan(0); // side kick locked out ⇒ stalls
  });

  it("opens the rekka — a connecting side kick cancels into the reverse (kick → punch finisher)", () => {
    const cancelTick = yoko().startup + yoko().active; // the first recovery frame

    const result = runFight(
      fight({
        rules: deterministic(), // gap 200000 ⇒ both the kick and the 240k finisher reach
        botA: comboAtTicks([
          { tick: 0, move: "yoko-geri", band: "mid" },
          { tick: cancelTick, move: "gyaku-zuki", band: "mid" },
        ]),
        botB: IDLE,
        maxTicks: 40,
      }),
    );

    expect(result.scores.a).toBe(3); // side kick (2) + cancelled reverse (1)
    expect(yoko().cancelInto).toContain("gyaku-zuki");
  });

  it("is a cancel TARGET too — the reverse now cancels into it (reverse → any kick grows)", () => {
    const cancelTick = gyaku().startup + gyaku().active;

    const result = runFight(
      fight({
        rules: deterministic(), // gap 200000 ⇒ the reverse connects and the kick out-reaches it
        botA: comboAtTicks([
          { tick: 0, move: "gyaku-zuki", band: "mid" },
          { tick: cancelTick, move: "yoko-geri", band: "mid" },
        ]),
        botB: IDLE,
        maxTicks: 40,
      }),
    );

    expect(result.scores.a).toBe(3); // reverse (1) + cancelled side kick (2)
    expect(gyaku().cancelInto).toContain("yoko-geri"); // the grown "reverse → any kick" edge
  });

  it("stays reactable and whiff-punishable (the invariant floor)", () => {
    expect(yoko().startup).toBeGreaterThanOrEqual(lAct() + 1);
    expect(yoko().recovery).toBeGreaterThanOrEqual(lAct() + kizami().startup);
  });

  it("is a mid-only waza-ari (score 2, no jodan bonus) priced above the gas line", () => {
    const gas = CANONICAL_RULES.stamina?.gasThreshold ?? 0;

    expect(yoko().score).toBe(2);
    expect(yoko().bands).toEqual(["mid"]);
    expect(yoko().scoreByBand).toBeUndefined(); // no ippon ceiling (unlike the roundhouse)
    expect(yoko().staminaCost ?? 0).toBeGreaterThan(gas);
  });
});

// ─── Batch-1 expansion #4: ushiro-geri (back kick) — the reach apex + jodan-ippon kick ──
// Drains itself with the basic poke, then switches to the back kick the moment it reads
// GASSED — where the special (52 > gasThreshold 30) is unaffordable and degrades to idle,
// so the meter never floors past the band (the special lockout, proven for the priciest kick).
const DRAIN_THEN_USHIRO: BotDoc = bot(
  [
    {
      when: {
        op: "eq",
        args: [
          { op: "field", path: "self.gassed" },
          { op: "const", value: 1 },
        ],
      },
      do: { type: "attack", move: "ushiro-geri", band: "mid" },
    },
  ],
  { type: "attack", move: "gyaku-zuki", band: "mid" },
);

describe("CANONICAL_RULES — ushiro-geri (the back kick: reach apex + jodan ippon)", () => {
  it("scores a clean mid back kick as a waza-ari (2) — the chudan base score", () => {
    const result = runFight(
      fight({
        rules: deterministic({ startGap: 250000 }), // inside ushiro reach (330000)
        botA: attackOnce("ushiro-geri", "mid"),
        botB: IDLE,
        maxTicks: 30,
      }),
    );

    expect(result.scores.a).toBe(2);
  });

  it("rewards a jodan back kick with ippon (3) and fizzles low — the high·mid gate (scoreByBand)", () => {
    const scoreAt = (band: Band): number =>
      runFight(
        fight({
          rules: deterministic({ startGap: 250000 }),
          botA: attackOnce("ushiro-geri", band),
          botB: IDLE,
          maxTicks: 30,
        }),
      ).scores.a;

    expect(scoreAt("high")).toBe(3); // jodan ⇒ ippon (the expansion's first jodan-scoring kick)
    expect(scoreAt("mid")).toBe(2); // chudan ⇒ waza-ari fallback
    expect(scoreAt("low")).toBe(0); // out of band ⇒ idle ⇒ no score
  });

  it("reaches the apex — lands at a gap where even the side kick whiffs", () => {
    // A gap beyond the side kick's reach (yoko 315000) but within ushiro's (330000): ushiro-geri
    // is now the single longest technique in the game. This is its signature.
    const gap = { startGap: 320000 };

    const backKick = runFight(
      fight({
        rules: deterministic(gap),
        botA: attackOnce("ushiro-geri", "mid"),
        botB: IDLE,
        maxTicks: 30,
      }),
    );

    const sideKick = runFight(
      fight({
        rules: deterministic(gap),
        botA: attackOnce("yoko-geri", "mid"),
        botB: IDLE,
        maxTicks: 30,
      }),
    );

    expect(backKick.scores.a).toBe(2); // inside the back kick's apex reach
    expect(sideKick.scores.a).toBe(0); // …but out of the side kick's
    expect(ushiro().reach).toBeGreaterThan(yoko().reach); // the new game-longest reach
    expect(ushiro().reach).toBeGreaterThan(CANONICAL_RULES.startGap); // out-reaches the neutral gap
  });

  it("is gas-LOCKED — a gassed fighter can no longer commit it (the priciest special > gas line)", () => {
    // Same as the yoko-geri lockout, one rung costlier. STRIKER keeps committing its BASIC poke
    // (20 ≤ the band) and floors the meter to 0; the drain-then-ushiro bot can only answer the gas
    // band with the back kick (52 > the band), which degrades to idle — so it stalls at the band.
    const staminaSeries = (botA: BotDoc): number[] =>
      runFight(fight({ botA, botB: IDLE, maxTicks: 150 })).events.map(
        (e) => e.a.stamina,
      );

    const gas = CANONICAL_RULES.stamina?.gasThreshold ?? 0;

    expect(ushiro().staminaCost ?? 0).toBeGreaterThan(gas); // priced above the gas line ⇒ locks out
    expect(ushiro().staminaCost ?? 0).toBeGreaterThan(yoko().staminaCost ?? 0); // the new costliest move
    expect(Math.min(...staminaSeries(STRIKER))).toBe(0); // basic commits even gassed ⇒ floors
    expect(Math.min(...staminaSeries(DRAIN_THEN_USHIRO))).toBeGreaterThan(0); // back kick locked out ⇒ stalls
  });

  it("opens the rekka — a connecting back kick cancels into the reverse (kick → punch finisher)", () => {
    const cancelTick = ushiro().startup + ushiro().active; // the first recovery frame

    const result = runFight(
      fight({
        rules: deterministic(), // gap 200000 ⇒ both the kick and the 240k finisher reach
        botA: comboAtTicks([
          { tick: 0, move: "ushiro-geri", band: "mid" },
          { tick: cancelTick, move: "gyaku-zuki", band: "mid" },
        ]),
        botB: IDLE,
        maxTicks: 40,
      }),
    );

    expect(result.scores.a).toBe(3); // back kick chudan (2) + cancelled reverse (1)
    expect(ushiro().cancelInto).toContain("gyaku-zuki");
  });

  it("is a cancel TARGET too — the reverse now cancels into it (reverse → any kick grows)", () => {
    const cancelTick = gyaku().startup + gyaku().active;

    const result = runFight(
      fight({
        rules: deterministic(), // gap 200000 ⇒ the reverse connects and the kick out-reaches it
        botA: comboAtTicks([
          { tick: 0, move: "gyaku-zuki", band: "mid" },
          { tick: cancelTick, move: "ushiro-geri", band: "mid" },
        ]),
        botB: IDLE,
        maxTicks: 40,
      }),
    );

    expect(result.scores.a).toBe(3); // reverse (1) + cancelled back kick chudan (2)
    expect(gyaku().cancelInto).toContain("ushiro-geri"); // the grown "reverse → any kick" edge
  });

  it("stays reactable and whiff-punishable (the invariant floor)", () => {
    expect(ushiro().startup).toBeGreaterThanOrEqual(lAct() + 1);
    expect(ushiro().recovery).toBeGreaterThanOrEqual(lAct() + kizami().startup);
  });

  it("is a high·mid kick — ippon jodan, waza-ari chudan — priced above the gas line", () => {
    const gas = CANONICAL_RULES.stamina?.gasThreshold ?? 0;

    expect(ushiro().score).toBe(2);
    expect(ushiro().scoreByBand?.high).toBe(3); // jodan ippon ceiling (like the roundhouse)
    expect(ushiro().bands).toEqual(["high", "mid"]);
    expect(ushiro().staminaCost ?? 0).toBeGreaterThan(gas);
  });
});

// ─── Batch-1 expansion #5: empi (elbow) — the shortest-reach close-range strike ──
// Drains itself with the basic poke, then switches to the elbow the moment it reads GASSED —
// where the special (38 > gasThreshold 30) is unaffordable and degrades to idle, so the meter
// never floors past the band (the special lockout, proven for the first close strike).
const DRAIN_THEN_EMPI: BotDoc = bot(
  [
    {
      when: {
        op: "eq",
        args: [
          { op: "field", path: "self.gassed" },
          { op: "const", value: 1 },
        ],
      },
      do: { type: "attack", move: "empi", band: "mid" },
    },
  ],
  { type: "attack", move: "gyaku-zuki", band: "mid" },
);

describe("CANONICAL_RULES — empi (the elbow: shortest reach + point-blank waza-ari)", () => {
  it("scores a clean point-blank elbow as a waza-ari (2) — the close-range payoff", () => {
    const result = runFight(
      fight({
        rules: deterministic({ startGap: 90000 }), // inside empi reach (95000)
        botA: attackOnce("empi", "mid"),
        botB: IDLE,
        maxTicks: 30,
      }),
    );

    expect(result.scores.a).toBe(2);
  });

  it("is a high·mid strike scoring a FLAT 2 (no jodan bonus) and fizzles low", () => {
    const scoreAt = (band: Band): number =>
      runFight(
        fight({
          rules: deterministic({ startGap: 90000 }),
          botA: attackOnce("empi", band),
          botB: IDLE,
          maxTicks: 30,
        }),
      ).scores.a;

    expect(scoreAt("high")).toBe(2); // jodan and chudan alike ⇒ flat waza-ari (no scoreByBand)
    expect(scoreAt("mid")).toBe(2);
    expect(scoreAt("low")).toBe(0); // out of band ⇒ idle ⇒ no score
    expect(empi().scoreByBand).toBeUndefined(); // the flatness — unlike ushiro-geri / mawashi-geri
  });

  it("is the shortest reach in the game — whiffs at a gap where even the throw lands", () => {
    // A gap beyond the elbow's reach (95000) but within the throw's (120000): the elbow is the
    // new infighting FLOOR — it only lands point-blank, the reward for braving throw range. Its
    // signature (the mirror image of the side/back kicks' beyond-neutral reach).
    const gap = { startGap: 100000 };

    const elbow = runFight(
      fight({
        rules: deterministic(gap),
        botA: attackOnce("empi", "mid"),
        botB: IDLE,
        maxTicks: 30,
      }),
    );

    // grappleFight positions the pair at the same 100000 gap — inside the throw's 120000 reach.
    const grab = runFight(
      grappleFight({ botA: throwOnce, botB: IDLE, maxTicks: 20 }),
    );

    expect(elbow.scores.a).toBe(0); // out of the elbow's point-blank reach
    expect(grab.scores.a).toBe(3); // …but the throw still lands from the same gap
    expect(empi().reach).toBeLessThan(throwSpec().reach); // shorter than the throw — the new floor
  });

  it("is gas-LOCKED — a gassed fighter can no longer commit it (special > gas line)", () => {
    // Like the kick lockouts. STRIKER keeps committing its BASIC poke (≤ the band) and floors the
    // meter to 0; the drain-then-empi bot can only answer the gas band with the elbow (38 > the
    // band), which degrades to idle — so it stalls at the band.
    const staminaSeries = (botA: BotDoc): number[] =>
      runFight(fight({ botA, botB: IDLE, maxTicks: 150 })).events.map(
        (e) => e.a.stamina,
      );

    const gas = CANONICAL_RULES.stamina?.gasThreshold ?? 0;

    expect(empi().staminaCost ?? 0).toBeGreaterThan(gas); // priced above the gas line ⇒ locks out
    expect(Math.min(...staminaSeries(STRIKER))).toBe(0); // basic commits even gassed ⇒ floors
    expect(Math.min(...staminaSeries(DRAIN_THEN_EMPI))).toBeGreaterThan(0); // elbow locked out ⇒ stalls
  });

  it("opens the rekka — a connecting elbow cancels into the reverse (close strike → punch)", () => {
    const cancelTick = empi().startup + empi().active; // the first recovery frame

    const result = runFight(
      fight({
        rules: deterministic({ startGap: 90000 }), // point-blank ⇒ both the elbow and the 240k reverse reach
        botA: comboAtTicks([
          { tick: 0, move: "empi", band: "mid" },
          { tick: cancelTick, move: "gyaku-zuki", band: "mid" },
        ]),
        botB: IDLE,
        maxTicks: 40,
      }),
    );

    expect(result.scores.a).toBe(3); // elbow waza-ari (2) + cancelled reverse (1)
    expect(empi().cancelInto).toContain("gyaku-zuki");
  });

  it("is a cancel SOURCE only — the reverse does NOT cancel into it (only the kicks grow that edge)", () => {
    // The derived cancel graph grows gyaku-zuki.cancelInto for the KICKS only; a close strike is
    // not a reverse-punch target. This guards against carelessly widening that edge to the elbow.
    expect(gyaku().cancelInto).not.toContain("empi");
  });

  it("stays reactable and whiff-punishable (the invariant floor)", () => {
    expect(empi().startup).toBeGreaterThanOrEqual(lAct() + 1);
    expect(empi().recovery).toBeGreaterThanOrEqual(lAct() + kizami().startup);
  });

  it("is a high·mid close strike (flat waza-ari, shortest reach) priced above the gas line", () => {
    const gas = CANONICAL_RULES.stamina?.gasThreshold ?? 0;

    expect(empi().score).toBe(2);
    expect(empi().scoreByBand).toBeUndefined(); // flat — no jodan bonus (unlike ushiro-geri)
    expect(empi().bands).toEqual(["high", "mid"]);
    expect(empi().reach).toBeLessThan(throwSpec().reach); // the shortest reach in the game
    expect(empi().staminaCost ?? 0).toBeGreaterThan(gas);
  });
});

// ─── Batch-1 expansion #6: hiza-geri (knee) — the mid-band STANDING knockdown ─────
// Drains itself with the basic poke, then switches to the knee the moment it reads GASSED —
// where the special (40 > gasThreshold 30) is unaffordable and degrades to idle, so the meter
// never floors past the band (the special lockout, proven for the standing knockdown knee).
const DRAIN_THEN_HIZA: BotDoc = bot(
  [
    {
      when: {
        op: "eq",
        args: [
          { op: "field", path: "self.gassed" },
          { op: "const", value: 1 },
        ],
      },
      do: { type: "attack", move: "hiza-geri", band: "mid" },
    },
  ],
  { type: "attack", move: "gyaku-zuki", band: "mid" },
);

describe("CANONICAL_RULES — hiza-geri (the knee: mid-band standing knockdown → okizeme)", () => {
  it("downs the foe with a point-blank knee for no score — the standing knockdown", () => {
    // Mirrors the sweep's "downs a grounded foe for no score", lifted to a MID, point-blank knee
    // against a neutral (standing) advancer: the knee freezes it for the knockdown and scores 0.
    const knock = hizaGeri().startup; // knockdown on the first active frame (elapsed = startup)
    const wake = knock + (CANONICAL_RULES.knockdownDuration ?? 0); // neutral again here

    const result = runFight(
      fight({
        rules: deterministic({ startGap: 100000 }), // inside hiza-geri reach (110000)
        botA: attackOnce("hiza-geri", "mid"),
        botB: ADVANCER,
        maxTicks: wake + 5,
      }),
    );

    expect(result.scores.a).toBe(0); // the knee scores 0 — the points live in the finish
    expect(result.events[wake - 1].b.x).toBe(result.events[knock + 1].b.x); // frozen while downed
    expect(result.events[wake].b.x).not.toBe(result.events[wake - 1].b.x); // moves again on wake
  });

  it("is a MID-only knockdown — out of band it degrades to idle (no down, no finish)", () => {
    // Score alone can't tell an in-band (score-0) knockdown from an out-of-band degrade, so the
    // okizeme finish is the oracle: in band ⇒ down ⇒ the cancelled reverse finishes for 3; out of
    // band ⇒ the knee idles ⇒ the reverse is a mere base poke (1), no down to finish.
    const cancelTick = hizaGeri().startup + hizaGeri().active; // first recovery frame ⇒ cancels

    const finishAt = (band: Band): number =>
      runFight(
        fight({
          rules: deterministic({ startGap: 100000 }), // knee (110k) + 240k finisher both reach
          botA: comboAtTicks([
            { tick: 0, move: "hiza-geri", band },
            { tick: cancelTick, move: "gyaku-zuki", band: "mid" },
          ]),
          botB: IDLE,
          maxTicks: 45,
        }),
      ).scores.a;

    expect(finishAt("mid")).toBe(3); // in band ⇒ knockdown ⇒ okizeme finish (3)
    expect(finishAt("high")).toBe(1); // out of band ⇒ idle ⇒ the reverse is a base poke (1)
    expect(finishAt("low")).toBe(1); // out of band ⇒ base poke, no finish
    expect(hizaGeri().bands).toEqual(["mid"]); // mid-only, unlike the sweep's occupancy banding
    expect(hizaGeri().scoreByBand).toBeUndefined(); // a knockdown, not a scoring strike — no jodan bonus
  });

  it("has the second-shortest reach — only lands point-blank, whiffs where the throw still grabs", () => {
    // empi 95k < hiza-geri 110k < throw 120k. The knee is the SECOND technique below the throw: it
    // downs a foe only point-blank and whiffs at a gap the throw still reaches. Since a score-0
    // connect and a whiff both score 0, the okizeme finish is the connect oracle (connect ⇒ 3;
    // whiff ⇒ 0, as the un-hit-confirmed reverse is locked out in the knee's recovery).
    const cancelTick = hizaGeri().startup + hizaGeri().active;

    const kneeFinish = (startGap: number): number =>
      runFight(
        fight({
          rules: deterministic({ startGap }),
          botA: comboAtTicks([
            { tick: 0, move: "hiza-geri", band: "mid" },
            { tick: cancelTick, move: "gyaku-zuki", band: "mid" },
          ]),
          botB: IDLE,
          maxTicks: 45,
        }),
      ).scores.a;

    const grab = runFight(
      fight({
        rules: deterministic({ startGap: 115000 }), // beyond the knee (110k), within the throw (120k)
        botA: throwOnce,
        botB: IDLE,
        maxTicks: 20,
      }),
    );

    expect(kneeFinish(90000)).toBe(3); // point-blank ⇒ knee downs ⇒ okizeme finish
    expect(kneeFinish(115000)).toBe(0); // out of the knee's reach ⇒ whiff, no down, follow-up locked in recovery
    expect(grab.scores.a).toBe(3); // …but the throw (120k) still grabs from the same 115000 gap
    expect(empi().reach).toBeLessThan(hizaGeri().reach); // empi 95k < hiza-geri 110k
    expect(hizaGeri().reach).toBeLessThan(throwSpec().reach); // hiza-geri 110k < throw 120k — the infighting floor
  });

  it("is gas-LOCKED — a gassed fighter can no longer commit it (special > gas line)", () => {
    // Like the kick / elbow lockouts. STRIKER keeps committing its BASIC poke (≤ the band) and
    // floors the meter to 0; the drain-then-knee bot can only answer the gas band with the knee
    // (40 > the band), which degrades to idle — so it stalls at the band.
    const staminaSeries = (botA: BotDoc): number[] =>
      runFight(fight({ botA, botB: IDLE, maxTicks: 150 })).events.map(
        (e) => e.a.stamina,
      );

    const gas = CANONICAL_RULES.stamina?.gasThreshold ?? 0;

    expect(hizaGeri().staminaCost ?? 0).toBeGreaterThan(gas); // priced above the gas line ⇒ locks out
    expect(Math.min(...staminaSeries(STRIKER))).toBe(0); // basic commits even gassed ⇒ floors
    expect(Math.min(...staminaSeries(DRAIN_THEN_HIZA))).toBeGreaterThan(0); // knee locked out ⇒ stalls
  });

  it("finishes the downed foe for an ippon on a hit-confirm cancel — the standing okizeme (its signature)", () => {
    // The sweep's okizeme, lifted to a mid, point-blank knee: connect ⇒ knockdown ⇒ a gyaku-zuki
    // cancelled into the finish window scores the ippon (3). Uncancelled, the strike starts no
    // earlier than the knee's full recovery — by which point the foe has woken ⇒ a mere base poke.
    const finishScoreAt = (strikeTick: number): number =>
      runFight(
        fight({
          rules: deterministic({ startGap: 100000 }), // knee (110k) + 240k finisher both reach
          botA: bot(
            [
              {
                when: clk("eq", 0),
                do: { type: "attack", move: "hiza-geri", band: "mid" },
              },
              {
                when: clk("eq", strikeTick),
                do: { type: "attack", move: "gyaku-zuki", band: "mid" },
              },
            ],
            { type: "idle" },
          ),
          botB: IDLE,
          maxTicks: 45,
        }),
      ).scores.a;

    const cancelTick = hizaGeri().startup + hizaGeri().active; // first recovery frame ⇒ cancels

    const neutralTick =
      hizaGeri().startup + hizaGeri().active + hizaGeri().recovery; // first neutral ⇒ no cancel

    expect(finishScoreAt(cancelTick)).toBe(3); // hit-confirm cancel lands the finish in-window ⇒ ippon
    expect(finishScoreAt(neutralTick)).toBe(1); // uncancelled ⇒ foe wakes first ⇒ a base poke, not the finish
    expect(hizaGeri().score).toBe(0); // the knee itself scores 0 — the points live in the finish
    expect(hizaGeri().knockdown).toBe(true);
    expect(hizaGeri().cancelInto).toContain("gyaku-zuki");
    expect(gyaku().cancelInto).not.toContain("hiza-geri"); // source only — the reverse does not cancel into it
  });

  it("stays reactable and whiff-punishable (the invariant floor)", () => {
    expect(hizaGeri().startup).toBeGreaterThanOrEqual(lAct() + 1);
    expect(hizaGeri().recovery).toBeGreaterThanOrEqual(
      lAct() + kizami().startup,
    );
  });

  it("is a mid-only standing knockdown knee: point-blank reach, scores 0, gas-locked, cancel source only", () => {
    const gas = CANONICAL_RULES.stamina?.gasThreshold ?? 0;

    expect(hizaGeri().score).toBe(0); // knockdown ⇒ the hit scores 0 (points live in the finish)
    expect(hizaGeri().knockdown).toBe(true);
    expect(hizaGeri().scoreByBand).toBeUndefined();
    expect(hizaGeri().bands).toEqual(["mid"]);
    expect(empi().reach).toBeLessThan(hizaGeri().reach); // above the elbow (95k)
    expect(hizaGeri().reach).toBeLessThan(throwSpec().reach); // below the throw (120k) — the infighting floor
    expect(hizaGeri().staminaCost ?? 0).toBeGreaterThan(gas); // gas-locked special
    expect(hizaGeri().cancelInto).toEqual(["gyaku-zuki"]); // cancel source only
  });
});

describe("CANONICAL_RULES — defensive structural shape", () => {
  it("ships a tight parry window with real extra recovery", () => {
    expect(CANONICAL_RULES.parryWindow).toBe(2);
    expect(CANONICAL_RULES.parryRecovery ?? 0).toBeGreaterThan(0);
  });

  it("ships a counter window wide enough for a startup-7 counter, worth one yuko", () => {
    expect(CANONICAL_RULES.counterWindow ?? 0).toBeGreaterThan(gyaku().startup);
    expect(CANONICAL_RULES.counterBonus).toBe(1);
  });

  it("ships a cancel window and a cross-move cancel route", () => {
    expect(CANONICAL_RULES.cancelWindow ?? 0).toBeGreaterThan(0);
    expect(gyaku().cancelInto).toContain("mawashi-geri");
  });
});

// ─── Slice 4: the throw triangle (throw > guard, strike > throw, read-breakable) ──

// Throws once at tick 0, then idles — a single grab-active window to observe.
const throwOnce: BotDoc = bot([{ when: clk("eq", 0), do: { type: "throw" } }], {
  type: "idle",
});

// Returns throw-break the instant it PERCEIVES the opponent committing to a grab
// (a pure read of the L_act-delayed opponent.throwing tell).
const REACTIVE_BREAKER: BotDoc = bot(
  [
    {
      when: {
        op: "eq",
        args: [
          { op: "field", path: "opponent.throwing" },
          { op: "const", value: 1 },
        ],
      },
      do: { type: "throw-break" },
    },
  ],
  { type: "idle" },
);

// Advances toward the opponent whenever free — its x stalls while it is downed.
const ADVANCER: BotDoc = bot([], { type: "move", dir: 1 });

// Throws at tick 0, then holds a mid guard — so if its throw does NOT commit it, it
// blocks an incoming mid strike (the contrast that proves a whiffed grab is committed).
const throwThenGuard: BotDoc = bot(
  [
    { when: clk("eq", 0), do: { type: "throw" } },
    { when: clk("gte", 1), do: { type: "block", band: "mid" } },
  ],
  { type: "idle" },
);

describe("CANONICAL_RULES — throw structural shape", () => {
  it("scores a clean throw as a WKF ippon (3)", () => {
    expect(throwSpec().score).toBe(3);
  });

  it("puts the throw-break on the reaction knife-edge (startup = lAct + 1)", () => {
    expect(throwSpec().startup).toBe(lAct() + 1);
  });

  it("makes a whiffed throw punishable (recovery ≥ lAct + strike startup)", () => {
    expect(throwSpec().recovery).toBeGreaterThanOrEqual(
      lAct() + gyaku().startup,
    );
  });

  it("is shorter-range than the strike (a grab must be close)", () => {
    expect(throwSpec().reach).toBeLessThan(gyaku().reach);
  });

  it("knocks the defender down for a real duration", () => {
    expect(CANONICAL_RULES.knockdownDuration ?? 0).toBeGreaterThan(0);
  });
});

describe("CANONICAL_RULES — a throw beats a guard (throw > guard)", () => {
  it("grabs a guarding defender for an ippon — the unbanded grab ignores the block", () => {
    const result = runFight(
      grappleFight({
        botA: throwOnce,
        botB: bot([], { type: "block", band: "mid" }),
        maxTicks: 20,
      }),
    );

    expect(result.scores.a).toBe(3);
  });
});

describe("CANONICAL_RULES — a throw knocks the defender down", () => {
  it("freezes a thrown advancer for the knockdown, then it moves again", () => {
    const grab = throwSpec().startup; // grab-active opens at elapsed = startup
    const wake = grab + (CANONICAL_RULES.knockdownDuration ?? 0); // neutral again here

    const result = runFight(
      grappleFight({ botA: throwOnce, botB: ADVANCER, maxTicks: wake + 5 }),
    );

    expect(result.events[wake - 1].b.x).toBe(result.events[grab + 1].b.x); // frozen while downed
    expect(result.events[wake].b.x).not.toBe(result.events[wake - 1].b.x); // moves again on wake
  });
});

describe("CANONICAL_RULES — a strike stuffs a colliding throw (strike > throw)", () => {
  it("an active strike voids a colliding throw that otherwise scores uncontested", () => {
    // Baseline: the grab alone downs the idle defender for 3 — it works in this position.
    const uncontested = runFight(
      grappleFight({ botA: throwOnce, botB: IDLE, maxTicks: 20 }),
    ).scores.a;

    // Contested: a strike whose active window (7–9) overlaps the grab-active window (7–8)
    // stuffs it — strike > throw, so the strike scores and the same grab is voided.
    const contested = runFight(
      grappleFight({ botA: throwOnce, botB: strikeOnce("mid"), maxTicks: 20 }),
    );

    expect(uncontested).toBe(3); // the throw scores uncontested
    expect(contested.scores.b).toBe(1); // the colliding strike landed
    expect(contested.scores.a).toBe(0); // and voided the throw — no ippon
  });
});

describe("CANONICAL_RULES — the throw-break read-game (escapable iff startup ≥ lAct+1)", () => {
  // REACTIVE_BREAKER breaks the instant it perceives the grab; throwOnce commits one grab.
  // scores.b is the thrower's score: 0 ⇒ the grab was broken, 3 ⇒ it landed.
  const reactableBreak = (startup: number): number =>
    runFight(
      fight({
        rules: withThrowStartup(startup),
        botA: REACTIVE_BREAKER,
        botB: throwOnce,
        maxTicks: 30,
      }),
    ).scores.b;

  it("a reaction break escapes the canonical throw, but not one a tick faster", () => {
    expect(reactableBreak(throwSpec().startup)).toBe(0); // startup = lAct+1 ⇒ break is up ⇒ escaped
    expect(reactableBreak(lAct())).toBe(3); // startup = lAct ⇒ tell arrives too late ⇒ grabbed
  });
});

describe("CANONICAL_RULES — a whiffed throw is punishable", () => {
  it("a grab out of range whiffs, and its recovery stops the thrower defending the punish", () => {
    // deterministic() positions the pair at 200000: outside grab reach (120000) but inside
    // strike reach (240000), so the throw whiffs. The thrower would block the mid punish if
    // free — committing to the grab's recovery is exactly what leaves it open (b:1, not 0).
    const result = runFight(
      fight({
        rules: deterministic(),
        botA: throwThenGuard, // grab whiffs out of range; then it tries to guard
        botB: strikeAtTicks([throwSpec().startup + throwSpec().active], "mid"),
        maxTicks: 40,
      }),
    );

    expect(result.scores.a).toBe(0); // the throw whiffed
    expect(result.scores.b).toBe(1); // committed in recovery, it couldn't block ⇒ punished
  });
});

// ─── Slice 5a: the sweep (low knockdown strike) + the okizeme finish ──────────────

// Sweeps once at tick 0, then idles — a single knockdown to observe.
const sweepOnce: BotDoc = bot([{ when: clk("eq", 0), do: { type: "sweep" } }], {
  type: "idle",
});

// Sweeps at tick 0, then holds a mid guard — so if its sweep does NOT commit it, it
// blocks the incoming mid punish (the contrast that proves a whiffed sweep is committed).
const sweepThenGuard: BotDoc = bot(
  [
    { when: clk("eq", 0), do: { type: "sweep" } },
    { when: clk("gte", 1), do: { type: "block", band: "mid" } },
  ],
  { type: "idle" },
);

describe("CANONICAL_RULES — sweep & okizeme structural shape", () => {
  it("is a low knockdown strike that scores nothing", () => {
    expect(sweepSpec().score).toBe(0);
    expect(sweepSpec().knockdown).toBe(true);
  });

  it("cancels into the strike (the hit-confirm finish route)", () => {
    expect(sweepSpec().cancelInto).toContain("gyaku-zuki");
  });

  it("completes the reach hierarchy throw < sweep < strike", () => {
    expect(throwSpec().reach).toBeLessThan(sweepSpec().reach);
    expect(sweepSpec().reach).toBeLessThan(gyaku().reach);
  });

  it("keeps the sweep reactable (startup = lAct+1) and its whiff punishable", () => {
    expect(sweepSpec().startup).toBe(lAct() + 1);
    expect(sweepSpec().recovery).toBeGreaterThanOrEqual(
      lAct() + gyaku().startup,
    );
  });

  it("pays the finish as an ippon, inside a window shorter than the knockdown", () => {
    expect(CANONICAL_RULES.finishScore).toBe(3);
    expect(CANONICAL_RULES.finishWindow ?? 0).toBeGreaterThan(0);
    expect(CANONICAL_RULES.knockdownDuration ?? 0).toBeGreaterThan(
      CANONICAL_RULES.finishWindow ?? 0,
    );
  });
});

describe("CANONICAL_RULES — a sweep downs a grounded foe for no score", () => {
  it("sweeps an advancer: scores 0, freezes it for the knockdown, then it moves again", () => {
    const knock = sweepSpec().startup; // knockdown on the first active frame (elapsed = startup)
    const wake = knock + (CANONICAL_RULES.knockdownDuration ?? 0); // neutral again here

    const result = runFight(
      sweepFight({ botA: sweepOnce, botB: ADVANCER, maxTicks: wake + 5 }),
    );

    expect(result.scores.a).toBe(0); // a sweep scores nothing
    expect(result.events[wake - 1].b.x).toBe(result.events[knock + 1].b.x); // frozen while downed
    expect(result.events[wake].b.x).not.toBe(result.events[wake - 1].b.x); // moves again on wake
  });
});

describe("CANONICAL_RULES — a sweep is a low-band strike (banded by occupancy)", () => {
  // Guards `band` over the sweep's active frame (tick ≤ startup), then advances — so x at two
  // in-knockdown ticks reveals whether the sweep was blocked (free ⇒ moved) or landed (downed ⇒ frozen).
  const sweptFrozen = (posture: BotDoc): boolean => {
    const result = runFight(
      sweepFight({ botA: sweepOnce, botB: posture, maxTicks: 24 }),
    );

    return result.events[20].b.x === result.events[9].b.x;
  };

  // Hold the posture across the sweep's WHOLE active window (ticks startup..startup+active-1),
  // then advance — dropping it on any active frame would itself be swept.
  const activeEnd = (): number => sweepSpec().startup + sweepSpec().active;

  const guardThenAdvance = (band: Band): BotDoc =>
    bot([{ when: clk("lt", activeEnd()), do: { type: "block", band } }], {
      type: "move",
      dir: 1,
    });

  it("a low guard blocks the sweep; a high (wrong-height) guard is swept", () => {
    expect(sweptFrozen(guardThenAdvance("low"))).toBe(false); // blocked ⇒ free ⇒ moves
    expect(sweptFrozen(guardThenAdvance("high"))).toBe(true); // wrong height ⇒ swept ⇒ frozen
  });

  it("sweeps a croucher — crouch occupies low, so it does not dodge", () => {
    const crouchThenAdvance = bot(
      [{ when: clk("lt", activeEnd()), do: { type: "crouch" } }],
      { type: "move", dir: 1 },
    );

    expect(sweptFrozen(crouchThenAdvance)).toBe(true); // swept ⇒ frozen
  });
});

describe("CANONICAL_RULES — sweep → cancel → okizeme finish (3, hit-confirmed)", () => {
  // Sweep at tick 0 (knockdown at tick 7); then a strike at `strikeTick`. At the first recovery
  // frame the strike CANCELS the sweep's recovery (rekka) and its active frame lands inside the
  // finish window ⇒ the okizeme ippon (3). At the first NEUTRAL tick (no cancel) the strike can
  // start no earlier than the sweep's full recovery, by which point the foe has already WOKEN from
  // the short knockdown — so it lands a mere base poke (1), never the finish.
  const finishScoreAt = (strikeTick: number): number =>
    runFight(
      sweepFight({
        botA: bot(
          [
            { when: clk("eq", 0), do: { type: "sweep" } },
            {
              when: clk("eq", strikeTick),
              do: { type: "attack", move: "gyaku-zuki", band: "mid" },
            },
          ],
          { type: "idle" },
        ),
        botB: IDLE,
        maxTicks: 40,
      }),
    ).scores.a;

  it("a hit-confirm cancel finishes the downed foe for an ippon; the same strike uncancelled is too late", () => {
    const cancelTick = sweepSpec().startup + sweepSpec().active; // first recovery frame ⇒ cancels

    const neutralTick =
      sweepSpec().startup + sweepSpec().active + sweepSpec().recovery; // first neutral ⇒ no cancel

    expect(finishScoreAt(cancelTick)).toBe(3); // cancel lands the finish in-window ⇒ ippon
    expect(finishScoreAt(neutralTick)).toBe(1); // uncancelled ⇒ foe wakes first ⇒ a base poke, not the finish
  });
});

describe("CANONICAL_RULES — a whiffed sweep is punishable", () => {
  it("a sweep out of range whiffs, and its recovery stops the sweeper defending the punish", () => {
    // deterministic() positions the pair at 200000: outside sweep reach (180000) but inside
    // strike reach (240000), so the sweep whiffs and (committed in recovery) cannot block the punish.
    const result = runFight(
      fight({
        rules: deterministic(),
        botA: sweepThenGuard, // sweep whiffs out of range; then it tries to guard
        botB: strikeAtTicks([sweepSpec().startup + sweepSpec().active], "mid"),
        maxTicks: 40,
      }),
    );

    expect(result.scores.a).toBe(0); // the sweep whiffed (and scores 0 anyway)
    expect(result.scores.b).toBe(1); // committed in recovery, it couldn't block ⇒ punished
  });
});

// The okizeme lock (as authored in bots/sweeper.json): finish the downed foe while the
// finish window is live, else sweep any grounded foe in reach; otherwise close the gap.
// Its sweep→knockdown→finish→sweep chain is legal DSL, so the platform must answer it in
// the frame table, not the roster.
const PERPETUAL_SWEEPER: BotDoc = bot(
  [
    {
      when: {
        op: "gt",
        args: [
          { op: "field", path: "self.finishWindow" },
          { op: "const", value: 0 },
        ],
      },
      do: { type: "attack", move: "gyaku-zuki", band: "high" },
    },
    {
      when: all(
        {
          op: "eq",
          args: [
            { op: "field", path: "self.canAct" },
            { op: "const", value: 1 },
          ],
        },
        {
          op: "lte",
          args: [
            { op: "field", path: "opponent.distance" },
            { op: "const", value: sweepSpec().reach },
          ],
        },
      ),
      do: { type: "sweep" },
    },
  ],
  { type: "move", dir: 1 },
);

describe("CANONICAL_RULES — the okizeme loop no longer starves the yame (the de-wall)", () => {
  // The sweeper's sweep→knockdown→finish→sweep loop can keep a passive foe PERPETUALLY downed, so
  // the both-neutral YAME boundary never arrives and a WKF match farms the entire tick cap (the
  // 100%-win wall the round-robin surfaced). The canonical knockdownDuration is short enough that
  // the swept foe WAKES back into neutral: a yame fires and the match ends decisively on the point
  // gap. Lengthening the knockdown back to the old 30 re-locks the foe before it can wake ⇒ the
  // yame is starved ⇒ the match runs to the cap again.
  const okizemeMatch = (rules: Rules) =>
    runFight({
      rules,
      botA: PERPETUAL_SWEEPER,
      botB: ADVANCER, // a passive foe: only breaking the lock (not its own offense) can end the match
      maxTicks: 600,
      seed: 1,
      match: { winGap: 8 }, // the design's WKF win gap
    });

  it("wakes the swept foe in time for a yame at the canonical knockdown; the old 30 farms the cap", () => {
    const canonical = okizemeMatch(CANONICAL_RULES);
    expect(canonical.endReason).toBe("gap"); // a yame fired ⇒ the match ends on the point gap
    expect(canonical.ticks).toBeLessThan(600); // decisively, before the cap — no longer a farming wall

    const walled = okizemeMatch({ ...CANONICAL_RULES, knockdownDuration: 30 });
    expect(walled.endReason).toBe("time"); // the loop starves the yame ⇒ it farms every tick
    expect(walled.ticks).toBe(600);
  });
});

// ─── Slice 5b: the jump arc + airborne occupancy (anti-air) ───────────────────

// Jumps (vertical only) at tick `j`, then advances whenever free — so once it lands it
// moves again (a downed fighter cannot), distinguishing "whiffed the sweep" from "swept".
const jumpAt = (j: number): BotDoc =>
  bot([{ when: clk("eq", j), do: { type: "jump", dir: 0 } }], {
    type: "move",
    dir: 1,
  });

describe("CANONICAL_RULES — air physics structural shape", () => {
  it("clears the low band at/below the launch height (vacates low the instant it leaves the ground)", () => {
    expect(CANONICAL_RULES.lowClearance ?? Infinity).toBeLessThanOrEqual(
      CANONICAL_RULES.jumpImpulse ?? 0,
    );
  });
});

describe("CANONICAL_RULES — a timed jump clears the sweep (anti-air occupancy)", () => {
  // Sweep at tick 0 (active on ticks 7–8). The defender's x at two deep-in-knockdown ticks
  // reveals whether the sweep landed (downed ⇒ frozen) or whiffed (free ⇒ the jumper lands and moves).
  const downedBySweep = (defender: BotDoc): boolean => {
    const result = runFight(
      sweepFight({ botA: sweepOnce, botB: defender, maxTicks: 24 }),
    );

    return result.events[20].b.x === result.events[9].b.x;
  };

  it("whiffs an airborne jumper yet downs a grounded foe under the same rules", () => {
    expect(downedBySweep(jumpAt(4))).toBe(false); // airborne over the active frames ⇒ passes under ⇒ not downed
    expect(downedBySweep(ADVANCER)).toBe(true); // grounded ⇒ swept ⇒ frozen for the knockdown
  });

  it("clears across a launch window but must be timed (too-early lands before the active frames)", () => {
    expect(downedBySweep(jumpAt(2))).toBe(false); // earliest launch still airborne on ticks 7–8 ⇒ clears
    expect(downedBySweep(jumpAt(6))).toBe(false); // latest launch still airborne on ticks 7–8 ⇒ clears
    expect(downedBySweep(jumpAt(0))).toBe(true); // arc completes by tick 6 ⇒ grounded on 7–8 ⇒ swept
  });
});

describe("CANONICAL_RULES — the jump arc is a deterministic integer parabola", () => {
  it("rises to a held apex and returns to exactly y=0", () => {
    const result = runFight(
      sweepFight({ botA: jumpAt(0), botB: IDLE, maxTicks: 10 }),
    );

    expect(result.events.slice(0, 7).map((e) => e.a.y)).toEqual([
      12000, 20000, 24000, 24000, 20000, 12000, 0,
    ]);
  });
});

// ─── Canonical tobi-geri (air-actions S2 Slice 4): the jump-in aerial ippon ─────
// The only AIRBORNE technique — committed mid-jump, closing the start gap via the
// wired `jumpXSpeed`, and scored jodan-3 / chudan-2 like the roundhouse. This is
// the one slice that changes the canonical frame table (⇒ a benchmark version bump).
const tobiGeri = armed("tobi-geri"); // jumping kick (Batch-2 air arsenal)

// Jump toward the foe on tick 0, then commit tobi-geri (while airborne) on tick 1 —
// a jump-in that closes the 300k start gap via jumpXSpeed and lands the aerial
// technique on the descending approach. Times the strike off the tick clock (the
// canonical `self.posture` timing is the gauntlet bot's job in a later story).
const jumpInTobi = (band: Band): BotDoc =>
  bot(
    [
      { when: clk("eq", 0), do: { type: "jump", dir: 1 } },
      { when: clk("eq", 1), do: { type: "attack", move: "tobi-geri", band } },
    ],
    { type: "idle" },
  );

describe("CANONICAL_RULES — tobi-geri, the jump-in aerial technique", () => {
  it("lands a jodan tobi-geri for the ippon (3) against a standing foe", () => {
    const result = runFight(
      fight({ botA: jumpInTobi("high"), botB: IDLE, maxTicks: 12 }),
    );

    expect(result.scores.a).toBe(3); // jodan ⇒ ippon
  });

  it("lands a chudan tobi-geri for the waza-ari (2)", () => {
    const result = runFight(
      fight({ botA: jumpInTobi("mid"), botB: IDLE, maxTicks: 12 }),
    );

    expect(result.scores.a).toBe(2); // chudan ⇒ waza-ari
  });

  it("whiffs a jodan tobi-geri over a croucher (crouch vacates high) yet mid still lands", () => {
    const high = runFight(
      fight({ botA: jumpInTobi("high"), botB: crouchUntil(60), maxTicks: 12 }),
    );

    const mid = runFight(
      fight({ botA: jumpInTobi("mid"), botB: crouchUntil(60), maxTicks: 12 }),
    );

    expect(high.scores.a).toBe(0); // high passes over the crouch ⇒ no score
    expect(mid.scores.a).toBe(2); // mid connects (crouch occupies mid)
  });

  it("scores nothing without the jump-in — a stationary air strike cannot close the gap", () => {
    // Same air move, but launched straight up (dir 0 ⇒ no jumpXSpeed displacement):
    // the foe stays a full start-gap away (300k > tobi-geri reach), so it whiffs.
    // Proves the connect is EARNED by the jump-in, not a free full-range poke.
    const straightUp = bot(
      [
        { when: clk("eq", 0), do: { type: "jump", dir: 0 } },
        {
          when: clk("eq", 1),
          do: { type: "attack", move: "tobi-geri", band: "high" },
        },
      ],
      { type: "idle" },
    );

    const result = runFight(
      fight({ botA: straightUp, botB: IDLE, maxTicks: 12 }),
    );

    expect(result.scores.a).toBe(0);
  });

  // ── Identity / relationship pins (mirroring the C9 arsenal relationship tests) ──
  it("is an air technique scored jodan-3 / chudan-2, pure scoring (no knockdown)", () => {
    const t = tobiGeri();
    expect(t.air).toBe(true);
    expect(t.bands).toEqual(["high", "mid"]);
    expect(t.scoreByBand?.high).toBe(3); // jodan ippon
    expect(t.scoreByBand?.mid).toBe(2); // chudan waza-ari
    expect(t.knockdown ?? false).toBe(false); // pure scoring, no okizeme monster
  });

  it("is gas-locked — the most athletic technique (staminaCost > gasThreshold)", () => {
    const gas = CANONICAL_RULES.stamina?.gasThreshold ?? 0;
    expect(tobiGeri().staminaCost ?? 0).toBeGreaterThan(gas);
  });

  it("has a punishable landing recovery (recovery ≥ lAct + the fastest punish startup)", () => {
    expect(tobiGeri().recovery).toBeGreaterThanOrEqual(
      lAct() + kizami().startup,
    );
  });

  it("is out of the cancel web — no cancelInto, and the reverse cannot cancel into it", () => {
    expect(tobiGeri().cancelInto).toBeUndefined();
    expect(gyaku().cancelInto ?? []).not.toContain("tobi-geri");
  });

  it("wires jumpXSpeed into the canonical table (a committed leap closes ground)", () => {
    expect(CANONICAL_RULES.jumpXSpeed ?? 0).toBeGreaterThan(0);
  });
});

// ─── Canonical stamina, Slice 1: the conditioning meter paces the fight ────────

// Strikes mid ONLY when the meter is at the cap (self.stamina ≥ 100 = stamina.max,
// pinned by the structural-shape test) — a self-pacing poke that waits for regen to
// refill the cost between strikes. A pure read of the live self.stamina field.
const PACED_POKER: BotDoc = bot(
  [
    {
      when: {
        op: "gte",
        args: [
          { op: "field", path: "self.stamina" },
          { op: "const", value: 100 },
        ],
      },
      do: { type: "attack", move: "gyaku-zuki", band: "mid" },
    },
  ],
  { type: "idle" },
);

describe("CANONICAL_RULES — the stamina meter paces the fight", () => {
  it("a committed strike spends its cost on commit — a whiff still costs", () => {
    // Idle to tick 4 (the meter sits at the cap), then strike once at tick 5 from the full
    // start gap (300000 > strike.reach 240000) so it WHIFFS — yet the commit still drains the cost.
    const result = runFight(
      fight({ botA: strikeAtTicks([5], "mid"), botB: IDLE, maxTicks: 20 }),
    );

    const reserve = result.events[4].a.stamina; // idled to tick 4 ⇒ the full reserve (stamina.max)

    expect(reserve).toBe(100);
    expect(reserve - result.events[5].a.stamina).toBe(20); // a commit drains exactly the strike cost — a whiff still costs
  });

  it("a paced poke is sustainable while a free spammer runs the meter to empty (regen is load-bearing)", () => {
    // Same canonical table, same horizon (out of range ⇒ both whiff), differing ONLY in cadence.
    // The spammer strikes the instant it is free (no room for regen) and floors the meter; the
    // poker waits for a full reserve (regen refills the cost between strikes) and never runs dry.
    const staminaSeries = (botA: BotDoc): number[] =>
      runFight(fight({ botA, botB: IDLE, maxTicks: 150 })).events.map(
        (e) => e.a.stamina,
      );

    const spammer = staminaSeries(restrikeWhenFree("mid"));
    const poker = staminaSeries(PACED_POKER);

    expect(Math.min(...spammer)).toBe(0); // ran the meter to empty (and the gate held it at 0 — never negative)
    expect(Math.min(...poker)).toBeGreaterThan(0); // regen offset the paced cost ⇒ never dry
    expect(Math.max(...poker)).toBe(CANONICAL_RULES.stamina?.max ?? 0); // and it recovers to a full reserve
  });
});

describe("CANONICAL_RULES — stamina structural shape", () => {
  it("meters a full reserve that regens only a sub-strike trickle (pacing matters)", () => {
    expect(CANONICAL_RULES.stamina?.max).toBe(100);
    expect(CANONICAL_RULES.stamina?.regen).toBe(10);
    expect(CANONICAL_RULES.stamina?.regen ?? 0).toBeLessThan(
      gyaku().staminaCost ?? 0,
    );
  });

  it("prices a basic strike below the specials (basic < special)", () => {
    const basic = gyaku().staminaCost ?? 0;

    expect(basic).toBe(20);
    expect(basic).toBeLessThan(throwSpec().staminaCost ?? 0);
    expect(basic).toBeLessThan(sweepSpec().staminaCost ?? 0);
  });

  it("bleeds a guard on contact, a parry harder than a block (parryChip > blockChip)", () => {
    const block = CANONICAL_RULES.stamina?.blockChip ?? 0;
    const parry = CANONICAL_RULES.stamina?.parryChip ?? 0;

    expect(block).toBe(5);
    expect(parry).toBe(15);
    expect(parry).toBeGreaterThan(block);
  });

  it("sets the gas line between basic and special (basicCost ≤ gasThreshold < specialCost)", () => {
    const gas = CANONICAL_RULES.stamina?.gasThreshold ?? 0;

    expect(gas).toBe(30);
    expect(gyaku().staminaCost ?? 0).toBeLessThanOrEqual(gas); // a gassed fighter can still afford its strike
    expect(gas).toBeLessThan(throwSpec().staminaCost ?? 0); // …but not its throw
    expect(gas).toBeLessThan(sweepSpec().staminaCost ?? 0); // …nor its sweep
  });

  it("slows a gassed commit's recovery by a flat penalty", () => {
    expect(CANONICAL_RULES.stamina?.gasRecoveryPenalty).toBe(6);
  });
});

// ─── Canonical stamina, Slice 2: the guard chip bleeds the defender (parry > block) ──

describe("CANONICAL_RULES — the guard chip bleeds the defender (parry > block)", () => {
  // strikeOnce(mid) commits at tick 0; its active window opens at elapsed = strike.startup,
  // so the first contact lands on tick = startup. The defender guards mid: a STALE guard (held
  // from tick 0) BLOCKS, a FRESH guard (raised on the active frame) PARRIES. The defender's
  // stamina drop across that contact tick is exactly the chip drawn from it (a guarding fighter
  // never regens, so the drop is the chip alone).
  const defenderDropOnContact = (defender: BotDoc): number => {
    const t = gyaku().startup; // the first active/contact frame

    const result = runFight(
      fight({
        rules: deterministic(),
        botA: strikeOnce("mid"),
        botB: defender,
        maxTicks: 20,
      }),
    );

    return result.events[t - 1].b.stamina - result.events[t].b.stamina;
  };

  it("a block bleeds the defender, and a parry bleeds strictly more", () => {
    const blockDrop = defenderDropOnContact(guardFrom(0, "mid")); // stale ⇒ block
    const parryDrop = defenderDropOnContact(guardFrom(gyaku().startup, "mid")); // fresh ⇒ parry

    expect(blockDrop).toBeGreaterThan(0); // a block draws blockChip on contact
    expect(parryDrop).toBeGreaterThan(blockDrop); // a parry draws strictly more (parryChip > blockChip)
  });

  it("an un-contacted guard draws nothing (contact is the trigger, not merely guarding)", () => {
    // The defender holds a mid guard the whole fight but is never struck (the attacker idles),
    // so it bleeds nothing — and a guarding fighter does not regen either — ⇒ it sits at the
    // full reserve throughout.
    const result = runFight(
      fight({
        rules: deterministic(),
        botA: IDLE,
        botB: guardFrom(0, "mid"),
        maxTicks: 20,
      }),
    );

    expect(result.events.every((e) => e.b.stamina === 100)).toBe(true);
  });
});

// ─── Canonical stamina, Slice 3: the gas line locks out specials (closes C10) ──

// Strikes (the default) to drain itself, but the moment it reads itself GASSED switches to
// a THROW — which, in the gas band, is unaffordable (special 40 > gasThreshold 30) and
// degrades to idle. So it can never drain past the band: the special is locked out while the
// basic strike would keep committing. A pure read of the live self.gassed tell.
const DRAIN_THEN_THROW: BotDoc = bot(
  [
    {
      when: {
        op: "eq",
        args: [
          { op: "field", path: "self.gassed" },
          { op: "const", value: 1 },
        ],
      },
      do: { type: "throw" },
    },
  ],
  { type: "attack", move: "gyaku-zuki", band: "mid" },
);

describe("CANONICAL_RULES — the gas line locks out specials (specialCost > gasThreshold ≥ basicCost)", () => {
  it("a gassed fighter still strikes to empty, but its special locks out at the gas band", () => {
    // Same canonical table, out of range (both whiff ⇒ no score noise). The always-striker keeps
    // committing its BASIC poke (20 ≤ stamina at the band) and floors the meter to exactly 0; the
    // drain-then-throw bot can only answer the gas band with its SPECIAL (40 > the band), which
    // degrades to idle — so it stalls at the band and never empties. The lockout is emergent: it
    // rides Story 1's affordability gate the moment the canonical numbers satisfy the inequality.
    const staminaSeries = (botA: BotDoc): number[] =>
      runFight(fight({ botA, botB: IDLE, maxTicks: 150 })).events.map(
        (e) => e.a.stamina,
      );

    expect(Math.min(...staminaSeries(STRIKER))).toBe(0); // basic commits even gassed ⇒ floors
    expect(Math.min(...staminaSeries(DRAIN_THEN_THROW))).toBeGreaterThan(0); // special locked out ⇒ stalls at the band
  });

  it("a gassed strike recovers slower than a fresh one by exactly the gas penalty", () => {
    // A re-striker whiffs in place; each strike spends 20 (100 → 80 → 60 → 40 → 20 → 0). The 4th
    // strike (commit at 40, post-spend 20 ≤ gasThreshold) is the first committed GASSED, so its
    // recovery eats the flat penalty — widening the gap before the 5th strike. The recovery of the
    // 3rd strike (post-spend 40, fresh) sets the baseline gap. The DIFFERENCE is the penalty alone.
    const ticks = attackTicks(
      runFight(
        fight({ botA: restrikeWhenFree("mid"), botB: IDLE, maxTicks: 130 }),
      ).events,
      "a",
    );

    const freshGap = ticks[3] - ticks[2]; // gap set by the 3rd (fresh) strike's recovery
    const gassedGap = ticks[4] - ticks[3]; // gap set by the 4th (gassed) strike's recovery

    expect(gassedGap).toBeGreaterThan(freshGap); // a gassed commit recovers slower
    expect(gassedGap - freshGap).toBe(6); // …by exactly gasRecoveryPenalty
  });
});

// ════════════════════════════════════════════════════════════════════════════
// C9 — the multi-move "real karate" arsenal wired into CANONICAL_RULES.
// Four named WKF techniques with genuine reach / speed / score / cost trade-offs and
// cross-move cancel routes, proven by RELATIONSHIP tests (the design inequalities), not
// literals in isolation. The abstract `strike` has been retired (S7.3) — the four named
// techniques are the whole roster.
// ════════════════════════════════════════════════════════════════════════════
describe("CANONICAL_RULES — the C9 arsenal: structural shape", () => {
  it("orders reach throw < sweep < jab < reverse < front < roundhouse (the spacing hierarchy)", () => {
    expect(throwSpec().reach).toBeLessThan(sweepSpec().reach);
    expect(sweepSpec().reach).toBeLessThan(kizami().reach);
    expect(kizami().reach).toBeLessThan(gyaku().reach);
    expect(gyaku().reach).toBeLessThan(mae().reach);
    expect(mae().reach).toBeLessThan(mawashi().reach);
  });

  it("keeps every committed technique reactable (startup ≥ lAct + 1)", () => {
    for (const m of [kizami(), gyaku(), mae(), mawashi()]) {
      expect(m.startup).toBeGreaterThanOrEqual(lAct() + 1);
    }
  });

  it("keeps every technique's whiff punishable (recovery ≥ lAct + the fastest punish startup)", () => {
    for (const m of [kizami(), gyaku(), mae(), mawashi()]) {
      expect(m.recovery).toBeGreaterThanOrEqual(lAct() + kizami().startup);
    }
  });

  it("scores the punches a single yuko at high·mid", () => {
    expect(kizami().score).toBe(1);
    expect(kizami().bands).toEqual(["high", "mid"]);
    expect(gyaku().score).toBe(1);
    expect(gyaku().bands).toEqual(["high", "mid"]);
  });

  it("restricts the front kick to chudan (mid) for waza-ari (2)", () => {
    expect(mae().bands).toEqual(["mid"]);
    expect(mae().score).toBe(2);
  });

  it("rewards a jodan roundhouse with ippon (scoreByBand high 3, chudan fallback 2)", () => {
    expect(mawashi().bands).toEqual(["high", "mid"]);
    expect(mawashi().scoreByBand?.high).toBe(3);
    expect(mawashi().score).toBe(2);
  });

  it("prices the punches as basic (≤ gasThreshold) and the kicks as special (> gasThreshold)", () => {
    const gas = CANONICAL_RULES.stamina?.gasThreshold ?? 0;
    expect(kizami().staminaCost ?? 0).toBeLessThanOrEqual(gas);
    expect(gyaku().staminaCost ?? 0).toBeLessThanOrEqual(gas);
    expect(mae().staminaCost ?? 0).toBeGreaterThan(gas);
    expect(mawashi().staminaCost ?? 0).toBeGreaterThan(gas);
  });
});

describe("CANONICAL_RULES — the C9 arsenal: the reach hierarchy bites", () => {
  const scoreAtGap = (gap: number, move: MoveId): number =>
    runFight(
      fight({
        rules: deterministic({ startGap: gap }),
        botA: attackOnce(move, "mid"),
        botB: IDLE,
        maxTicks: 30,
      }),
    ).scores.a;

  it("at a gap between jab and reverse reach, the jab whiffs where the reverse connects", () => {
    // 220000: jab reach (210000) < gap < reverse reach (240000)
    expect(scoreAtGap(220000, "kizami-zuki")).toBe(0); // out of jab range ⇒ whiff
    expect(scoreAtGap(220000, "gyaku-zuki")).toBe(1); // reverse reaches ⇒ yuko
  });

  it("at a gap between front and roundhouse reach, the front kick whiffs where the roundhouse connects", () => {
    // 290000: front reach (270000) < gap < roundhouse reach (300000)
    expect(scoreAtGap(290000, "mae-geri")).toBe(0); // out of front-kick range ⇒ whiff
    expect(scoreAtGap(290000, "mawashi-geri")).toBe(2); // roundhouse reaches at chudan ⇒ waza-ari
  });
});

describe("CANONICAL_RULES — the C9 arsenal: band legality + band-dependent score", () => {
  const scoreAtBand = (move: MoveId, band: Band): number =>
    runFight(
      fight({
        rules: deterministic(),
        botA: attackOnce(move, band),
        botB: IDLE,
        maxTicks: 30,
      }),
    ).scores.a;

  it("the front kick is mid-only — high or low degrades to idle, mid scores waza-ari", () => {
    expect(scoreAtBand("mae-geri", "high")).toBe(0); // out of band ⇒ idle ⇒ no score
    expect(scoreAtBand("mae-geri", "low")).toBe(0);
    expect(scoreAtBand("mae-geri", "mid")).toBe(2);
  });

  it("the roundhouse scores ippon jodan and waza-ari chudan (band-dependent)", () => {
    expect(scoreAtBand("mawashi-geri", "high")).toBe(3); // jodan ⇒ ippon
    expect(scoreAtBand("mawashi-geri", "mid")).toBe(2); // chudan ⇒ waza-ari
  });
});

describe("CANONICAL_RULES — the C9 arsenal: the gas line splits punches from kicks", () => {
  // Positioned AT the gas line (start stamina = gasThreshold) on the canonical table — only the
  // start stamina is positioned (like deterministic() positions distance); the costs + threshold
  // stay canonical. The lockout is EMERGENT: a punch (basic ≤ gasThreshold) is affordable, a kick
  // (special > gasThreshold) is not — it degrades to idle and never scores.
  const gas = CANONICAL_RULES.stamina?.gasThreshold ?? 0;

  const atTheGasLine = deterministic({
    stamina: { ...CANONICAL_RULES.stamina, max: gas },
  });

  const scoreOf = (rules: Rules, move: MoveId): number =>
    runFight(
      fight({
        rules,
        botA: attackOnce(move, "mid"),
        botB: IDLE,
        maxTicks: 30,
      }),
    ).scores.a;

  it("a gassed fighter still commits a punch", () => {
    expect(scoreOf(atTheGasLine, "gyaku-zuki")).toBe(1); // basic affordable at the band ⇒ commits & scores
  });

  it("a gassed fighter's kicks lock out (degrade to idle, no score)", () => {
    expect(scoreOf(atTheGasLine, "mae-geri")).toBe(0); // special unaffordable at the band ⇒ idle
    expect(scoreOf(atTheGasLine, "mawashi-geri")).toBe(0);
  });

  it("the same kick commits at full stamina — proving the lockout is the gas band, not an inherent whiff", () => {
    expect(scoreOf(deterministic(), "mae-geri")).toBe(2); // full reserve ⇒ the kick commits & scores
  });
});

describe("CANONICAL_RULES — the C9 arsenal: the cross-move cancel web (rekka)", () => {
  it("a connecting jab cancels into the reverse (kizami-zuki → gyaku-zuki)", () => {
    const cancelTick = kizami().startup + kizami().active; // first recovery frame

    const result = runFight(
      fight({
        rules: deterministic(),
        botA: comboAtTicks([
          { tick: 0, move: "kizami-zuki", band: "mid" },
          { tick: cancelTick, move: "gyaku-zuki", band: "mid" },
        ]),
        botB: IDLE,
        maxTicks: 40,
      }),
    );

    expect(result.scores.a).toBe(2); // jab (1) + cancelled reverse (1)
  });

  it("a connecting reverse cancels into the roundhouse (gyaku-zuki → mawashi-geri)", () => {
    const cancelTick = gyaku().startup + gyaku().active;

    const result = runFight(
      fight({
        rules: deterministic(),
        botA: comboAtTicks([
          { tick: 0, move: "gyaku-zuki", band: "mid" },
          { tick: cancelTick, move: "mawashi-geri", band: "mid" },
        ]),
        botB: IDLE,
        maxTicks: 40,
      }),
    );

    expect(result.scores.a).toBe(3); // reverse (1) + cancelled roundhouse chudan (2)
  });

  it("a connecting front kick cancels back into a punch (mae-geri → gyaku-zuki)", () => {
    const cancelTick = mae().startup + mae().active;

    const result = runFight(
      fight({
        rules: deterministic(),
        botA: comboAtTicks([
          { tick: 0, move: "mae-geri", band: "mid" },
          { tick: cancelTick, move: "gyaku-zuki", band: "mid" },
        ]),
        botB: IDLE,
        maxTicks: 40,
      }),
    );

    expect(result.scores.a).toBe(3); // front kick (2) + cancelled reverse (1)
  });

  it("a connecting reverse can also cancel into the front kick (gyaku-zuki → mae-geri)", () => {
    const cancelTick = gyaku().startup + gyaku().active;

    const result = runFight(
      fight({
        rules: deterministic(),
        botA: comboAtTicks([
          { tick: 0, move: "gyaku-zuki", band: "mid" },
          { tick: cancelTick, move: "mae-geri", band: "mid" },
        ]),
        botB: IDLE,
        maxTicks: 40,
      }),
    );

    expect(result.scores.a).toBe(3); // reverse (1) + cancelled front kick (2)
  });

  it("a connecting roundhouse cancels back into a punch (mawashi-geri → gyaku-zuki)", () => {
    const cancelTick = mawashi().startup + mawashi().active;

    const result = runFight(
      fight({
        rules: deterministic(),
        botA: comboAtTicks([
          { tick: 0, move: "mawashi-geri", band: "mid" },
          { tick: cancelTick, move: "gyaku-zuki", band: "mid" },
        ]),
        botB: IDLE,
        maxTicks: 40,
      }),
    );

    expect(result.scores.a).toBe(3); // roundhouse chudan (2) + cancelled reverse (1)
  });

  it("a sweep hit-confirms into a reverse-punch okizeme finish (sweep → gyaku-zuki)", () => {
    const cancelTick = sweepSpec().startup + sweepSpec().active; // first recovery frame ⇒ cancels

    const result = runFight(
      sweepFight({
        botA: bot(
          [
            { when: clk("eq", 0), do: { type: "sweep" } },
            {
              when: clk("eq", cancelTick),
              do: { type: "attack", move: "gyaku-zuki", band: "mid" },
            },
          ],
          { type: "idle" },
        ),
        botB: IDLE,
        maxTicks: 40,
      }),
    );

    expect(result.scores.a).toBe(3); // sweep knockdown (0) + okizeme finish (finishScore 3)
  });
});

// ─── No-Pareto-dominance balance-law property (rule 2) ─────────────────────────
// The full 12-move roster (10 named attack moves + sweep + throw) must be free of
// Pareto dominance on the 7 strategic axes — no move equal-or-better on EVERY axis
// and strictly better on ONE — so move variety never collapses into a single best
// move (docs/move-roster.md §Balance law → "Verification hook"). The detector and
// adapter below are test-local (Stryker excludes *.test.ts), so their logic is
// pinned by explicit directional fixtures, not by a mutation run.
//
// Axis vector: reach↑, effective score↑ (max over scoreByBand), startup↓, recovery↓,
// staminaCost↓, bands (set-inclusion ⊇), knockdown (true↑). `grab` is a synthetic
// band token for the throw — incomparable to every strike, kept out of engine `Band`.
// `air` is the same device for air moves (`air: true`): an airborne technique is
// genuinely non-substitutable for a grounded one (no jump ⇒ no air move), so it maps
// to its own incomparable band and never Pareto-compares with a ground move.
type BandToken = Band | "grab" | "air";
type Axes = {
  reach: number;
  score: number;
  startup: number;
  recovery: number;
  cost: number;
  bands: Set<BandToken>;
  knockdown: boolean;
};

const bandSet = (...b: BandToken[]): Set<BandToken> => new Set(b);

// Axis-vector fixture factory — override one axis at a time to pin each direction.
const axes = (o?: Partial<Axes>): Axes => ({
  reach: 200000,
  score: 1,
  startup: 10,
  recovery: 15,
  cost: 20,
  bands: bandSet("high", "mid"),
  knockdown: false,
  ...o,
});

// The 7 axes as strength comparators: `atLeast` = A is ≥ B on this axis; `better` =
// A is strictly stronger. Numeric axes are total orders (higher- or lower-is-better);
// bands is a PARTIAL order by set-inclusion; knockdown is boolean (true is a strength).
type Axis = {
  atLeast: (a: Axes, b: Axes) => boolean;
  better: (a: Axes, b: Axes) => boolean;
};

const higher = (of: (x: Axes) => number): Axis => ({
  atLeast: (a, b) => of(a) >= of(b),
  better: (a, b) => of(a) > of(b),
});

const lower = (of: (x: Axes) => number): Axis => ({
  atLeast: (a, b) => of(a) <= of(b),
  better: (a, b) => of(a) < of(b),
});

const superset = (a: Set<BandToken>, b: Set<BandToken>): boolean =>
  [...b].every((band) => a.has(band));

const AXES: Axis[] = [
  higher((x) => x.reach),
  higher((x) => x.score),
  lower((x) => x.startup),
  lower((x) => x.recovery),
  lower((x) => x.cost),
  {
    atLeast: (a, b) => superset(a.bands, b.bands),
    better: (a, b) => superset(a.bands, b.bands) && !superset(b.bands, a.bands),
  },
  {
    atLeast: (a, b) => a.knockdown || !b.knockdown,
    better: (a, b) => a.knockdown && !b.knockdown,
  },
];

// A Pareto-dominates B iff A is at-least-as-strong on EVERY axis AND strictly
// stronger on at least ONE.
const dominates = (a: Axes, b: Axes): boolean =>
  AXES.every((axis) => axis.atLeast(a, b)) &&
  AXES.some((axis) => axis.better(a, b));

// ── Project each move into the common axis vector. The three heterogeneous cases:
//   • an `air` move — maps to its own incomparable `air` band (like the throw's `grab`),
//     so an airborne technique never Pareto-compares with a grounded one.
//   • sweep — its low band is MECHANICAL (it declares no `bands`), so hard-map {low}
//     (a bare `?? all` would read it as unrestricted and let it dominate hiza-geri).
//   • a non-sweep move with no `bands` is genuinely unrestricted ⇒ {high, mid, low}.
const moveToAxes = (id: string, m: MoveSpec): Axes => {
  const bands: BandToken[] = m.air
    ? ["air"]
    : id === "sweep"
      ? ["low"]
      : (m.bands ?? ["high", "mid", "low"]);

  return {
    reach: m.reach,
    score: Math.max(m.score, ...Object.values(m.scoreByBand ?? {})),
    startup: m.startup,
    recovery: m.recovery,
    cost: m.staminaCost ?? 0,
    bands: bandSet(...bands),
    knockdown: m.knockdown ?? false,
  };
};

// A throw is a ThrowSpec (no bands / knockdown / scoreByBand): its own incomparable
// `grab` band (never a high/mid/low strike), an implicit knockdown, its flat ippon.
const throwToAxes = (t: ThrowSpec): Axes => ({
  reach: t.reach,
  score: t.score,
  startup: t.startup,
  recovery: t.recovery,
  cost: t.staminaCost ?? 0,
  bands: bandSet("grab"),
  knockdown: true,
});

type RosterEntry = { id: string; axes: Axes };

// Every ORDERED pair (i ≠ j — self-pairs excluded) where the first dominates the second.
const findDominatedPairs = (
  roster: RosterEntry[],
): Array<{ dominator: string; dominated: string }> =>
  roster.flatMap((a, i) =>
    roster.flatMap((b, j) =>
      i !== j && dominates(a.axes, b.axes)
        ? [{ dominator: a.id, dominated: b.id }]
        : [],
    ),
  );

// The full 12-move roster, enumerated DYNAMICALLY (future moves auto-enroll): every
// configured `moves` entry + the throw (its presence asserted, never silently skipped).
const canonicalRoster = (): RosterEntry[] => {
  const moves = Object.entries(CANONICAL_RULES.moves).flatMap(([id, spec]) =>
    spec ? [{ id, axes: moveToAxes(id, spec) }] : [],
  );

  const t = CANONICAL_RULES.throw;
  if (!t) throw new Error("CANONICAL_RULES.throw is not configured");

  return [...moves, { id: "throw", axes: throwToAxes(t) }];
};

// Two moves are duplicates iff they share an IDENTICAL axis vector on all 7 axes
// (bandEqual = mutual set-inclusion). `active` / `cancelInto` are NOT axes ⇒ moves
// differing only in those are treated as non-distinct (balance-law rule 4).
const bandEqual = (a: Set<BandToken>, b: Set<BandToken>): boolean =>
  superset(a, b) && superset(b, a);

const axesEqual = (a: Axes, b: Axes): boolean =>
  a.reach === b.reach &&
  a.score === b.score &&
  a.startup === b.startup &&
  a.recovery === b.recovery &&
  a.cost === b.cost &&
  bandEqual(a.bands, b.bands) &&
  a.knockdown === b.knockdown;

// Every UNORDERED pair (i < j — self-pairs excluded, no double-count) with an
// identical axis vector.
const findDuplicatePairs = (
  roster: RosterEntry[],
): Array<{ a: string; b: string }> =>
  roster.flatMap((a, i) =>
    roster
      .slice(i + 1)
      .flatMap((b) =>
        axesEqual(a.axes, b.axes) ? [{ a: a.id, b: b.id }] : [],
      ),
  );

describe("no-Pareto-dominance — the dominance detector (balance-law rule 2)", () => {
  it("flags a move with longer reach alone (equal on every other axis)", () => {
    expect(dominates(axes({ reach: 250000 }), axes())).toBe(true);
    expect(dominates(axes(), axes({ reach: 250000 }))).toBe(false);
  });

  it("flags a move scoring higher alone", () => {
    expect(dominates(axes({ score: 3 }), axes())).toBe(true);
    expect(dominates(axes(), axes({ score: 3 }))).toBe(false);
  });

  it("treats a lower startup as the stronger move (faster is better)", () => {
    expect(dominates(axes({ startup: 5 }), axes())).toBe(true);
    expect(dominates(axes(), axes({ startup: 5 }))).toBe(false);
  });

  it("treats a lower recovery as the stronger move", () => {
    expect(dominates(axes({ recovery: 10 }), axes())).toBe(true);
    expect(dominates(axes(), axes({ recovery: 10 }))).toBe(false);
  });

  it("treats a lower stamina cost as the stronger move (cheaper is better)", () => {
    expect(dominates(axes({ cost: 10 }), axes())).toBe(true);
    expect(dominates(axes(), axes({ cost: 10 }))).toBe(false);
  });

  it("treats a superset of legal bands as the stronger move", () => {
    const wide = axes({ bands: bandSet("high", "mid", "low") });
    expect(dominates(wide, axes())).toBe(true);
    expect(dominates(axes(), wide)).toBe(false);
  });

  it("treats a knockdown as a strength over a non-knockdown", () => {
    expect(dominates(axes({ knockdown: true }), axes())).toBe(true);
    expect(dominates(axes(), axes({ knockdown: true }))).toBe(false);
  });

  it("never dominates across incomparable band sets (low vs mid)", () => {
    expect(
      dominates(
        axes({ bands: bandSet("low") }),
        axes({ bands: bandSet("mid") }),
      ),
    ).toBe(false);
    expect(
      dominates(
        axes({ bands: bandSet("mid") }),
        axes({ bands: bandSet("low") }),
      ),
    ).toBe(false);
  });

  it("never dominates across the air island — a ground move cannot substitute for an air move", () => {
    // A STRONG ground move (the default axes, {high, mid}) vs a strictly-WORSE air move
    // (worse on every numeric axis). Numerically the ground move dominates outright — but
    // the incomparable `air` band blocks it BOTH ways: air is non-substitutable, exactly
    // like the throw's `grab`. Proves the island survives even a lopsided matchup.
    const air = axes({
      bands: bandSet("air"),
      reach: 100000,
      score: 1,
      startup: 20,
      recovery: 30,
      cost: 60,
    });

    expect(dominates(axes(), air)).toBe(false); // the strong ground move can't dominate the air move
    expect(dominates(air, axes())).toBe(false); // nor vice versa
  });

  it("does not dominate when better on one axis but worse on another (needs ALL axes ≥)", () => {
    // Longer reach, but slower startup — the single worse axis blocks dominance.
    expect(dominates(axes({ reach: 250000, startup: 20 }), axes())).toBe(false);
  });

  it("does not dominate an identical move (needs a strictly-better axis)", () => {
    expect(dominates(axes(), axes())).toBe(false);
  });
});

describe("no-Pareto-dominance — the move→axis adapter", () => {
  it("maps the sweep to its mechanical low band (its MoveSpec declares no `bands`)", () => {
    const sweep = CANONICAL_RULES.moves.sweep;
    if (!sweep)
      throw new Error("CANONICAL_RULES.moves.sweep is not configured");
    expect(sweep.bands).toBeUndefined(); // the low-ness is mechanical, not declared
    expect(moveToAxes("sweep", sweep).bands).toEqual(bandSet("low"));
  });

  it("maps the throw to an incomparable `grab` band, a knockdown, and its ippon score", () => {
    const t = CANONICAL_RULES.throw;
    if (!t) throw new Error("CANONICAL_RULES.throw is not configured");
    const a = throwToAxes(t);
    expect(a.bands).toEqual(bandSet("grab"));
    expect(a.knockdown).toBe(true);
    expect(a.score).toBe(3);
  });

  it("maps an `air` move to its own incomparable `air` band (regardless of its real bands)", () => {
    const airKick: MoveSpec = {
      startup: 4,
      active: 3,
      recovery: 14,
      score: 2,
      reach: 250000,
      bands: ["high", "mid"], // real occupancy bands — but the axis projection ignores them
      air: true,
    };

    // the projection collapses the real high/mid to the single incomparable `air`
    // token, so a ground move's {high, mid} can never be a superset of it (and vice
    // versa) ⇒ air and ground never Pareto-compare
    expect(moveToAxes("tobi-geri", airKick).bands).toEqual(bandSet("air"));
  });

  it("folds scoreByBand into the effective score (mawashi/ushiro read as their jodan 3)", () => {
    expect(moveToAxes("mawashi-geri", mawashi()).score).toBe(3);
    expect(moveToAxes("ushiro-geri", ushiro()).score).toBe(3);
  });

  it("keeps a move's flat score when it declares no scoreByBand", () => {
    expect(moveToAxes("empi", empi()).score).toBe(2);
  });

  it("maps the frame fields straight onto the axes (reach / startup / recovery / cost)", () => {
    const g = gyaku();
    const a = moveToAxes("gyaku-zuki", g);
    expect(a.reach).toBe(g.reach);
    expect(a.startup).toBe(g.startup);
    expect(a.recovery).toBe(g.recovery);
    expect(a.cost).toBe(g.staminaCost);
  });

  it("treats a non-sweep move with no declared bands as unrestricted (high·mid·low)", () => {
    const unrestricted: MoveSpec = {
      startup: 7,
      active: 2,
      recovery: 13,
      score: 1,
      reach: 100000,
    };

    const a = moveToAxes("hypothetical", unrestricted);

    expect(a.bands).toEqual(bandSet("high", "mid", "low"));
    expect(a.cost).toBe(0); // no staminaCost ⇒ the `?? 0` fallback
  });
});

describe("no-Pareto-dominance — the roster scan", () => {
  it("flags a dominated move: a clone strictly worse on reach alone (the guard bites)", () => {
    const strong: RosterEntry = { id: "strong", axes: axes({ reach: 240000 }) };
    const weak: RosterEntry = { id: "weak", axes: axes({ reach: 200000 }) };
    expect(findDominatedPairs([strong, weak])).toEqual([
      { dominator: "strong", dominated: "weak" },
    ]);
  });

  it("finds nothing in a roster of mutually non-dominating moves (reach ↔ cost trade-off)", () => {
    const a: RosterEntry = { id: "a", axes: axes({ reach: 240000, cost: 30 }) };
    const b: RosterEntry = { id: "b", axes: axes({ reach: 200000, cost: 20 }) };
    expect(findDominatedPairs([a, b])).toEqual([]);
  });
});

describe("no-Pareto-dominance — the canonical 13-move roster (balance-law rule 2)", () => {
  it("enumerates all 13 moves (11 attack moves + sweep + throw)", () => {
    expect(
      canonicalRoster()
        .map((e) => e.id)
        .sort(),
    ).toEqual([
      "empi",
      "gyaku-zuki",
      "hiza-geri",
      "kizami-zuki",
      "mae-geri",
      "mawashi-geri",
      "shuto",
      "sweep",
      "throw",
      "tobi-geri",
      "uraken",
      "ushiro-geri",
      "yoko-geri",
    ]);
  });

  it("contains no Pareto-dominated move", () => {
    expect(findDominatedPairs(canonicalRoster())).toEqual([]);
  });
});

// ─── Distinctness (balance-law rule 4) ─────────────────────────────────────────
// No two moves may share an IDENTICAL axis vector — the near-duplicate guard Pareto
// alone leaves open (an all-axes tie strictly-dominates nothing). Uses the SAME 7
// axes as dominance: a move distinguishable only by the EXCLUDED dimensions (active,
// cancelInto) is deemed non-distinct and flagged (docs/move-roster.md §Balance law).
describe("no-Pareto-dominance — distinctness (balance-law rule 4)", () => {
  it("flags two moves identical on all 7 axes but differing only in excluded dimensions", () => {
    // Same 7-axis vector; differ ONLY in `active` + `cancelInto`, which are NOT axes.
    const base: MoveSpec = {
      startup: 7,
      active: 2,
      recovery: 13,
      score: 1,
      reach: 200000,
      bands: ["high", "mid"],
      staminaCost: 20,
      cancelInto: ["gyaku-zuki"],
    };

    const twin: MoveSpec = { ...base, active: 5, cancelInto: [] };

    const roster: RosterEntry[] = [
      { id: "a", axes: moveToAxes("a", base) },
      { id: "b", axes: moveToAxes("b", twin) },
    ];

    expect(findDuplicatePairs(roster)).toEqual([{ a: "a", b: "b" }]);
  });

  // Every one of the 7 axes must participate in the equality — perturbing any single
  // axis (the band case a superset ⇒ bandEqual needs MUTUAL ⊇) makes the pair distinct.
  const oneAxisApart: ReadonlyArray<{ axis: string; override: Partial<Axes> }> =
    [
      { axis: "reach", override: { reach: 210000 } },
      { axis: "score", override: { score: 3 } },
      { axis: "startup", override: { startup: 99 } },
      { axis: "recovery", override: { recovery: 99 } },
      { axis: "cost", override: { cost: 99 } },
      { axis: "bands", override: { bands: bandSet("mid") } },
      { axis: "knockdown", override: { knockdown: true } },
    ];

  it.each(oneAxisApart)(
    "does not flag moves differing on $axis alone (all 7 axes must match)",
    ({ override }) => {
      expect(
        findDuplicatePairs([
          { id: "a", axes: axes() },
          { id: "b", axes: axes(override) },
        ]),
      ).toEqual([]);
    },
  );

  it("contains no duplicate move in the canonical 12-move roster", () => {
    expect(findDuplicatePairs(canonicalRoster())).toEqual([]);
  });
});
