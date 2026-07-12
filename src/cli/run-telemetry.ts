// ============================================================================
// Telemetry CLI logic — the testable core of `npm run telemetry`. Pure: it takes
// injected deps (a population loader + run parameters) and returns
// { stdout, stderr, code } rather than touching the process. The thin entry script
// (telemetry.ts) wires the real filesystem + manifest and performs the stream
// writes / exit.
//
// Stream/exit discipline (cli-design): the usage histogram is DATA → stdout; a
// load failure's message → stderr. Exit 0 = report produced, 1 = the reference
// population could not be loaded (fail fast — a partial roster would misreport).
// ============================================================================
import {
  runVariety,
  USAGE_FLAG_THRESHOLD,
  type VarietyConfig,
  type VarietyReport,
} from "../engine/telemetry.js";
import type { Rules } from "../engine/types.js";
import type { BotDoc } from "../engine/dsl.js";

export type TelemetryDeps = {
  loadPopulation: () => BotDoc[]; // throws Error if a population file is unreadable / invalid
  rules: Rules;
  seeds: readonly number[];
  maxTicks: number;
  match?: VarietyConfig["match"]; // WKF match mode; absent ⇒ fights run to maxTicks
  version: string;
};

export type CliOutput = { stdout: string; stderr: string; code: number };

// A population at or above this size is treated as large enough that its figures
// reflect discovered behavior; below it, the header carries a caveat that the numbers
// describe a small hand-authored REFERENCE roster (the 6-bot gauntlet, the 15 example
// bots) rather than real LLM submissions. A single retunable named constant — raise it
// as the post-launch submission corpus grows.
const SMALL_POPULATION = 30;

// The provenance a report header carries: which version / population / seed-set / fight
// count / commitment total the numbers below describe. Rendered from the CLI's own run
// parameters + the produced report — so a reader never misreads whose meta this is.
export type HeaderInfo = {
  version: string;
  population: readonly string[]; // the population's bot names, in load order
  seedCount: number;
  totalFights: number;
  totalCommitments: number;
};

// Render the provenance header: the tool/version line, the population roster, and a
// counts line (population size · seeds · round-robin fights · honoured commitments),
// mirroring `run-benchmark.ts`'s header block. A small population appends a caveat line
// so low-N reference-roster figures are never mistaken for discovered LLM behavior.
export const renderHeader = (info: HeaderInfo): string => {
  const lines = [
    `ModelKombat variety telemetry ${info.version}`,
    `population: ${info.population.join(", ")}`,
    `${info.population.length} bots · ${info.seedCount} seeds · round-robin = ${info.totalFights} fights · ${info.totalCommitments} honoured commitments`,
  ];

  const caveat =
    info.population.length < SMALL_POPULATION
      ? "\nnote: small hand-authored reference population — shares reflect authored style, not discovered LLM behavior."
      : "";

  return lines.join("\n") + caveat;
};

// A table whose first column (technique) is left-aligned and the rest right-aligned,
// each column padded to its widest cell (the run-benchmark.ts column helper). The
// flag column can be empty, so each row is right-trimmed — no trailing whitespace.
const render = (rows: string[][]): string => {
  const widths = rows[0].map((_, col) =>
    Math.max(...rows.map((r) => r[col].length)),
  );

  return rows
    .map((r) =>
      r
        .map((cell, col) =>
          col === 0 ? cell.padEnd(widths[col]) : cell.padStart(widths[col]),
        )
        .join("  ")
        .trimEnd(),
    )
    .join("\n");
};

// Render a variety report to the human histogram: an aligned `technique / count /
// share` table (dominant rows flagged `⚠`), plus a threshold legend when any row is
// flagged. Pure data → string — exact output is a stdout contract (cli-design).
export const renderReport = (report: VarietyReport): string => {
  const table = render([
    ["technique", "count", "share", ""],
    ...report.rows.map((r) => [
      r.technique,
      `${r.count}`,
      `${(r.share * 100).toFixed(1)}%`,
      r.dominant ? "⚠" : "",
    ]),
  ]);

  const legend = report.rows.some((r) => r.dominant)
    ? `\n\n⚠ = over ${(USAGE_FLAG_THRESHOLD * 100).toFixed(0)}% of all honoured commitments`
    : "";

  return `${table}${legend}`;
};

export const runTelemetryCli = (deps: TelemetryDeps): CliOutput => {
  let population: BotDoc[];

  try {
    population = deps.loadPopulation();
  } catch (e) {
    return {
      stdout: "",
      stderr: `${e instanceof Error ? e.message : String(e)}\n`,
      code: 1,
    };
  }

  const report = runVariety({
    population,
    seeds: deps.seeds,
    maxTicks: deps.maxTicks,
    rules: deps.rules,
    match: deps.match,
  });

  const header = renderHeader({
    version: deps.version,
    population: population.map((bot) => bot.name),
    seedCount: deps.seeds.length,
    totalFights: report.totalFights,
    totalCommitments: report.totalCommitments,
  });

  return {
    stdout: `${header}\n\n${renderReport(report)}\n`,
    stderr: "",
    code: 0,
  };
};
