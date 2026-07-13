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
  MIN_OPENER_SAMPLE,
  OPENER_FLAG_THRESHOLD,
  runVariety,
  USAGE_FLAG_THRESHOLD,
  type PooledReport,
  type VarietyConfig,
  type VarietyReport,
} from "../engine/telemetry.js";
import type { Rules } from "../engine/types.js";
import { ValidationError, type BotDoc } from "../engine/dsl.js";

export type TelemetryDeps = {
  loadBot: (path: string) => BotDoc; // path → validated bot; throws ValidationError (rejected) or Error (unreadable)
  loadGauntlet: () => BotDoc[]; // the frozen reference population — deferred so an unreadable roster fails cleanly, not at import
  rules: Rules;
  seeds: readonly number[];
  maxTicks: number;
  match?: VarietyConfig["match"]; // WKF match mode; absent ⇒ fights run to maxTicks
  version: string;
};

// A load/validate failure rendered for stderr: a rejected bot lists its structured issues
// (mirroring run-benchmark.ts's invalid-bot block), an unreadable one surfaces its message.
// Both name the offending path so the operator knows which supplied bot broke the run.
const formatLoadError = (path: string, e: unknown): string =>
  e instanceof ValidationError
    ? `invalid bot ${path}:\n` +
      e.issues.map((i) => `  ${i.path}: ${i.reason}`).join("\n") +
      "\n"
    : `${e instanceof Error ? e.message : String(e)}\n`;

type PopulationOutcome =
  | { ok: true; population: BotDoc[] }
  | { ok: false; stderr: string };

// The fold state while loading override paths: the bots gathered so far, plus the FIRST
// load failure once one occurs (null until then). Once latched, the failure is preserved
// and no further path is read.
type LoadAcc = {
  bots: BotDoc[];
  failure: { path: string; error: unknown } | null;
};

// Resolve the population to profile: no paths ⇒ the frozen gauntlet (the S1a default,
// byte-unchanged); otherwise every supplied path through the validator gate, left to right.
// The FIRST bad bot latches a failure and short-circuits the rest (fail fast) — a partial
// population would silently misreport, so it's never assembled, let alone scored. Pure: all
// I/O is delegated to the injected loaders.
const loadPopulation = (
  paths: readonly string[],
  deps: TelemetryDeps,
): PopulationOutcome => {
  if (paths.length === 0) {
    try {
      return { ok: true, population: deps.loadGauntlet() };
    } catch (e) {
      return {
        ok: false,
        stderr: `${e instanceof Error ? e.message : String(e)}\n`,
      };
    }
  }

  const acc = paths.reduce<LoadAcc>(
    (state, path) => {
      if (state.failure !== null) return state;

      try {
        return { bots: [...state.bots, deps.loadBot(path)], failure: null };
      } catch (error) {
        return { bots: state.bots, failure: { path, error } };
      }
    },
    { bots: [], failure: null },
  );

  return acc.failure !== null
    ? {
        ok: false,
        stderr: formatLoadError(acc.failure.path, acc.failure.error),
      }
    : { ok: true, population: acc.bots };
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

// Render the aligned `technique / count / share / adoption / mean` histogram table
// (dominant rows flagged `⚠`). `adoption` is k/N bots that honour the move ≥once (tempo-
// blind reach); `mean` is the mean per-bot share (`n/a` when no bot has a distribution).
// The legend + diversity summary render separately so they compose as their own lines below
// the table. Pure data → string — exact output is a stdout contract (cli-design).
export const renderReport = (report: VarietyReport): string =>
  render([
    ["technique", "count", "share", "adoption", "mean", ""],
    ...report.rows.map((r) => [
      r.technique,
      `${r.count}`,
      `${(r.share * 100).toFixed(1)}%`,
      `${r.adoptingBots}/${report.botCount}`,
      r.meanShare === null ? "n/a" : `${(r.meanShare * 100).toFixed(1)}%`,
      r.dominant ? "⚠" : "",
    ]),
  ]);

// The one-line footnote naming the `⚠` threshold — present only when some row is flagged
// (empty string otherwise, so the caller omits the line). Reads only pooled fields.
export const renderLegend = (report: PooledReport): string =>
  report.rows.some((r) => r.dominant)
    ? `⚠ = over ${(USAGE_FLAG_THRESHOLD * 100).toFixed(0)}% of all honoured commitments`
    : "";

// The diversity headline: the effective-move-count (`exp(Shannon)` — "N of 13 techniques
// effectively in rotation", `n/a` when nothing was committed) plus the live / dead split
// and, when any are dead, the dead-move list in canonical frame-table order. Pooled-only.
export const renderDiversity = (report: PooledReport): string => {
  const dead = report.rows.filter((r) => r.count === 0);
  const live = report.rows.length - dead.length;

  const emc =
    report.effectiveMoves === null ? "n/a" : report.effectiveMoves.toFixed(1);

  const deadList =
    dead.length === 0 ? "" : `: ${dead.map((r) => r.technique).join(", ")}`;

  return `effective moves ${emc} of ${report.rows.length}   ·   live ${live} / dead ${dead.length}${deadList}`;
};

// Render the opener win-rate table (the second DESIGN §P7 dial): per opener, the
// opens-count and its W / L / D split behind the win-rate. Rows arrive already sorted
// (win% desc → opens desc → canonical); a 0-open technique shows `—` (the ÷0 guard). The
// null-opener count — fighters that opened with no honoured commitment — is the trailing
// line. Pure data → string; the exact output is a stdout contract (cli-design).
export const renderOpeners = (report: VarietyReport): string => {
  const table = render([
    ["opener", "opens", "W", "L", "D", "win%", ""],
    ...report.openers.map((r) => [
      r.technique,
      `${r.opens}`,
      `${r.wins}`,
      `${r.losses}`,
      `${r.draws}`,
      r.winRate === null ? "—" : `${(r.winRate * 100).toFixed(1)}%`,
      r.dominant ? "⚠" : "",
    ]),
  ]);

  return `${table}\n\nnull openers (turtled): ${report.nullOpeners}`;
};

// The one-line footnote naming the opener `⚠` threshold + sample floor — present only when
// some opener is flagged (empty otherwise, so the caller omits the line). Reads openers only.
export const renderOpenerLegend = (report: VarietyReport): string =>
  report.openers.some((r) => r.dominant)
    ? `⚠ = opener win-rate over ${(OPENER_FLAG_THRESHOLD * 100).toFixed(0)}% (≥${MIN_OPENER_SAMPLE} opens)`
    : "";

export const runTelemetryCli = (
  argv: string[],
  deps: TelemetryDeps,
): CliOutput => {
  // Positional args (anything that isn't a `--flag`) are the population override paths;
  // none ⇒ the frozen gauntlet. Flags like `--json` are order-independent, so they're
  // filtered out here and read separately — `--json bots/a.json` and `bots/a.json --json`
  // behave identically (cli-design).
  const paths = argv.filter((arg) => !arg.startsWith("--"));

  const loaded = loadPopulation(paths, deps);

  if (!loaded.ok) return { stdout: "", stderr: loaded.stderr, code: 1 };

  const population = loaded.population;

  const report = runVariety({
    population,
    seeds: deps.seeds,
    maxTicks: deps.maxTicks,
    rules: deps.rules,
    match: deps.match,
  });

  // `--json`: the report AS DATA — a versioned envelope (`{version, population, report}`)
  // carrying the provenance the human header would, so a machine consumer / run-to-run diff
  // knows which engine version + roster produced the numbers. stdout is pure JSON, nothing else.
  if (argv.includes("--json")) {
    const envelope = {
      version: deps.version,
      population: population.map((bot) => bot.name),
      report,
    };

    return { stdout: `${JSON.stringify(envelope)}\n`, stderr: "", code: 0 };
  }

  const header = renderHeader({
    version: deps.version,
    population: population.map((bot) => bot.name),
    seedCount: deps.seeds.length,
    totalFights: report.totalFights,
    totalCommitments: report.totalCommitments,
  });

  const legend = renderLegend(report);
  const openerLegend = renderOpenerLegend(report);

  const body =
    `${renderReport(report)}\n\n${renderDiversity(report)}` +
    (legend ? `\n\n${legend}` : "") +
    `\n\n${renderOpeners(report)}` +
    (openerLegend ? `\n\n${openerLegend}` : "");

  return {
    stdout: `${header}\n\n${body}\n`,
    stderr: "",
    code: 0,
  };
};
