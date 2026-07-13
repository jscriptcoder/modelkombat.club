/// <reference types="node" />
// ============================================================================
// CLI telemetry runner — the thin imperative shell. Loads the frozen gauntlet
// through the validator gate, runs the both-sides round-robin, and prints the
// pooled move-usage histogram over the 13 techniques.
//
//   npm run telemetry                       # histogram over the frozen gauntlet
//   npm run telemetry -- bots/a.json b.json  # over a supplied population (shell-expanded)
//   npm run telemetry -- --json              # the raw report as a versioned JSON envelope
//
// All logic lives in run-telemetry.ts (testable); this file only wires the real
// filesystem + manifest and performs the stream writes / exit. The gauntlet load
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

// A supplied bot path (population override) → validated BotDoc: unreadable ⇒ a clean Error
// naming the path, invalid ⇒ the gate's ValidationError. Mirrors run-benchmark.ts's loadBot.
const loadBot = (path: string) => {
  let text: string;

  try {
    text = readFileSync(path, "utf8");
  } catch {
    throw new Error(`cannot read bot file: ${path}`);
  }

  return loadBotDoc(text);
};

// The frozen 6-bot gauntlet — the default population when no override paths are given.
// Each name resolves to its bundled file and loads through the same gate as an override.
const loadGauntlet = () => GAUNTLET_NAMES.map((name) => loadBot(botPath(name)));

const deps: TelemetryDeps = {
  loadBot,
  loadGauntlet,
  rules: CANONICAL_RULES,
  seeds: SEEDS,
  maxTicks: MAX_TICKS,
  match: MATCH,
  version: BENCHMARK_VERSION,
};

const out = runTelemetryCli(process.argv.slice(2), deps);
process.stdout.write(out.stdout);
if (out.stderr) process.stderr.write(out.stderr);
process.exit(out.code);
