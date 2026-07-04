import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { validate } from "../engine/dsl.js";
import { benchmark } from "../engine/benchmark.js";
import { loadBotDoc } from "./load.js";
import {
  GAUNTLET_NAMES,
  MATCH,
  MAX_TICKS,
  SEEDS,
} from "../engine/benchmark-config.js";
import { CANONICAL_RULES } from "../engine/rules.js";

// The dogfood bot — authored COLD from `docs/spec.md` alone (the one-shot
// benchmark input), exercising the spec's sweep→cancel→finish okizeme combo to
// prove the generated spec is a sufficient authoring instrument. Two things are
// pinned here: (1) it VALIDATES first-try, and (2) run through the real v14
// benchmark (WKF match mode + senshu, CANONICAL_RULES) it competes as a REAL
// match participant — winning some matchups and losing most. This replaces the
// stale raw-600-tick read (a −2682 "> half net-points" near-miss against a
// 100%-win sweeper); under match mode the score ranks by match wins, so the
// dogfood is a weak-but-legitimate entry. Gauntlet modernization S1 (vulture
// gains a parry→counter) shifted its record 16W/104L → 18W/102L; S-jabber
// (jabber block+counter), S2 (zoner's narrow-gated long kicks) and S3
// (grappler's close-range knee + elbow) all left it unchanged — the dogfood was
// already losing those matchups. The item-3 jogai adoption (v15: ring-aware zoner
// + naive-victim sweeper) also left 18W/102L intact — the dogfood attacks (so
// the sweeper's flee-when-shut-out never triggers against it) and never rings
// itself out, so jogai does not touch its matchup outcomes. The item-3 passivity
// adoption (v16: jabber reads self.passivityRemaining, vulture shaped into a
// standoff victim) shifts it 18W → 13W/107L — the re-authored jabber and vulture
// flip the dogfood's outcomes in those two matchups. The dogfood attacks every
// tick, so it never commits a passivity foul of its own; the change is purely the
// two carriers' new behaviour. The item-3 overtime adoption (v17: jabber
// multi-reads clock.overtime for a sudden-death all-in) leaves the RECORD at
// 13W/107L: overtime turns exactly one dogfood bout (vs grappler, seed 2) into
// sudden death, but its winner is unchanged — only the dogfood's net shifts +1
// (−1786 → −1785). The jabber's overtime rule never fires against the dogfood
// (their bouts never reach the cap level, so the jabber never enters OT vs it).
const botText = (name: string): string =>
  readFileSync(
    fileURLToPath(new URL(`../../bots/${name}.json`, import.meta.url)),
    "utf8",
  );

describe("dogfood bot (authored from docs/spec.md)", () => {
  it("validates on the first generation", () => {
    const doc: unknown = JSON.parse(botText("dogfood"));
    expect(validate(doc).ok).toBe(true);
  });

  it("competes as a real match participant in the v17 benchmark (wins some, loses most)", () => {
    // The real aggregator over the frozen v17 gauntlet — the exact scoring inputs
    // pinned by BENCHMARK_VERSION/INPUT_HASH (a change bumps the version and this
    // characterization with it).
    const result = benchmark({
      bot: loadBotDoc(botText("dogfood")),
      gauntlet: GAUNTLET_NAMES.map((name) => loadBotDoc(botText(name))),
      seeds: SEEDS,
      maxTicks: MAX_TICKS,
      rules: CANONICAL_RULES,
      match: MATCH,
    });

    const losses = result.totalFights - result.wins - result.draws;

    // A real competitor: it takes genuine wins (no longer the degenerate 0-wins
    // raw-farm read) while losing the majority. Net (−1785) stays loop-inflated in
    // yame-starving matchups (vs rekka / sweeper), so RANKING is by win-rate
    // (primary); net is only the tiebreaker. Its wins now come almost entirely from
    // the grappler matchup (12W); v16's re-authored jabber + vulture cost it the
    // handful it used to steal there (18W → 13W).
    expect(result.wins).toBe(13);
    expect(losses).toBe(107);
    expect(result.draws).toBe(0);
    expect(result.totalFights).toBe(120);
  });
});
