/// <reference types="node" />
// ============================================================================
// CLI telemetry runner — the thin imperative shell. Loads the frozen gauntlet
// through the validator gate, runs the both-sides round-robin, and prints the
// pooled move-usage histogram over the 13 techniques.
//
//   npm run telemetry
//
// All logic lives in run-telemetry.ts (testable); this file only wires the real
// filesystem + manifest and performs the stream writes / exit. The population load
// is DEFERRED into a thunk so an unreadable roster file surfaces as a clean
// non-zero exit (the CLI's fail-fast path), not an uncaught throw.
// ============================================================================
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadBotDoc } from "./load.js";
import { runTelemetryCli, type TelemetryDeps } from "./run-telemetry.js";
import { CANONICAL_RULES } from "../engine/rules.js";
import {
  BENCHMARK_VERSION,
  SEEDS,
  MAX_TICKS,
  MATCH,
  GAUNTLET_NAMES,
} from "../engine/benchmark-config.js";

const botPath = (name: string): string =>
  fileURLToPath(new URL(`../../bots/${name}.json`, import.meta.url));

const loadPopulation = () =>
  GAUNTLET_NAMES.map((name) => {
    let text: string;

    try {
      text = readFileSync(botPath(name), "utf8");
    } catch {
      throw new Error(`cannot read bot file: ${botPath(name)}`);
    }

    return loadBotDoc(text);
  });

const deps: TelemetryDeps = {
  loadPopulation,
  rules: CANONICAL_RULES,
  seeds: SEEDS,
  maxTicks: MAX_TICKS,
  match: MATCH,
  version: BENCHMARK_VERSION,
};

const out = runTelemetryCli(deps);
process.stdout.write(out.stdout);
if (out.stderr) process.stderr.write(out.stderr);
process.exit(out.code);
