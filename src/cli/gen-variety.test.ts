import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { generateVariety } from "./gen-variety.js";
import { runTelemetryCli } from "./run-telemetry.js";
import { gauntletDeps } from "./telemetry-deps.js";
import {
  BENCHMARK_VERSION,
  SEEDS,
  GAUNTLET_NAMES,
} from "../engine/benchmark-config.js";

// The committed board is the deterministic output of generateVariety(): a thin
// scaffold wrapping the EXACT `npm run telemetry` report, pinned by the drift test.
const varietyPath = fileURLToPath(
  new URL("../../docs/variety.md", import.meta.url),
);

describe("generateVariety — the committed variety board", () => {
  it("is pure: byte-stable across calls (no wall-clock)", () => {
    expect(generateVariety()).toBe(generateVariety());
  });

  it("opens with an H1 carrying the benchmark version", () => {
    expect(generateVariety()).toContain(
      `# Variety board — ${BENCHMARK_VERSION}`,
    );
  });

  it("carries the exact static §P7 orientation note (pass/fail lives in the fenced ⚠ flags)", () => {
    expect(generateVariety()).toContain(
      "_§P7 soft targets: usage ≤ 35%, opener win ≤ 60%. Scan for ⚠ below._",
    );
  });

  it("embeds the exact `npm run telemetry` report verbatim inside a fenced block", () => {
    // Body fidelity: the board IS what the tool prints — reused, never a re-render.
    const printed = runTelemetryCli([], gauntletDeps()).stdout;
    expect(generateVariety()).toContain("```\n" + printed + "```\n");
  });

  it("composes scaffold + fenced report in the exact expected shape", () => {
    const printed = runTelemetryCli([], gauntletDeps()).stdout;

    const expected =
      `# Variety board — ${BENCHMARK_VERSION}\n\n` +
      `_Frozen ${GAUNTLET_NAMES.length}-bot gauntlet · ${SEEDS.length} seeds · ${BENCHMARK_VERSION}_\n\n` +
      "_§P7 soft targets: usage ≤ 35%, opener win ≤ 60%. Scan for ⚠ below._\n\n" +
      "```\n" +
      printed +
      "```\n";

    expect(generateVariety()).toBe(expected);
  });
});

describe("docs/variety.md is the committed, drift-free generator output", () => {
  it("byte-matches a fresh generateVariety()", () => {
    const committed = readFileSync(varietyPath, "utf8");
    expect(committed).toBe(generateVariety());
  });
});

describe("gauntletDeps — the frozen-gauntlet loader", () => {
  it("fails fast with a path-named error when a bot file cannot be read", () => {
    // The population loader must surface an unreadable file loudly (the CLI's
    // fail-fast path) — a silently-swallowed read would misreport over a shrunken roster.
    const missing = "no-such-bot-does-not-exist.json";

    expect(() => gauntletDeps().loadBot(missing)).toThrowError(
      `cannot read bot file: ${missing}`,
    );
  });
});
