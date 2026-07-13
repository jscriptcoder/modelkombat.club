import { describe, it, expect } from "vitest";
import {
  renderDiversity,
  renderHeader,
  renderLegend,
  renderReport,
  runTelemetryCli,
  type HeaderInfo,
  type TelemetryDeps,
} from "./run-telemetry.js";
import type { Rules } from "../engine/types.js";
import { ValidationError, type BotDoc } from "../engine/dsl.js";
import {
  runVariety,
  type PooledReport,
  type Technique,
  type VarietyReport,
} from "../engine/telemetry.js";

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

// The gauntlet (no-args default) is injected as `loadGauntlet`; `loadBot` (path → BotDoc)
// serves the population-override path and defaults to a stub that throws if ever reached,
// so a test that supplies no paths proves the override branch is untouched.
const deps = (
  gauntlet: BotDoc[],
  loadBot: (path: string) => BotDoc = () => {
    throw new Error("loadBot stub: no bot path expected in this test");
  },
): TelemetryDeps => ({
  loadGauntlet: () => gauntlet,
  loadBot,
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
    const out = runTelemetryCli([], deps(BALANCED));

    expect(out.code).toBe(0);
    expect(out.stderr).toBe("");
    expect(out.stdout.endsWith("\n")).toBe(true); // trailing newline (POSIX text)
    for (const technique of ALL_TECHNIQUES)
      expect(out.stdout).toContain(technique);
    expect(out.stdout).toMatch(/\d\.\d%/); // shares shown to one decimal place
    expect(out.stdout).toContain("0.0%"); // an unfired technique still prints 0.0%
  });

  it("opens with the provenance header (version / population / counts) above the histogram", () => {
    const out = runTelemetryCli([], deps(BALANCED)); // version "test", 3 bots, 2 seeds

    expect(out.stdout.startsWith("ModelKombat variety telemetry test\n")).toBe(
      true,
    );
    expect(out.stdout).toContain("population: g, m, w");
    expect(out.stdout).toMatch(
      /3 bots · 2 seeds · round-robin = \d+ fights · \d+ honoured commitments/,
    );
    // caveat (3 < SMALL_POPULATION), a blank line, THEN the table.
    expect(out.stdout).toContain("not discovered LLM behavior.\n\ntechnique");
  });

  it("shows the per-bot adoption (k/N) and mean columns, one adopter per one-move bot", () => {
    const out = runTelemetryCli([], deps(BALANCED)); // 3 bots, each a distinct single move

    expect(out.stdout).toMatch(/adoption\s+mean/); // both new columns, in order, in the header
    expect(out.stdout).toContain("1/3"); // each live move is adopted by one of the 3 bots
    expect(out.stdout).toContain("0/3"); // an unused technique is adopted by none
  });

  it("flags a dominant technique with ⚠ and prints a legend naming the 35% threshold", () => {
    // both bots commit only gyaku-zuki ⇒ gyaku is 100% of commitments ⇒ dominant.
    const out = runTelemetryCli(
      [],
      deps([bot("g1", "gyaku-zuki"), bot("g2", "gyaku-zuki")]),
    );

    expect(out.code).toBe(0);
    expect(out.stdout).toContain("⚠");
    expect(out.stdout).toContain("35%"); // the legend references the flag threshold
  });

  it("prints no ⚠ (and no legend) when no technique crosses the threshold", () => {
    // three moves at ~33.3% each — all below 35%.
    const out = runTelemetryCli([], deps(BALANCED));

    expect(out.stdout).not.toContain("⚠");
    expect(out.stdout).not.toContain("35%");
  });

  it("is deterministic — two runs produce byte-identical stdout", () => {
    const first = runTelemetryCli(
      [],
      deps([bot("g", "gyaku-zuki"), bot("m", "mae-geri")]),
    );

    const second = runTelemetryCli(
      [],
      deps([bot("g", "gyaku-zuki"), bot("m", "mae-geri")]),
    );

    expect(first.stdout).toBe(second.stdout);
  });

  it("fails fast — non-zero exit, empty stdout, and a stderr message — when the population can't load", () => {
    const out = runTelemetryCli([], {
      ...deps([]),
      loadGauntlet: () => {
        throw new Error("cannot read bot file: bots/jabber.json");
      },
    });

    expect(out.code).not.toBe(0);
    expect(out.stdout).toBe("");
    expect(out.stderr).toContain("cannot read bot file");
  });

  it("prints the diversity headline below the histogram, after a blank line", () => {
    const out = runTelemetryCli([], deps(BALANCED)); // 3 techniques used ⇒ effective ≈ 3.0

    expect(out.stdout).toMatch(/\n\neffective moves \d\.\d of 13 {3}·/);
    expect(out.stdout.indexOf("effective moves")).toBeGreaterThan(
      out.stdout.indexOf("technique"), // below the table, not up in the header
    );
  });

  it("ends with the diversity line — no legend appended — when nothing is dominant", () => {
    const population = BALANCED; // three ~even moves ⇒ none dominant ⇒ no legend
    const out = runTelemetryCli([], deps(population));

    const rep = runVariety({
      population,
      seeds: [1, 2],
      maxTicks: 30,
      rules: MOCK_RULES,
    });

    expect(out.stdout.endsWith(`${renderDiversity(rep)}\n`)).toBe(true);
  });
});

describe("runTelemetryCli --json", () => {
  it("emits the enriched report as a versioned JSON envelope, not the human table", () => {
    const population = BALANCED; // version "test", 3 bots
    const out = runTelemetryCli(["--json"], deps(population));

    expect(out.code).toBe(0);
    expect(out.stderr).toBe("");
    expect(out.stdout.startsWith("{")).toBe(true); // a JSON object, not the "ModelKombat" header
    expect(out.stdout).not.toContain("ModelKombat variety telemetry"); // no human header
    expect(out.stdout.endsWith("\n")).toBe(true); // trailing newline (POSIX text)

    const parsed = JSON.parse(out.stdout) as {
      version: string;
      population: string[];
      report: VarietyReport;
    };

    expect(parsed.version).toBe("test");
    expect(parsed.population).toEqual(["g", "m", "w"]);
    // the full enriched report (rows + adoption + mean + EMC + botCount) round-trips.
    expect(parsed.report).toEqual(
      runVariety({
        population,
        seeds: [1, 2],
        maxTicks: 30,
        rules: MOCK_RULES,
      }),
    );
  });

  it("never leaks the ⚠ flag or the table into --json stdout", () => {
    // both bots commit only gyaku ⇒ the HUMAN table would flag ⚠; --json must not.
    const out = runTelemetryCli(
      ["--json"],
      deps([bot("g1", "gyaku-zuki"), bot("g2", "gyaku-zuki")]),
    );

    expect(out.stdout).not.toContain("⚠");
    expect(() => JSON.parse(out.stdout)).not.toThrow();
  });

  it("renders the human table (not JSON) when --json is absent", () => {
    const out = runTelemetryCli([], deps(BALANCED));

    expect(out.stdout.startsWith("ModelKombat variety telemetry")).toBe(true);
    expect(out.stdout.startsWith("{")).toBe(false);
  });

  it("is deterministic — two --json runs are byte-identical", () => {
    const first = runTelemetryCli(["--json"], deps(BALANCED));
    const second = runTelemetryCli(["--json"], deps(BALANCED));

    expect(first.stdout).toBe(second.stdout);
  });
});

// ─── population override: positional paths after `--` profile a SUPPLIED bot set through
// the validator gate (no paths ⇒ the frozen gauntlet, unchanged); a bad bot fails loudly
// rather than silently shrinking the population. `loadBot` maps a path to a bot or throws. ──
const loadFrom =
  (map: Record<string, BotDoc>) =>
  (path: string): BotDoc => {
    const found = map[path];

    if (found === undefined) throw new Error(`cannot read bot file: ${path}`);

    return found;
  };

describe("runTelemetryCli — population override", () => {
  const SUPPLIED: Record<string, BotDoc> = {
    "a.json": bot("a", "gyaku-zuki"),
    "b.json": bot("b", "mae-geri"),
    "c.json": bot("c", "mawashi-geri"),
  };

  it("profiles the SUPPLIED bots (names + fight count), not the frozen gauntlet", () => {
    // gauntlet BALANCED (g, m, w) is present but must be ignored in favour of the paths.
    const out = runTelemetryCli(
      ["a.json", "b.json", "c.json"],
      deps(BALANCED, loadFrom(SUPPLIED)),
    );

    expect(out.code).toBe(0);
    expect(out.stdout).toContain("population: a, b, c");
    expect(out.stdout).not.toContain("population: g, m, w");
    // 3 supplied bots ⇒ 3·2 ordered pairs × 2 seeds = 12 fights (pins the arg slice).
    expect(out.stdout).toMatch(/3 bots · 2 seeds · round-robin = 12 fights/);
  });

  it("falls back to the frozen gauntlet when no paths are supplied (loadBot untouched)", () => {
    const out = runTelemetryCli([], {
      ...deps(BALANCED),
      loadBot: () => {
        throw new Error("loadBot must not be called for the gauntlet default");
      },
    });

    expect(out.code).toBe(0);
    expect(out.stdout).toContain("population: g, m, w");
  });

  it("honours --json alongside positional paths — the flag is not treated as a bot path", () => {
    const out = runTelemetryCli(
      ["--json", "a.json", "b.json"],
      deps(BALANCED, loadFrom(SUPPLIED)),
    );

    const parsed = JSON.parse(out.stdout) as { population: string[] };

    expect(parsed.population).toEqual(["a", "b"]);
  });

  it("fails fast with a structured multi-issue stderr + non-zero exit when a supplied bot is invalid", () => {
    const out = runTelemetryCli(["bad.json"], {
      ...deps(BALANCED),
      loadBot: () => {
        throw new ValidationError([
          { path: "$.default", reason: "unknown move" },
          { path: "$.rules[0]", reason: "unknown field" },
        ]);
      },
    });

    expect(out.code).toBe(1);
    expect(out.stdout).toBe("");
    // both issues, one per line — the `\n` join between them is part of the stderr contract.
    expect(out.stderr).toBe(
      "invalid bot bad.json:\n" +
        "  $.default: unknown move\n" +
        "  $.rules[0]: unknown field\n",
    );
  });

  it("latches the first failure — a good path after a bad one cannot rescue the run", () => {
    // bad.json is FIRST; without the fail-fast latch, loading good.json next would clear the
    // error and mis-report success. Order matters — the bad bot precedes the good one.
    const out = runTelemetryCli(["bad.json", "good.json"], {
      ...deps(BALANCED),
      loadBot: (path) => {
        if (path === "bad.json")
          throw new ValidationError([{ path: "$", reason: "nope" }]);

        return bot("good", "gyaku-zuki");
      },
    });

    expect(out.code).toBe(1);
    expect(out.stdout).toBe("");
    expect(out.stderr).toContain("invalid bot bad.json");
  });

  it("reports a read failure as its message (non-zero exit, empty stdout)", () => {
    const out = runTelemetryCli(["missing.json"], deps(BALANCED, loadFrom({})));

    expect(out.code).toBe(1);
    expect(out.stdout).toBe("");
    expect(out.stderr).toBe("cannot read bot file: missing.json\n");
  });

  it("never scores a partial population — one bad bot among good ones aborts the whole run", () => {
    const out = runTelemetryCli(["good.json", "bad.json"], {
      ...deps(BALANCED),
      loadBot: (path) => {
        if (path === "bad.json")
          throw new ValidationError([{ path: "$", reason: "nope" }]);

        return bot("good", "gyaku-zuki");
      },
    });

    expect(out.code).toBe(1);
    expect(out.stdout).toBe("");
    expect(out.stderr).toContain("invalid bot bad.json");
  });
});

// Exact-output tests over synthetic reports — stdout is a contract, so the aligned
// columns, the ⚠ flag, and the legend are pinned byte-for-byte (space runs are
// spelled out with `" ".repeat(n)` so the alignment is reviewable). Presentation
// logic is not reached by the node-only mutation runner via containment alone.
const report = (rows: PooledReport["rows"]): PooledReport => ({
  rows,
  totalCommitments: rows.reduce((sum, r) => sum + r.count, 0),
  totalFights: 0, // inert to renderLegend / renderDiversity; pinned for a valid report
  effectiveMoves: null, // inert to renderLegend; renderDiversity has its own factory
});

// A full (enriched) report for the renderReport table, which now shows the adoption (k/N)
// and mean per-bot share columns — so its rows carry adoptingBots + meanShare and the
// report carries botCount (the N in k/N).
const usageReport = (
  rows: VarietyReport["rows"],
  botCount: number,
): VarietyReport => ({
  rows,
  totalCommitments: rows.reduce((sum, r) => sum + r.count, 0),
  totalFights: 0,
  effectiveMoves: null,
  botCount,
});

describe("renderReport — exact histogram layout (table only)", () => {
  it("aligns technique / count / share / adoption / mean and flags a dominant row with ⚠", () => {
    const out = renderReport(
      usageReport(
        [
          {
            technique: "gyaku-zuki",
            count: 3,
            share: 0.6,
            dominant: true,
            adoptingBots: 2,
            meanShare: 0.55,
          },
          {
            technique: "sweep",
            count: 2,
            share: 0.4,
            dominant: false,
            adoptingBots: 1,
            meanShare: 0.2,
          },
        ],
        2,
      ),
    );

    expect(out).toBe(
      "technique" +
        " ".repeat(3) +
        "count" +
        " ".repeat(2) +
        "share" +
        " ".repeat(2) +
        "adoption" +
        " ".repeat(3) +
        "mean" +
        "\n" +
        "gyaku-zuki" +
        " ".repeat(6) +
        "3" +
        " ".repeat(2) +
        "60.0%" +
        " ".repeat(7) +
        "2/2" +
        " ".repeat(2) +
        "55.0%" +
        " ".repeat(2) +
        "⚠" +
        "\n" +
        "sweep" +
        " ".repeat(11) +
        "2" +
        " ".repeat(2) +
        "40.0%" +
        " ".repeat(7) +
        "1/2" +
        " ".repeat(2) +
        "20.0%",
    );
  });

  it("renders n/a in the mean column when a technique has no per-bot distribution", () => {
    const out = renderReport(
      usageReport(
        [
          {
            technique: "gyaku-zuki",
            count: 0,
            share: 0,
            dominant: false,
            adoptingBots: 0,
            meanShare: null,
          },
        ],
        3,
      ),
    );

    expect(out).toBe(
      "technique" +
        " ".repeat(3) +
        "count" +
        " ".repeat(2) +
        "share" +
        " ".repeat(2) +
        "adoption" +
        " ".repeat(2) +
        "mean" +
        "\n" +
        "gyaku-zuki" +
        " ".repeat(6) +
        "0" +
        " ".repeat(3) +
        "0.0%" +
        " ".repeat(7) +
        "0/3" +
        " ".repeat(3) +
        "n/a",
    );
  });
});

describe("renderLegend — the ⚠ threshold footnote", () => {
  it("names the threshold when a technique is dominant", () => {
    expect(
      renderLegend(
        report([
          { technique: "gyaku-zuki", count: 5, share: 0.6, dominant: true },
        ]),
      ),
    ).toBe("⚠ = over 35% of all honoured commitments");
  });

  it("is empty when nothing is dominant", () => {
    expect(
      renderLegend(
        report([
          { technique: "gyaku-zuki", count: 1, share: 0.2, dominant: false },
        ]),
      ),
    ).toBe("");
  });
});

// renderDiversity is a separate concern (a summary metric line, not the table), so it gets
// its own full-13-technique reports. The dead list must read in canonical frame-table order;
// effectiveMoves is computed by reduceUsage (tested there) and injected here.
const CANON: readonly Technique[] = [
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

const SEP = "   ·   "; // 3 spaces · 3 spaces — the diversity-line separator

const diversityReport = (
  dead: readonly Technique[],
  effectiveMoves: number | null,
): PooledReport => {
  const rows = CANON.map((technique) => ({
    technique,
    count: dead.includes(technique) ? 0 : 1,
    share: 0,
    dominant: false,
  }));

  return {
    rows,
    totalCommitments: rows.filter((r) => r.count > 0).length,
    totalFights: 0,
    effectiveMoves,
  };
};

describe("renderDiversity — effective-move-count + live/dead headline", () => {
  it("shows the effective-move-count and a live/dead split with no list when all live", () => {
    expect(renderDiversity(diversityReport([], 5.8))).toBe(
      "effective moves 5.8 of 13" + SEP + "live 13 / dead 0",
    );
  });

  it("lists the dead techniques in canonical frame-table order", () => {
    expect(
      renderDiversity(
        diversityReport(["shuto", "yoko-geri", "ushiro-geri", "empi"], 3.2),
      ),
    ).toBe(
      "effective moves 3.2 of 13" +
        SEP +
        "live 9 / dead 4: shuto, yoko-geri, ushiro-geri, empi",
    );
  });

  it("shows n/a (never NaN) with every technique dead when there are no commitments", () => {
    expect(renderDiversity(diversityReport(CANON, null))).toBe(
      "effective moves n/a of 13" +
        SEP +
        "live 0 / dead 13: sweep, kizami-zuki, gyaku-zuki, mae-geri, mawashi-geri, uraken, shuto, yoko-geri, ushiro-geri, empi, hiza-geri, tobi-geri, throw",
    );
  });
});

// The provenance header is a stdout contract too — every field (version, population
// names, count, seeds, fights, honoured commitments) is pinned byte-for-byte, and the
// small-sample caveat is gated on the population size threshold.
const headerInfo = (o: Partial<HeaderInfo> = {}): HeaderInfo => ({
  version: "v19",
  population: ["jabber", "rekka", "zoner"],
  seedCount: 10,
  totalFights: 300,
  totalCommitments: 4210,
  ...o,
});

const names = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => `bot${i}`);

describe("renderHeader — provenance header + small-sample caveat", () => {
  it("renders every provenance field and the small-sample caveat for a small population", () => {
    const out = renderHeader(headerInfo());

    expect(out).toBe(
      "ModelKombat variety telemetry v19\n" +
        "population: jabber, rekka, zoner\n" +
        "3 bots · 10 seeds · round-robin = 300 fights · 4210 honoured commitments\n" +
        "note: small hand-authored reference population — shares reflect authored style, not discovered LLM behavior.",
    );
  });

  it("omits the caveat once the population reaches the SMALL_POPULATION threshold", () => {
    const out = renderHeader(headerInfo({ population: names(30) }));

    expect(out).toBe(
      "ModelKombat variety telemetry v19\n" +
        `population: ${names(30).join(", ")}\n` +
        "30 bots · 10 seeds · round-robin = 300 fights · 4210 honoured commitments",
    );
    expect(out).not.toContain("note:");
  });

  it("prints the caveat just below the threshold and omits it exactly at it", () => {
    const below = renderHeader(headerInfo({ population: names(29) }));
    const at = renderHeader(headerInfo({ population: names(30) }));

    expect(below).toContain("note: small hand-authored reference population");
    expect(at).not.toContain("note:");
  });
});
