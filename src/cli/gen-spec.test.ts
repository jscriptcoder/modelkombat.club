import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { generateSpec } from "./gen-spec.js";
import {
  ACTION_TYPES,
  ALLOWED_FIELDS,
  ALLOWED_RULES,
  BANDS,
  BOOL_OPS,
  LIMITS,
  MOVES,
  NUM_OPS,
  validate,
} from "../engine/dsl.js";
import { CANONICAL_RULES } from "../engine/rules.js";
import type { Rules } from "../engine/types.js";
import {
  BENCHMARK_VERSION,
  GAUNTLET_NAMES,
  INPUT_HASH,
  MATCH,
  MAX_TICKS,
  SEEDS,
} from "../engine/benchmark-config.js";

// Inline-code span: the spec renders every allowlist member as markdown `code`,
// so a short token (a band `mid`, a bool op `or`/`and`/`not`) is asserted against
// its code-spanned form, not bare prose where it would trivially match. The
// backtick fence also makes `gyaku-zuki` distinct from `moves.gyaku-zuki.reach`.
const code = (s: string): string => "`" + s + "`";

// The line where the code-spanned `token` co-occurs with `value`. Order-
// independent (a token may be code-spanned in several sections — the allowlist
// AND the frame table — so we want the one line that PAIRS it with its value,
// killing value-swap mutants a bare `toContain` would miss).
const pairingLine = (
  spec: string,
  token: string,
  value: number,
): string | undefined =>
  spec
    .split("\n")
    .find((l) => l.includes(code(token)) && l.includes(String(value)));

// The body of a `## heading` section, exclusive of the heading and the next
// `## ` heading — so an assertion targets ONE section's prose (a value cited in
// the primer is not confused with the same value in the frame table).
const sectionOf = (spec: string, heading: string): string => {
  const lines = spec.split("\n");
  const start = lines.indexOf(heading);
  if (start < 0) return "";

  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l.startsWith("## "));

  return (end < 0 ? rest : rest.slice(0, end)).join("\n");
};

describe("generateSpec — the factual machine-truth spec", () => {
  it("is pure: byte-stable across calls (no wall-clock)", () => {
    expect(generateSpec()).toBe(generateSpec());
  });

  describe("header", () => {
    it("carries the benchmark version and input hash from the manifest", () => {
      const spec = generateSpec();
      expect(spec).toContain(BENCHMARK_VERSION);
      expect(spec).toContain(INPUT_HASH);
    });
  });

  describe("no gauntlet framing — pure King-of-the-Hill (D16)", () => {
    it("never mentions a gauntlet, a clearance gate, or a title shot in the prose", () => {
      // Post-KotH the author fights the sitting champions directly; the six-bot
      // clearance gate is gone, so none of its vocabulary may survive in the spec's
      // author-facing prose. (The embedded example-bot documents legitimately carry a
      // `"model": "gauntlet"` provenance string — fixture content, not framing — so
      // fenced code blocks are stripped before the check.)
      const prose = generateSpec()
        .replace(/```[\s\S]*?```/g, "")
        .toLowerCase();

      expect(prose).not.toContain("gauntlet");
      expect(prose).not.toContain("title shot");
      expect(prose).not.toContain("clear all");
    });
  });

  describe("game overview (the version-neutral 'what this game is' intro)", () => {
    const HEADING = "## What ModelKombat is";

    // The section prose is hard-wrapped; collapse whitespace so a multi-word
    // domain phrase matches regardless of where the line break falls.
    const flat = (s: string): string => s.replace(/\s+/g, " ");

    it("is its own section, placed after the title but before the DSL mechanics", () => {
      const spec = generateSpec();
      expect(sectionOf(spec, HEADING)).not.toBe("");
      // it follows the top-level title...
      expect(spec.indexOf("# ModelKombat — Bot authoring spec")).toBeLessThan(
        spec.indexOf(HEADING),
      );
      // ...and precedes the grammar/limits mechanics, so a cold model learns the
      // domain before the DSL
      expect(spec.indexOf(HEADING)).toBeLessThan(spec.indexOf("## Limits"));
      expect(spec.indexOf(HEADING)).toBeLessThan(
        spec.indexOf("## Expressions"),
      );
    });

    it("teaches only the authoring-relevant domain — LLM-authored data-not-code karate fought in a KotH arena", () => {
      const overview = flat(sectionOf(generateSpec(), HEADING));
      expect(overview).toContain("LLM"); // fighters authored by LLMs
      expect(overview).toContain("data, not code"); // the security framing
      expect(overview).toContain("WKF karate match"); // the genre + points scoring
      expect(overview.toLowerCase()).toContain("arena"); // fought in the KotH arena...
      expect(overview.toLowerCase()).toContain("champions"); // ...against the sitting champions
      expect(overview).toContain("no feedback loop"); // the one-shot authoring constraint
      // the gauntlet-clearance framing is gone (D16) — no gate in the intro
      expect(overview.toLowerCase()).not.toContain("gauntlet");
    });

    it("is version-neutral — a BENCHMARK_VERSION / INPUT_HASH bump never touches this prose", () => {
      const overview = sectionOf(generateSpec(), HEADING);
      expect(overview).not.toContain(BENCHMARK_VERSION);
      expect(overview).not.toContain(INPUT_HASH);
    });
  });

  describe("document shape", () => {
    const HEADING = "## Document shape";

    it("presents model as authoring provenance — the model and its effort — not as optional", () => {
      const shape = sectionOf(generateSpec(), HEADING);
      // both `name` and the provenance `model` appear...
      expect(shape).toContain('"name"');
      expect(shape).toContain('"model"');

      const modelLine = shape.split("\n").find((l) => l.includes('"model"'));

      // ...and `model` is framed as expected provenance — the authoring model plus its
      // reasoning effort — no longer flagged "optional" (authors should record what built
      // the bot, even though the validator still tolerates its absence).
      expect(modelLine).not.toContain("optional");
      expect(modelLine?.toLowerCase()).toContain("effort");
    });

    it("marks the fighter name as distinct from the author handle", () => {
      const shape = sectionOf(generateSpec(), HEADING);
      const nameLine = shape.split("\n").find((l) => l.includes('"name"'));

      // The fighter's name is not the submitter's handle — the handle travels in the
      // X-Author-Handle header — so an author must not fold their handle into the name.
      expect(nameLine?.toLowerCase()).toContain("handle");
    });

    it("column-aligns the trailing comments on the document fields", () => {
      const shape = sectionOf(generateSpec(), HEADING);

      // Every indented field line that carries a trailing `//` comment (name, model,
      // memory, rules, default) — but not the full-line `//` comments in the Rule block.
      const commentCols = shape
        .split("\n")
        .filter((l) => /^ {2}"/.test(l) && l.includes("//"))
        .map((l) => l.indexOf("//"));

      // They all open at the same column, so the block reads as a clean aligned table.
      expect(commentCols.length).toBeGreaterThan(1);
      expect(new Set(commentCols).size).toBe(1);
    });
  });

  describe("LIMITS", () => {
    it("renders every limit paired with its value on one line", () => {
      const spec = generateSpec();

      for (const [k, v] of Object.entries(LIMITS)) {
        expect(pairingLine(spec, k, v), `LIMITS.${k} = ${v}`).toBeDefined();
      }
    });
  });

  describe("grammar allowlists (sourced from dsl.ts)", () => {
    it("lists every numeric op as inline code", () => {
      const spec = generateSpec();
      for (const op of NUM_OPS) expect(spec).toContain(code(op));
    });

    it("lists every boolean op as inline code", () => {
      const spec = generateSpec();
      for (const op of BOOL_OPS) expect(spec).toContain(code(op));
    });

    it("lists every action type as inline code", () => {
      const spec = generateSpec();
      for (const t of ACTION_TYPES) expect(spec).toContain(code(t));
    });

    it("lists every attack move as inline code", () => {
      const spec = generateSpec();
      for (const m of MOVES) expect(spec).toContain(code(m));
    });

    it("lists every band as inline code", () => {
      const spec = generateSpec();
      for (const b of BANDS) expect(spec).toContain(code(b));
    });

    it("lists every readable field path as inline code", () => {
      const spec = generateSpec();
      for (const f of ALLOWED_FIELDS) expect(spec).toContain(code(f));
    });

    it("lists every readable rule path as inline code", () => {
      const spec = generateSpec();
      for (const r of ALLOWED_RULES) expect(spec).toContain(code(r));
    });
  });

  describe("frame table (sourced from CANONICAL_RULES)", () => {
    it("pairs each move with its reach", () => {
      const spec = generateSpec();

      for (const [id, move] of Object.entries(CANONICAL_RULES.moves)) {
        expect(pairingLine(spec, id, move.reach), `${id} reach`).toBeDefined();
      }
    });

    it("renders the perception latencies from the rules", () => {
      const spec = generateSpec();
      const lAct = CANONICAL_RULES.perception?.lAct ?? 0;
      const lPos = CANONICAL_RULES.perception?.lPos ?? 0;
      expect(pairingLine(spec, "perception.lAct", lAct)).toBeDefined();
      expect(pairingLine(spec, "perception.lPos", lPos)).toBeDefined();
    });

    it("shows each move's cancel-into routes (the okizeme/rekka follow-ups)", () => {
      const lines = generateSpec().split("\n");

      for (const [id, move] of Object.entries(CANONICAL_RULES.moves)) {
        const row = lines.find((l) => l.startsWith(`| ${code(id)} |`));
        expect(row, `${id} row`).toBeDefined();

        for (const target of move.cancelInto ?? []) {
          expect(row, `${id} cancels into ${target}`).toContain(target);
        }
      }
    });

    it("renders `—` for a move with no cancel routes", () => {
      const gyaku = { ...CANONICAL_RULES.moves["gyaku-zuki"] };

      delete gyaku.cancelInto;

      const rules: Rules = {
        ...CANONICAL_RULES,
        moves: { ...CANONICAL_RULES.moves, "gyaku-zuki": gyaku },
      };

      const row = generateSpec(rules)
        .split("\n")
        .find((l) => l.startsWith(`| ${code("gyaku-zuki")} |`));

      expect(row?.endsWith("| — |")).toBe(true);
    });

    it("lists only configured techniques — an unconfigured move gets no row", () => {
      const rulesNoSweep: Rules = {
        ...CANONICAL_RULES,
        moves: { ...CANONICAL_RULES.moves },
      };

      delete rulesNoSweep.moves.sweep;
      const lines = generateSpec(rulesNoSweep).split("\n");
      // anchor on the techniques table specifically (the state-read surface is
      // also a `| --- |` table now): its header row, then the separator, then body
      const header = lines.findIndex((l) => l.startsWith("| technique |"));
      const body = lines.slice(header + 2, lines.indexOf("", header + 2));

      // the techniques table body holds ONLY valid rows (no stray cell for the
      // dropped move), and the dropped move is absent from it
      expect(body.length).toBe(Object.keys(rulesNoSweep.moves).length);
      for (const row of body) expect(row.startsWith("| ")).toBe(true);
      expect(body.some((r) => r.includes(code("sweep")))).toBe(false);
    });
  });

  describe("benchmark rules (sourced from the manifest)", () => {
    // The one line carrying a benchmark-rule bullet, found by its code-spanned
    // label — so an assertion targets the intended rule (not a stray match).
    const ruleLine = (spec: string, label: string): string =>
      spec.split("\n").find((l) => l.includes(code(label))) ?? "";

    it("frames the fights as the arena (the sitting champions), not a gauntlet clearance gate", () => {
      const bench = sectionOf(generateSpec(), "## Benchmark rules").toLowerCase();
      // you fight the sitting champions in the KotH arena...
      expect(bench).toContain("arena");
      expect(bench).toContain("champions");
      // ...and there is no gauntlet / clearance-gate framing
      expect(bench).not.toContain("gauntlet");
    });

    it("describes the climb — how a bot ends up crowned, entered, or unplaced", () => {
      const bench = sectionOf(generateSpec(), "## Benchmark rules").toLowerCase();
      expect(bench).toContain("crowned"); // top every champion → the throne
      expect(bench).toContain("entered"); // out-rank the weakest → a seat
      expect(bench).toContain("unplaced"); // fall short → the standings are untouched
    });

    it("reveals no bot document in the arena section, and names no seed opponent", () => {
      // No per-opponent roster survives: the section carries no fenced code block
      // (no revealed bot DSL) and names none of the seed archetypes it once listed
      // — sourced from the manifest so re-adding any roster line re-reddens this.
      const bench = sectionOf(generateSpec(), "## Benchmark rules");
      expect(bench).not.toContain("```");
      const lower = bench.toLowerCase();

      for (const name of GAUNTLET_NAMES) {
        expect(lower, `${name} not named in the arena section`).not.toContain(
          name.toLowerCase(),
        );
      }
    });

    it("states the seed range and tick budget", () => {
      const spec = generateSpec();
      const seedLine = spec.split("\n").find((l) => l.includes(code("seeds")));
      expect(seedLine).toContain(String(SEEDS[0]));
      expect(seedLine).toContain(String(SEEDS[SEEDS.length - 1]));
      expect(pairingLine(spec, "maxTicks", MAX_TICKS)).toBeDefined();
    });

    it("states the WKF match win condition — the gap and the tick cap, sourced from the manifest", () => {
      const spec = generateSpec();
      // the win-gap is paired with its manifest value on the win-condition line
      expect(pairingLine(spec, "winGap", MATCH.winGap)).toBeDefined();

      const winCond = ruleLine(spec, "win condition");
      expect(winCond).toContain(String(MAX_TICKS)); // the tick cap
      expect(winCond.toLowerCase()).toContain("draw"); // equal-at-cap ⇒ draw
    });

    it("teaches the senshu first-blood tie-break in the win condition when the manifest enables it (D2)", () => {
      // the default manifest enables senshu ⇒ the cascade names it, and STILL
      // names the residual draw (a level bout with no first-blood holder)
      const winCond = ruleLine(generateSpec(), "win condition");
      expect(winCond.toLowerCase()).toContain("senshu");
      expect(winCond.toLowerCase()).toContain("draw");

      // ... and it is GATED on the manifest — a match without senshu omits it,
      // proving the cascade is interpolated from match.senshu, not a literal
      const noSenshu = ruleLine(
        generateSpec(CANONICAL_RULES, { winGap: MATCH.winGap }),
        "win condition",
      );

      expect(noSenshu.toLowerCase()).not.toContain("senshu");
      expect(noSenshu.toLowerCase()).toContain("draw");
    });

    it("teaches jogai — ring-out ⇒ yame-style reset + shared-ladder penalty, gated on match.jogai (v15)", () => {
      // present: the bullet names the reset, the opponent's award, and interpolates
      // the margin from the manifest
      const jogai = ruleLine(
        generateSpec(CANONICAL_RULES, {
          winGap: MATCH.winGap,
          senshu: true,
          jogai: { margin: 100000 },
        }),
        "jogai",
      );

      expect(jogai).toContain(code("margin")); // the margin is named, not a bare number
      expect(jogai).toContain("100000"); // margin, from the manifest
      expect(jogai.toLowerCase()).toContain("reset"); // yame-style reset
      expect(jogai.toLowerCase()).toContain("opponent"); // 2nd+ ring-out ⇒ opponent +1

      // interpolated, not a hardcoded literal — a different margin flows through
      const retuned = ruleLine(
        generateSpec(CANONICAL_RULES, {
          winGap: MATCH.winGap,
          senshu: true,
          jogai: { margin: 50000 },
        }),
        "jogai",
      );

      expect(retuned).toContain("50000");
      expect(retuned).not.toContain("100000");

      // gated on the manifest — a jogai-absent match omits the bullet entirely
      const noJogai = generateSpec(CANONICAL_RULES, {
        winGap: MATCH.winGap,
        senshu: true,
      });

      expect(ruleLine(noJogai, "jogai")).toBe("");
    });

    it("teaches passivity — non-engagement ⇒ yame reset + shared-ladder penalty, gated on match.passivity (v16)", () => {
      // present: the bullet names the limit, the reset, and the opponent's award,
      // interpolating the limit from the manifest
      const passivity = ruleLine(
        generateSpec(CANONICAL_RULES, {
          winGap: MATCH.winGap,
          senshu: true,
          passivity: { limit: 240 },
        }),
        "passivity",
      );

      expect(passivity).toContain(code("limit")); // the limit is named, not a bare number
      expect(passivity).toContain("240"); // limit, from the manifest
      expect(passivity.toLowerCase()).toContain("reset"); // yame-style reset
      expect(passivity.toLowerCase()).toContain("opponent"); // 2nd+ foul ⇒ opponent +1

      // interpolated, not a hardcoded literal — a different limit flows through
      const retuned = ruleLine(
        generateSpec(CANONICAL_RULES, {
          winGap: MATCH.winGap,
          senshu: true,
          passivity: { limit: 120 },
        }),
        "passivity",
      );

      expect(retuned).toContain("120");
      expect(retuned).not.toContain("240");

      // gated on the manifest — a passivity-absent match omits the bullet entirely
      const noPassivity = generateSpec(CANONICAL_RULES, {
        winGap: MATCH.winGap,
        senshu: true,
      });

      expect(ruleLine(noPassivity, "passivity")).toBe("");
    });

    it("teaches overtime — a level bout plays sudden death before senshu (winGap → overtime → senshu → draw), gated on match.overtime (v17)", () => {
      // present: the win-condition cascade names sudden-death overtime and interpolates the
      // period length from the manifest, placed BEFORE senshu (overtime is the first fallback)
      const winCond = ruleLine(
        generateSpec(CANONICAL_RULES, {
          winGap: MATCH.winGap,
          senshu: true,
          overtime: { ticks: 300 },
        }),
        "win condition",
      );

      expect(winCond).toContain(code("overtime")); // the mechanic is named
      expect(winCond.toLowerCase()).toContain("sudden"); // sudden death
      expect(winCond).toContain("300"); // the period length, from the manifest
      // overtime-first: sudden death is offered before senshu in the cascade
      expect(winCond.toLowerCase().indexOf("overtime")).toBeLessThan(
        winCond.toLowerCase().indexOf("senshu"),
      );

      // interpolated, not a hardcoded literal — a different period flows through
      const retuned = ruleLine(
        generateSpec(CANONICAL_RULES, {
          winGap: MATCH.winGap,
          senshu: true,
          overtime: { ticks: 500 },
        }),
        "win condition",
      );

      expect(retuned).toContain("500");
      expect(retuned).not.toContain("300");

      // gated on the manifest — an overtime-absent match omits it from the cascade
      const noOvertime = ruleLine(
        generateSpec(CANONICAL_RULES, { winGap: MATCH.winGap, senshu: true }),
        "win condition",
      );

      expect(noOvertime.toLowerCase()).not.toContain("overtime");
      // overtime-off inserts NOTHING before the senshu clause — the tie-break reads
      // straight from "points" into "if still level" (kills the empty-else mutant that
      // would splice a stray string into the cascade)
      expect(noOvertime).toContain("points; if still level");
    });

    it("ranks by win-rate first, net-points as the tiebreaker (corrects the stale metric)", () => {
      const metric = ruleLine(generateSpec(), "metric");
      expect(metric).toContain("win-rate");
      expect(metric).toContain("net-points");
      // win-rate is named BEFORE net-points — it is primary, not the tiebreaker
      expect(metric.indexOf("win-rate")).toBeLessThan(
        metric.indexOf("net-points"),
      );
    });

    it("describes yame — bodies reset while points, stamina, and memory persist", () => {
      const yame = ruleLine(generateSpec(), "yame");
      expect(yame.toLowerCase()).toContain("reset");

      for (const kept of ["points", "stamina", "memory"]) {
        expect(yame.toLowerCase(), `${kept} persists across yame`).toContain(
          kept,
        );
      }
    });

    it("interpolates the win gap — a retune changes the text (no hardcoded literal)", () => {
      const canonical = generateSpec(CANONICAL_RULES, { winGap: MATCH.winGap });
      const retuned = generateSpec(CANONICAL_RULES, { winGap: 12 });

      expect(pairingLine(canonical, "winGap", MATCH.winGap)).toBeDefined();
      expect(pairingLine(retuned, "winGap", 12)).toBeDefined();
      // once winGap changes, no line pairs `winGap` with the old value — proving
      // the number came from the manifest param, not a literal baked into prose
      expect(pairingLine(retuned, "winGap", MATCH.winGap)).toBeUndefined();
    });
  });

  describe("validation-error catalog", () => {
    it("documents the reason families an author will hit", () => {
      const spec = generateSpec();
      expect(spec).toContain("node budget");
      expect(spec).toContain("not allowed");
      expect(spec).toContain("unknown move");
      expect(spec).toContain("undeclared cell");
    });
  });

  describe("strategic primer (interpolated from the rules)", () => {
    const HEADING = "## Strategy primer";
    const lAct = CANONICAL_RULES.perception?.lAct ?? 0;
    const gasThreshold = CANONICAL_RULES.stamina?.gasThreshold ?? 0;

    // The primer line carrying a given claim — found by a stable concept phrase,
    // so the asserted value is the one PAIRED with that claim (not a coincidental
    // match elsewhere in the section).
    const claimLine = (primer: string, phrase: string): string =>
      primer.split("\n").find((l) => l.includes(phrase)) ?? "";

    it("is its own section, placed after the frame table and before benchmark rules", () => {
      const spec = generateSpec();
      expect(sectionOf(spec, HEADING)).not.toBe("");
      expect(spec.indexOf("## Frame table")).toBeLessThan(
        spec.indexOf(HEADING),
      );
      expect(spec.indexOf(HEADING)).toBeLessThan(
        spec.indexOf("## Benchmark rules"),
      );
    });

    it("cites the canonical perception, okizeme, and gas constants", () => {
      const primer = sectionOf(generateSpec(), HEADING);
      const reactable = claimLine(primer, "reactable iff");
      expect(reactable).toContain(code(String(lAct)));
      expect(reactable).toContain(code(String(lAct + 1)));
      expect(claimLine(primer, "FINISH")).toContain(
        code(String(CANONICAL_RULES.finishScore)),
      );
      expect(claimLine(primer, "GASSED")).toContain(code(String(gasThreshold)));
    });

    it("interpolates from the rules — a retune updates the prose (no hardcoded literals)", () => {
      const retuned: Rules = {
        ...CANONICAL_RULES,
        perception: { lPos: 2, lAct: 9, jitter: 1 },
        finishScore: 5,
        stamina: {
          ...(CANONICAL_RULES.stamina ?? { max: 100 }),
          gasThreshold: 25,
        },
      };

      const primer = sectionOf(generateSpec(retuned), HEADING);
      const reactable = claimLine(primer, "reactable iff");
      expect(reactable).toContain(code("9")); // retuned lAct
      expect(reactable).toContain(code("10")); // retuned lAct + 1
      expect(claimLine(primer, "FINISH")).toContain(code("5")); // retuned finishScore
      expect(claimLine(primer, "GASSED")).toContain(code("25")); // retuned gasThreshold
    });

    it("collapses absent optional constants to the sentinel `0` — never throws, never renders `undefined`", () => {
      const bare: Rules = { ...CANONICAL_RULES };

      delete bare.perception;
      delete bare.throw;
      delete bare.stamina;

      const primer = sectionOf(generateSpec(bare), HEADING);
      expect(primer).not.toContain("undefined");
      expect(claimLine(primer, "reactable iff")).toContain(code("0")); // lAct sentinel
      expect(claimLine(primer, "triangle")).toContain(code("0")); // throw.reach sentinel
      expect(claimLine(primer, "GASSED")).toContain(code("0")); // stamina sentinel
    });

    it("teaches horizontal jump displacement + the air strike in the occupancy primer (v18)", () => {
      const primer = sectionOf(generateSpec(), HEADING);
      // anchored on `jumpImpulse` — the phrase unique to the height & occupancy bullet
      // (the word "occupancy" also appears in the okizeme bullet)
      const occupancy = claimLine(primer, "jumpImpulse");

      expect(occupancy).toContain(code("jumpXSpeed")); // the horizontal-displacement tell is named
      expect(occupancy).toContain(String(CANONICAL_RULES.jumpXSpeed)); // paired with its value
      expect(occupancy).toContain(code("air")); // the air-move mechanic
      expect(occupancy).toContain(code("tobi-geri")); // the concrete air technique

      // interpolated, not a hardcoded literal — a retuned jumpXSpeed flows into the prose
      const retuned = claimLine(
        sectionOf(
          generateSpec({ ...CANONICAL_RULES, jumpXSpeed: 7777 }),
          HEADING,
        ),
        "jumpImpulse",
      );

      expect(retuned).toContain("7777");
      expect(retuned).not.toContain(String(CANONICAL_RULES.jumpXSpeed));
    });

    it("teaches the match objective — win-rate, the win gap, and the tick cap (interpolated from the manifest)", () => {
      const primer = sectionOf(generateSpec(), HEADING);
      const match = claimLine(primer, "match win-rate");
      expect(match).toContain(code(String(MATCH.winGap))); // the win gap
      expect(match).toContain(code(String(MAX_TICKS))); // the tick cap

      // a retuned win gap flows into the primer prose too (not a hardcoded literal)
      const retuned = sectionOf(
        generateSpec(CANONICAL_RULES, { winGap: 12 }),
        HEADING,
      );

      expect(claimLine(retuned, "match win-rate")).toContain(code("12"));
    });

    it("makes the senshu tells actionable in the primer — names self.senshu and opponent.senshu (D2)", () => {
      const matchLine = claimLine(
        sectionOf(generateSpec(), HEADING),
        "match win-rate",
      );

      expect(matchLine.toLowerCase()).toContain("senshu");
      expect(matchLine).toContain(code("self.senshu"));
      expect(matchLine).toContain(code("opponent.senshu"));

      // gated on the manifest — a match without senshu keeps the tells out AND
      // appends nothing: the bullet renders exactly as before (ends unchanged)
      const noSenshu = sectionOf(
        generateSpec(CANONICAL_RULES, { winGap: MATCH.winGap }),
        HEADING,
      );

      const noSenshuLine = claimLine(noSenshu, "match win-rate");

      expect(noSenshuLine.toLowerCase()).not.toContain("senshu");
      expect(noSenshuLine.endsWith("hold it.")).toBe(true);
    });

    it("teaches jogai ring-awareness in the primer — names self.x and the penalties tells, gated on match.jogai (v15)", () => {
      const jogaiLine = claimLine(
        sectionOf(
          generateSpec(CANONICAL_RULES, {
            winGap: MATCH.winGap,
            senshu: true,
            jogai: { margin: 100000 },
          }),
          HEADING,
        ),
        "jogai",
      );

      expect(jogaiLine).toContain(code("margin")); // the margin is named, not a bare number
      expect(jogaiLine).toContain(code("self.x")); // the boundary read
      expect(jogaiLine).toContain(code("self.penalties")); // own warning ladder
      expect(jogaiLine).toContain(code("opponent.penalties")); // the foe's
      expect(jogaiLine).toContain("100000"); // margin, interpolated from the manifest

      // gated on the manifest — a jogai-absent primer omits the clause entirely
      const noJogai = sectionOf(
        generateSpec(CANONICAL_RULES, { winGap: MATCH.winGap, senshu: true }),
        HEADING,
      );

      expect(claimLine(noJogai, "jogai")).toBe("");
    });

    it("teaches passivity awareness in the primer — names both passivityRemaining tells, gated on match.passivity (v16)", () => {
      const passivityLine = claimLine(
        sectionOf(
          generateSpec(CANONICAL_RULES, {
            winGap: MATCH.winGap,
            senshu: true,
            passivity: { limit: 240 },
          }),
          HEADING,
        ),
        "passivity",
      );

      expect(passivityLine).toContain(code("self.passivityRemaining")); // the self countdown
      expect(passivityLine).toContain(code("opponent.passivityRemaining")); // the foe's, for parity
      expect(passivityLine).toContain("240"); // limit, interpolated from the manifest

      // gated on the manifest — a passivity-absent primer omits the clause entirely
      const noPassivity = sectionOf(
        generateSpec(CANONICAL_RULES, { winGap: MATCH.winGap, senshu: true }),
        HEADING,
      );

      expect(claimLine(noPassivity, "passivity")).toBe("");
    });

    it("teaches overtime awareness in the primer — names clock.overtime + the all-in play, gated on match.overtime (v17)", () => {
      const overtimeLine = claimLine(
        sectionOf(
          generateSpec(CANONICAL_RULES, {
            winGap: MATCH.winGap,
            senshu: true,
            overtime: { ticks: 300 },
          }),
          HEADING,
        ),
        "overtime",
      );

      expect(overtimeLine).toContain(code("clock.overtime")); // the sudden-death tell
      expect(overtimeLine.toLowerCase()).toContain("all-in"); // the actionable strategy

      // gated on the manifest — an overtime-absent primer omits the clause entirely
      const noOvertime = sectionOf(
        generateSpec(CANONICAL_RULES, { winGap: MATCH.winGap, senshu: true }),
        HEADING,
      );

      expect(claimLine(noOvertime, "overtime")).toBe("");
      // with every officiating clause off, the primer ends on the senshu match-objective
      // bullet — no stray trailing content (kills the array-else mutants on the jogai /
      // passivity / overtime clause blocks, all trailing-empty in this config)
      expect(noOvertime.trimEnd().endsWith("steal it.")).toBe(true);
    });
  });

  describe("example bots (embedded verbatim + validated)", () => {
    const EXAMPLES = ["jabber", "vulture", "rekka"];

    // The committed (LF) content of a bot fixture — normalized so the assertion
    // holds regardless of the working-tree EOL (bots/*.json are `i/lf w/crlf` on
    // Windows; the embed and the LF-pinned spec.md are LF).
    const readBot = (name: string): string =>
      readFileSync(
        fileURLToPath(new URL(`../../bots/${name}.json`, import.meta.url)),
        "utf8",
      )
        .replace(/\r\n/g, "\n")
        .trim();

    // The ```json fenced blocks inside a markdown section.
    const jsonBlocks = (md: string): string[] =>
      md
        .split("```json")
        .slice(1)
        .map((part) => part.slice(0, part.indexOf("```")).trim());

    it("embeds exactly the three examples, each verbatim and validate()-accepted", () => {
      const blocks = jsonBlocks(sectionOf(generateSpec(), "## Example bots"));

      expect(blocks).toHaveLength(EXAMPLES.length);

      for (const name of EXAMPLES) {
        const verbatim = readBot(name);
        expect(blocks, `${name} embedded verbatim`).toContain(verbatim);
        expect(validate(JSON.parse(verbatim)).ok, `${name} validates`).toBe(
          true,
        );
      }
    });

    it("places the examples after the strategy primer, before benchmark rules", () => {
      const spec = generateSpec();
      expect(spec.indexOf("## Strategy primer")).toBeLessThan(
        spec.indexOf("## Example bots"),
      );
      expect(spec.indexOf("## Example bots")).toBeLessThan(
        spec.indexOf("## Benchmark rules"),
      );
    });
  });

  describe("submitting (how to enter the ring)", () => {
    const HEADING = "## Submitting";

    it("documents POST /fight and the required, human-sourced author handle", () => {
      const submit = sectionOf(generateSpec(), HEADING);

      expect(submit).not.toBe("");
      expect(submit).toContain("/fight"); // the endpoint to POST to
      expect(submit).toContain("X-Author-Handle"); // the attribution header
      expect(submit.toLowerCase()).toContain("required"); // it is mandatory, not optional
      // an LLM has no handle of its own — the spec must tell it to ask the human,
      // not fabricate one (the whole point of making the header mandatory)
      expect(submit.toLowerCase()).toContain("ask the human");
    });

    it("places the submit section last — after the benchmark rules", () => {
      const spec = generateSpec();

      expect(spec.indexOf("## Benchmark rules")).toBeLessThan(
        spec.indexOf(HEADING),
      );
    });

    it("teaches the practice default and the X-Compete opt-in to actually claim the throne", () => {
      const submit = sectionOf(generateSpec(), HEADING);

      // A bare /fight is a footprint-free practice run — an LLM must know iterating changes nothing,
      // or it will believe every submission already contests the throne.
      expect(submit.toLowerCase()).toContain("practice");
      // ...and it must know the exact header + value that flips a run from practice to a real
      // competing entry, or a good bot never actually competes.
      expect(submit).toContain("X-Compete: true");
      // pure KotH (D16): practice previews the arena directly — no six-bot clearance gate framing.
      expect(submit.toLowerCase()).not.toContain("gauntlet");
      expect(submit.toLowerCase()).not.toContain("title shot");
    });
  });
});

describe("state read surface — per-field semantics (Tier 1)", () => {
  const HEADING = "## State read surface (`field`)";

  // The table row documenting `field` — a markdown row `| `field` | … |`.
  const rowFor = (spec: string, field: string): string =>
    sectionOf(spec, HEADING)
      .split("\n")
      .find((l) => l.startsWith(`| ${code(field)} |`)) ?? "";

  it("gives every readable field its own documented row (no field left as a bare path)", () => {
    const spec = generateSpec();

    for (const f of ALLOWED_FIELDS) {
      expect(rowFor(spec, f), `${f} row`).not.toBe("");
    }
  });

  it("ends every row with one of the four delay markers (kills a blank delay cell)", () => {
    const spec = generateSpec();

    for (const f of ALLOWED_FIELDS) {
      expect(rowFor(spec, f), `${f} delay`).toMatch(
        /\| (live|`lPos`|`lAct`|static) \|$/,
      );
    }
  });

  it("spells out the attackBand height enum — 0 none / 1 low / 2 mid / 3 high", () => {
    const row = rowFor(generateSpec(), "opponent.attackBand");

    for (const [v, name] of [
      [0, "none"],
      [1, "low"],
      [2, "mid"],
      [3, "high"],
    ] as const) {
      expect(row, `${name} = ${v}`).toContain(code(String(v)));
      expect(row.toLowerCase(), `${name}`).toContain(name);
    }
  });

  it("spells out the posture enum — 0 standing / 1 crouching / 2 airborne", () => {
    const row = rowFor(generateSpec(), "self.posture");

    for (const name of ["standing", "crouching", "airborne"]) {
      expect(row.toLowerCase(), name).toContain(name);
    }
  });

  it("encodes a boolean tell as 0/1 (self.canAct)", () => {
    const row = rowFor(generateSpec(), "self.canAct");
    expect(row).toContain(code("0"));
    expect(row).toContain(code("1"));
  });

  it("classifies the delay per layer — self live, foe position lPos, foe action lAct, scoreboard live", () => {
    const spec = generateSpec();
    expect(rowFor(spec, "self.x")).toMatch(/\| live \|$/);
    expect(rowFor(spec, "opponent.distance")).toMatch(/\| `lPos` \|$/);
    expect(rowFor(spec, "opponent.attackBand")).toMatch(/\| `lAct` \|$/);
    expect(rowFor(spec, "opponent.points")).toMatch(/\| live \|$/);
    expect(rowFor(spec, "opponent.senshu")).toMatch(/\| live \|$/);
  });

  it("names both delay layers in the intro, interpolated from the rules (not hardcoded)", () => {
    const lPos = CANONICAL_RULES.perception?.lPos ?? 0;
    const lAct = CANONICAL_RULES.perception?.lAct ?? 0;
    const intro = sectionOf(generateSpec(), HEADING);
    expect(
      intro
        .split("\n")
        .find((l) => l.includes(code("lPos")) && l.includes(String(lPos))),
      "lPos paired with its value",
    ).toBeDefined();
    expect(
      intro
        .split("\n")
        .find((l) => l.includes(code("lAct")) && l.includes(String(lAct))),
      "lAct paired with its value",
    ).toBeDefined();

    // interpolated: a retuned perception flows through (kills a hardcoded literal)
    const retuned = sectionOf(
      generateSpec({
        ...CANONICAL_RULES,
        perception: { lPos: 2, lAct: 9, jitter: 1 },
      }),
      HEADING,
    );

    expect(retuned).toContain(code("lAct"));
    expect(retuned).toContain("9");
    expect(retuned).not.toContain(`\`lAct\` = ${lAct}`);
  });
});

describe("expressions — the sub-unit scale (Tier 2)", () => {
  it("states that distance and reach share the sub-unit scale, so they compare directly", () => {
    const expr = sectionOf(generateSpec(), "## Expressions").toLowerCase();
    expect(expr).toContain("sub-unit");
    expect(expr).toContain("distance");
    expect(expr).toContain("reach");
  });
});

describe("action grammar — degradation semantics + the band-encoding trap (Tier 2)", () => {
  const HEADING = "## Action grammar";
  const grammar = (): string => sectionOf(generateSpec(), HEADING);

  it("teaches the commitment guard — a non-idle action while canAct is 0 is denied", () => {
    const g = grammar();
    expect(g).toContain(code("self.canAct"));
    expect(g.toLowerCase()).toContain("idle");
  });

  it("lists what silently degrades an attack to idle — unconfigured move, illegal band, unaffordable stamina", () => {
    const g = grammar().toLowerCase();
    expect(g).toContain("degrade");
    expect(g).toContain("band"); // out-of-band degrade
    expect(g).toContain("stamina"); // unaffordable / gas lockout degrade
  });

  it("distinguishes a whiff (commits, pays its recovery) from a degrade (no frames spent)", () => {
    const g = grammar().toLowerCase();
    expect(g).toContain("reach"); // out-of-reach
    expect(g).toContain("whiff");
    expect(g).toContain("recovery"); // a whiff still pays recovery
  });

  it("warns that a band is READ as an integer but EMITTED as a string", () => {
    const g = grammar();
    expect(g).toContain(code("opponent.attackBand")); // the int read
    for (const b of ["high", "mid", "low"]) expect(g).toContain(code(b)); // the string emit
  });
});

describe("technique roles — glosses + intent (reused from the arsenal)", () => {
  // A role bullet: `- `id` (gloss) — …`.
  const roleLine = (spec: string, id: string): string =>
    spec.split("\n").find((l) => l.startsWith(`- ${code(id)} (`)) ?? "";

  it("gives every configured technique a role line with its English gloss", () => {
    const spec = generateSpec();

    for (const id of Object.keys(CANONICAL_RULES.moves)) {
      expect(roleLine(spec, id), `${id} role`).not.toBe("");
    }
  });

  it("names the throw's role too (the anti-guard takedown)", () => {
    expect(roleLine(generateSpec(), "throw")).not.toBe("");
  });

  it("carries the strategic gloss for a reach-relevant move (shuto out-ranges the reverse)", () => {
    expect(roleLine(generateSpec(), "shuto").toLowerCase()).toContain(
      "longest-reaching",
    );
  });

  it("places the role list under the techniques table, before the global constants", () => {
    const spec = generateSpec();
    const table = spec.indexOf("| technique |");
    const roles = spec.indexOf(`- ${code("kizami-zuki")} (`);
    const globals = spec.indexOf("### Global constants");
    expect(table).toBeLessThan(roles);
    expect(roles).toBeLessThan(globals);
  });

  it("omits a role line for an unconfigured technique (matches the table)", () => {
    const rulesNoSweep: Rules = {
      ...CANONICAL_RULES,
      moves: { ...CANONICAL_RULES.moves },
    };

    delete rulesNoSweep.moves.sweep;
    const spec = generateSpec(rulesNoSweep);
    expect(
      spec.split("\n").find((l) => l.startsWith(`- ${code("sweep")} (`)),
    ).toBeUndefined();
  });

  it("gates the throw's role line on a configured throw (absent throw ⇒ no throw role)", () => {
    const rulesNoThrow: Rules = { ...CANONICAL_RULES };

    delete rulesNoThrow.throw;
    const spec = generateSpec(rulesNoThrow);
    expect(
      spec.split("\n").find((l) => l.startsWith(`- ${code("throw")} (`)),
    ).toBeUndefined();
  });
});

describe("docs/spec.md is the committed, drift-free generator output", () => {
  it("byte-matches a fresh generateSpec()", () => {
    const specPath = fileURLToPath(
      new URL("../../docs/spec.md", import.meta.url),
    );

    const committed = readFileSync(specPath, "utf8");
    expect(committed).toBe(generateSpec());
  });
});
