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
import { runTelemetryCli } from "./run-telemetry.js";
import { gauntletDeps } from "./telemetry-deps.js";

const out = runTelemetryCli(process.argv.slice(2), gauntletDeps());
process.stdout.write(out.stdout);
if (out.stderr) process.stderr.write(out.stderr);
process.exit(out.code);
