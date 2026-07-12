import { describe, it, expect } from "vitest";
import {
  renderReport,
  runTelemetryCli,
  type TelemetryDeps,
} from "./run-telemetry.js";
import type { Rules } from "../engine/types.js";
import type { BotDoc } from "../engine/dsl.js";
import type { VarietyReport } from "../engine/telemetry.js";

// ─── fixtures: MOCK rules WITHOUT perception ⇒ deterministic, seed-independent
// fights. Three attack moves with IDENTICAL timing so three distinct one-move bots
// commit at the same cadence — a perfectly balanced round-robin (each ~1/3 share,
// below the 35% flag), plus a single-move population that dominates outright. ────
const TIMING = { startup: 4, active: 2, recovery: 6, reach: 250000 };

const MOCK_RULES: Rules = {
  tickRate: 60,
  walkSpeed: 4000,
  ring: { width: 600000 },
  startGap: 200000,
  moves: {
    "gyaku-zuki": { ...TIMING, score: 1 },
    "mae-geri": { ...TIMING, score: 2 },
    "mawashi-geri": { ...TIMING, score: 2 },
  },
};

type OneMove = "gyaku-zuki" | "mae-geri" | "mawashi-geri";

const bot = (name: string, move: OneMove): BotDoc => ({
  version: 1,
  name,
  rules: [],
  default: { type: "attack", move, band: "mid" },
});

const deps = (population: BotDoc[]): TelemetryDeps => ({
  loadPopulation: () => population,
  rules: MOCK_RULES,
  seeds: [1, 2],
  maxTicks: 30,
  version: "test",
});

const BALANCED = [
  bot("g", "gyaku-zuki"),
  bot("m", "mae-geri"),
  bot("w", "mawashi-geri"),
];

const ALL_TECHNIQUES = [
  "sweep",
  "kizami-zuki",
  "gyaku-zuki",
  "mae-geri",
  "mawashi-geri",
  "uraken",
  "shuto",
  "yoko-geri",
  "ushiro-geri",
  "empi",
  "hiza-geri",
  "tobi-geri",
  "throw",
];

describe("runTelemetryCli", () => {
  it("renders every technique with a one-decimal share and exits 0 with a clean stderr", () => {
    const out = runTelemetryCli(deps(BALANCED));

    expect(out.code).toBe(0);
    expect(out.stderr).toBe("");
    expect(out.stdout.endsWith("\n")).toBe(true); // trailing newline (POSIX text)
    for (const technique of ALL_TECHNIQUES)
      expect(out.stdout).toContain(technique);
    expect(out.stdout).toMatch(/\d\.\d%/); // shares shown to one decimal place
    expect(out.stdout).toContain("0.0%"); // an unfired technique still prints 0.0%
  });

  it("flags a dominant technique with ⚠ and prints a legend naming the 35% threshold", () => {
    // both bots commit only gyaku-zuki ⇒ gyaku is 100% of commitments ⇒ dominant.
    const out = runTelemetryCli(
      deps([bot("g1", "gyaku-zuki"), bot("g2", "gyaku-zuki")]),
    );

    expect(out.code).toBe(0);
    expect(out.stdout).toContain("⚠");
    expect(out.stdout).toContain("35%"); // the legend references the flag threshold
  });

  it("prints no ⚠ (and no legend) when no technique crosses the threshold", () => {
    // three moves at ~33.3% each — all below 35%.
    const out = runTelemetryCli(deps(BALANCED));

    expect(out.stdout).not.toContain("⚠");
    expect(out.stdout).not.toContain("35%");
  });

  it("is deterministic — two runs produce byte-identical stdout", () => {
    const first = runTelemetryCli(
      deps([bot("g", "gyaku-zuki"), bot("m", "mae-geri")]),
    );

    const second = runTelemetryCli(
      deps([bot("g", "gyaku-zuki"), bot("m", "mae-geri")]),
    );

    expect(first.stdout).toBe(second.stdout);
  });

  it("fails fast — non-zero exit, empty stdout, and a stderr message — when the population can't load", () => {
    const out = runTelemetryCli({
      ...deps([]),
      loadPopulation: () => {
        throw new Error("cannot read bot file: bots/jabber.json");
      },
    });

    expect(out.code).not.toBe(0);
    expect(out.stdout).toBe("");
    expect(out.stderr).toContain("cannot read bot file");
  });
});

// Exact-output tests over synthetic reports — stdout is a contract, so the aligned
// columns, the ⚠ flag, and the legend are pinned byte-for-byte (space runs are
// spelled out with `" ".repeat(n)` so the alignment is reviewable). Presentation
// logic is not reached by the node-only mutation runner via containment alone.
const report = (rows: VarietyReport["rows"]): VarietyReport => ({
  rows,
  totalCommitments: rows.reduce((sum, r) => sum + r.count, 0),
});

describe("renderReport — exact histogram layout", () => {
  it("aligns the columns, flags a dominant row with ⚠, and appends the threshold legend", () => {
    const out = renderReport(
      report([
        { technique: "gyaku-zuki", count: 3, share: 0.6, dominant: true },
        { technique: "sweep", count: 2, share: 0.4, dominant: false },
      ]),
    );

    expect(out).toBe(
      "technique" +
        " ".repeat(3) +
        "count" +
        " ".repeat(2) +
        "share" +
        "\n" +
        "gyaku-zuki" +
        " ".repeat(6) +
        "3" +
        " ".repeat(2) +
        "60.0%" +
        " ".repeat(2) +
        "⚠" +
        "\n" +
        "sweep" +
        " ".repeat(11) +
        "2" +
        " ".repeat(2) +
        "40.0%" +
        "\n\n" +
        "⚠ = over 35% of all honoured commitments",
    );
  });

  it("shows shares to one decimal and omits the flag column and legend when nothing is dominant", () => {
    const out = renderReport(
      report([
        { technique: "gyaku-zuki", count: 1, share: 1 / 3, dominant: false },
        { technique: "mae-geri", count: 1, share: 1 / 3, dominant: false },
      ]),
    );

    expect(out).toBe(
      "technique" +
        " ".repeat(3) +
        "count" +
        " ".repeat(2) +
        "share" +
        "\n" +
        "gyaku-zuki" +
        " ".repeat(6) +
        "1" +
        " ".repeat(2) +
        "33.3%" +
        "\n" +
        "mae-geri" +
        " ".repeat(8) +
        "1" +
        " ".repeat(2) +
        "33.3%",
    );
  });
});
