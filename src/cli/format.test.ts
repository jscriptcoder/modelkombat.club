import { describe, it, expect } from "vitest";
import { formatAction, formatFight } from "./format.js";
import type { FightResult, FightEvent, FighterFrame } from "../engine/sim.js";
import type { Action } from "../engine/types.js";

// ─── factories ───────────────────────────────────────────────────────────────
const frame = (o: Partial<FighterFrame> = {}): FighterFrame => ({
  x: 0,
  y: 0,
  action: { type: "idle" },
  points: 0,
  stamina: 0,
  degrade: null,
  ...o,
});

const event = (
  tick: number,
  a: Partial<FighterFrame>,
  b: Partial<FighterFrame>,
): FightEvent => ({ tick, a: frame(a), b: frame(b) });

const result = (
  events: FightEvent[],
  o: Partial<FightResult> = {},
): FightResult => ({
  winner: "draw",
  ticks: events.length,
  scores: { a: 0, b: 0 },
  events,
  endReason: "time",
  fouls: { a: { jogai: 0, passivity: 0 }, b: { jogai: 0, passivity: 0 } },
  ...o,
});

// Count rendered fighter rows (a data row starts, once trimmed, with a digit —
// the tick number; the header starts with the word "tick").
const dataRows = (out: string): string[] =>
  out.split("\n").filter((l) => /^\s*\d/.test(l));

describe("formatAction", () => {
  it.each<[Action, string]>([
    [{ type: "idle" }, "idle"],
    [{ type: "move", dir: 1 }, "move +1"],
    [{ type: "move", dir: -1 }, "move -1"],
    [{ type: "move", dir: 0 }, "move 0"],
    [{ type: "block", band: "mid" }, "block mid"],
    [{ type: "block", band: "high" }, "block high"],
    [{ type: "crouch" }, "crouch"],
    [{ type: "jump", dir: 1 }, "jump +1"],
    [{ type: "attack", move: "gyaku-zuki", band: "high" }, "gyaku-zuki high"],
    [{ type: "sweep" }, "sweep"],
    [{ type: "throw" }, "throw"],
    [{ type: "throw-break" }, "break"],
  ])("renders %o as %s", (action, expected) => {
    expect(formatAction(action)).toBe(expected);
  });
});

describe("formatFight — layout", () => {
  it("prints a header row naming the tick and points columns", () => {
    const out = formatFight(result([event(0, {}, {})]), { seed: 1 });
    const header = out.split("\n")[0];
    expect(header).toContain("tick");
    expect(header.toLowerCase()).toContain("a");
    expect(header.toLowerCase()).toContain("b");
  });

  it("ends with a WINNER line carrying the score, seed and tick count", () => {
    const out = formatFight(
      result([event(0, { points: 3 }, { points: 1 })], {
        winner: "A",
        scores: { a: 3, b: 1 },
        ticks: 42,
      }),
      { seed: 7 },
    );

    expect(out).toMatch(/WINNER:\s*A/);
    expect(out).toContain("3-1");
    expect(out).toContain("seed=7");
    expect(out).toContain("ticks=42");
  });

  it("labels a tie as a draw", () => {
    const out = formatFight(result([event(0, {}, {})]), { seed: 1 });
    expect(out.toLowerCase()).toContain("draw");
  });
});

describe("formatFight — table content", () => {
  it("heads every column with its label", () => {
    const header = formatFight(result([event(0, {}, {})]), {
      seed: 1,
    }).split("\n")[0];

    for (const label of [
      "tick",
      "A.x",
      "B.x",
      "A act",
      "B act",
      "A.sta",
      "B.sta",
      "A pts",
      "B pts",
    ]) {
      expect(header).toContain(label);
    }
  });

  it("renders each fighter's position, stamina and score in the row", () => {
    // Distinct values so each cell is individually identifiable in the output.
    const out = formatFight(
      result([
        event(
          0,
          { x: 111, stamina: 42, points: 3 },
          { x: 222, stamina: 17, points: 5 },
        ),
      ]),
      { seed: 1, mode: "full" },
    );

    for (const value of ["111", "222", "42", "17", "3", "5"]) {
      expect(out).toContain(value);
    }
  });
});

describe("formatFight — degrade reason", () => {
  it("annotates a degraded action with its typed reason in full mode", () => {
    const out = formatFight(
      result([
        event(
          0,
          {
            action: { type: "attack", move: "mawashi-geri", band: "high" },
            degrade: "unaffordable",
          },
          {},
        ),
      ]),
      { seed: 1, mode: "full" },
    );

    expect(out).toContain("mawashi-geri high");
    expect(out).toContain("unaffordable");
  });

  it("leaves an honoured (non-degraded) action unannotated — no reason in parentheses", () => {
    const out = formatFight(
      result([
        event(
          0,
          {
            action: { type: "attack", move: "gyaku-zuki", band: "mid" },
            degrade: null,
          },
          {},
        ),
      ]),
      { seed: 1, mode: "full" },
    );

    expect(out).toContain("gyaku-zuki mid");
    expect(out).not.toContain("gyaku-zuki mid ("); // no `(reason)` tacked on
    expect(out).not.toContain("null");
  });

  it("annotates a degraded action in changes mode too", () => {
    const out = formatFight(
      result([event(0, { action: { type: "sweep" }, degrade: "inert" }, {})]),
      { seed: 1 },
    );

    expect(out).toContain("sweep");
    expect(out).toContain("inert");
  });

  it("emits a new changes-mode row when a degrade appears then clears", () => {
    // The action string and points are constant across all four ticks — only the
    // degrade reason changes, so ONLY the degrade transitions should break the collapse.
    const strike: Action = { type: "attack", move: "gyaku-zuki", band: "mid" };

    const events: FightEvent[] = [
      event(0, { action: strike, degrade: null }, {}),
      event(1, { action: strike, degrade: "locked" }, {}),
      event(2, { action: strike, degrade: "locked" }, {}),
      event(3, { action: strike, degrade: null }, {}),
    ];

    const rows = dataRows(formatFight(result(events), { seed: 1 }));
    // tick 0 (first), tick 1 (degrade appears), tick 3 (degrade clears); tick 2 collapses.
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatch(/^\s*0\b/);
    expect(rows[1]).toMatch(/^\s*1\b/);
    expect(rows[2]).toMatch(/^\s*3\b/);
  });

  it("breaks the collapse on a B-side action or score change (not only A)", () => {
    // A holds one action throughout; only B changes — first its action, then its score.
    const events: FightEvent[] = [
      event(0, {}, { action: { type: "idle" } }),
      event(1, {}, { action: { type: "move", dir: -1 } }), // B action changes
      event(2, {}, { action: { type: "move", dir: -1 } }),
      event(3, {}, { action: { type: "move", dir: -1 }, points: 1 }), // B score changes
    ];

    const rows = dataRows(formatFight(result(events), { seed: 1 }));
    // tick 0 (first), tick 1 (B action), tick 3 (B score); tick 2 collapses.
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatch(/^\s*0\b/);
    expect(rows[1]).toMatch(/^\s*1\b/);
    expect(rows[2]).toMatch(/^\s*3\b/);
  });
});

describe("formatFight — full vs changes mode", () => {
  // Three ticks of identical actions, then an action change, then a score change.
  const events: FightEvent[] = [
    event(
      0,
      { action: { type: "move", dir: 1 } },
      { action: { type: "idle" } },
    ),
    event(
      1,
      { action: { type: "move", dir: 1 } },
      { action: { type: "idle" } },
    ),
    event(
      2,
      { action: { type: "move", dir: 1 } },
      { action: { type: "idle" } },
    ),
    event(
      3,
      { action: { type: "attack", move: "gyaku-zuki", band: "high" } },
      { action: { type: "idle" } },
    ),
    event(
      4,
      {
        action: { type: "attack", move: "gyaku-zuki", band: "high" },
        points: 1,
      },
      { action: { type: "idle" } },
    ),
  ];

  it("emits one row per tick in full mode", () => {
    const out = formatFight(result(events), { seed: 1, mode: "full" });
    expect(dataRows(out)).toHaveLength(5);
  });

  it("collapses unchanged ticks in changes mode (the default)", () => {
    const out = formatFight(result(events), { seed: 1 });
    const rows = dataRows(out);
    // tick 0 (first), tick 3 (action change), tick 4 (score change) = 3 rows;
    // ticks 1 and 2 (identical to 0) are collapsed away.
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatch(/^\s*0\b/);
    expect(rows[1]).toMatch(/^\s*3\b/);
    expect(rows[2]).toMatch(/^\s*4\b/);
  });
});
