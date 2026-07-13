/// <reference types="node" />
// ============================================================================
// Shared frozen-gauntlet deps builder for the telemetry CLIs. Loads the 6-bot
// gauntlet through the validator gate (a deferred thunk, so an unreadable roster
// fails cleanly rather than at import) and wires the manifest into TelemetryDeps.
// Used by BOTH the `telemetry` runner (telemetry.ts) and the `gen:variety` board
// generator (gen-variety.ts), so the frozen-population wiring lives in one place.
// ============================================================================
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { loadBotDoc } from "./load.js";
import { type TelemetryDeps } from "./run-telemetry.js";
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

// A supplied bot path (population override) → validated BotDoc: unreadable ⇒ a clean
// Error naming the path, invalid ⇒ the gate's ValidationError. Mirrors run-benchmark's loadBot.
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

// The frozen-gauntlet deps: the reference population + the versioned run parameters.
export const gauntletDeps = (): TelemetryDeps => ({
  loadBot,
  loadGauntlet,
  rules: CANONICAL_RULES,
  seeds: SEEDS,
  maxTicks: MAX_TICKS,
  match: MATCH,
  version: BENCHMARK_VERSION,
});
