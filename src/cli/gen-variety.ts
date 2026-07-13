// ============================================================================
// The committed variety board generator. `docs/variety.md` is the deterministic
// output of generateVariety(), pinned to it by the drift test in gen-variety.test.ts
// (mirroring the docs/spec.md trio: generateSpec/write-spec/the drift test).
//
// The board reuses the EXACT `npm run telemetry` report (all five readouts —
// usage / opener / degrade / occupancy / scoring) verbatim inside a fenced block,
// under a thin scaffold (an H1 with the version, a manifest-sourced provenance line,
// and a static §P7 orientation note). Reusing the CLI's own output means the board
// can never diverge from what the tool prints; the fenced ⚠ flags carry the §P7
// pass/fail, so the scaffold only orients the reader.
// ============================================================================
import { runTelemetryCli, type TelemetryDeps } from "./run-telemetry.js";
import { gauntletDeps } from "./telemetry-deps.js";
import {
  BENCHMARK_VERSION,
  SEEDS,
  GAUNTLET_NAMES,
} from "../engine/benchmark-config.js";

export const generateVariety = (
  deps: TelemetryDeps = gauntletDeps(),
): string => {
  const report = runTelemetryCli([], deps).stdout;

  return (
    `# Variety board — ${BENCHMARK_VERSION}\n\n` +
    `_Frozen ${GAUNTLET_NAMES.length}-bot gauntlet · ${SEEDS.length} seeds · ${BENCHMARK_VERSION}_\n\n` +
    "_§P7 soft targets: usage ≤ 35%, opener win ≤ 60%. Scan for ⚠ below._\n\n" +
    "```\n" +
    report +
    "```\n"
  );
};
