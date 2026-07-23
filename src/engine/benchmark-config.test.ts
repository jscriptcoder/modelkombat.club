import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  BENCHMARK_VERSION,
  SEEDS,
  MAX_TICKS,
  MATCH,
  GAUNTLET_NAMES,
  INPUT_HASH,
} from "./benchmark-config.js";
import { CANONICAL_RULES } from "./rules.js";
import { loadBotDoc } from "../cli/load.js";

const botPath = (name: string): string =>
  fileURLToPath(new URL(`../../bots/${name}.json`, import.meta.url));

// The SCORING projection of a gauntlet bot: its document MINUS the inert `model`
// provenance field. `model` is never read by the interpreter (invariant #1), so it
// cannot change a score and must NOT sit in the scoring-input guard — otherwise
// renaming an author would force a spurious BENCHMARK_VERSION bump (and reset the
// live ladder) for a change that moves nothing. Parsing also normalises away pure
// formatting, so the guard tracks scoring CONTENT, not raw bytes.
const scoringText = (botText: string): string => {
  const { model: _provenance, ...scoring } = JSON.parse(botText) as Record<
    string,
    unknown
  >;

  return JSON.stringify(scoring);
};

// The digest of every input that determines a benchmark score: the frame table,
// the run parameters, and the scoring content of each gauntlet bot. If any TRUE
// scoring input drifts, the digest changes — the guard test below then fails until
// BENCHMARK_VERSION (and INPUT_HASH) are bumped, so a stale version can never
// silently compare across different scoring rules.
const hashInputs = (gauntletTexts: readonly string[]): string => {
  const payload = JSON.stringify({
    rules: CANONICAL_RULES,
    seeds: SEEDS,
    maxTicks: MAX_TICKS,
    match: MATCH,
    gauntlet: gauntletTexts.map(scoringText),
  });

  return createHash("sha256").update(payload).digest("hex");
};

const gauntletTexts = (): string[] =>
  GAUNTLET_NAMES.map((name) => readFileSync(botPath(name), "utf8"));

const computeInputHash = (): string => hashInputs(gauntletTexts());

describe("benchmark config — the frozen, versioned manifest", () => {
  it("freezes the 6-archetype gauntlet roster in its locked order", () => {
    expect(GAUNTLET_NAMES).toEqual([
      "jabber",
      "rekka",
      "zoner",
      "grappler",
      "sweeper",
      "vulture",
    ]);
  });

  it("freezes the run parameters: seeds 1..10 at 600 ticks, WKF match at an 8-point gap with senshu + jogai + passivity + overtime", () => {
    expect(SEEDS).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(MAX_TICKS).toBe(600);
    expect(MATCH).toEqual({
      winGap: 8,
      senshu: true,
      jogai: { margin: 100000 },
      passivity: { limit: 240 },
      overtime: { ticks: 300 },
    });
  });

  it("carries BENCHMARK_VERSION v20 (fresh pure-KotH season — the House-seeded arena opens; no scoring change, INPUT_HASH unchanged)", () => {
    expect(BENCHMARK_VERSION).toBe("v20");
  });

  it("every gauntlet bot loads + validates through the real gate (roster integrity)", () => {
    for (const name of GAUNTLET_NAMES) {
      expect(() =>
        loadBotDoc(readFileSync(botPath(name), "utf8")),
      ).not.toThrow();
    }
  });

  it("pins the scoring inputs to INPUT_HASH — bump BENCHMARK_VERSION + INPUT_HASH when this fails", () => {
    expect(computeInputHash()).toBe(INPUT_HASH);
  });

  it("excludes the inert `model` field — changing a gauntlet bot's model never moves the hash", () => {
    // model is provenance, not a scoring input; the guard must ignore it so adding
    // or renaming an author can never force a spurious BENCHMARK_VERSION bump.
    const remodeled = gauntletTexts().map((t) => {
      const doc = JSON.parse(t) as Record<string, unknown>;

      return JSON.stringify({ ...doc, model: "SOME-DIFFERENT-AUTHOR" });
    });

    expect(hashInputs(remodeled)).toBe(computeInputHash());
  });
});
