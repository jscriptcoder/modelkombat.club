// ============================================================================
// The spec generator — emits the FACTUAL, machine-truth backbone of the bot
// authoring spec (`docs/spec.md`) straight from the engine's single sources:
// the `dsl.ts` allowlists + `LIMITS` (the grammar a bot may use), the
// `CANONICAL_RULES` frame table (the numbers it fights on), and the benchmark
// manifest (how it is scored). Every list and number is read from those imports
// — nothing is retyped — so the spec CANNOT drift from the engine (a drift test
// pins the committed `docs/spec.md` byte-for-byte to this output).
//
// `generateSpec()` is deterministic (no wall-clock; it reads only committed
// sources — the engine modules + the `bots/` example fixtures), so same repo ⇒
// same bytes. It also carries a hand-authored strategic primer whose every NUMBER
// is interpolated from `rules` (so the strategy text can never cite a stale
// constant) and a set of validated example bots embedded verbatim.
// ============================================================================
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  ACTION_TYPES,
  ALLOWED_FIELDS,
  ALLOWED_RULES,
  BANDS,
  BOOL_OPS,
  CELL_RE,
  LIMITS,
  MOVES,
  NUM_OPS,
  RULE_READERS,
} from "../engine/dsl.js";
import type { FieldPath } from "../engine/dsl.js";
import { CANONICAL_RULES } from "../engine/rules.js";
import type { MoveSpec, Rules } from "../engine/types.js";
import {
  BENCHMARK_VERSION,
  INPUT_HASH,
  MATCH,
  MAX_TICKS,
  SEEDS,
} from "../engine/benchmark-config.js";

// The WKF match parameters the benchmark scores on (winGap + the tick cap, plus
// the optional senshu first-blood tie-break, the optional jogai ring-out penalty,
// the optional passivity non-engagement penalty, and the optional sudden-death
// overtime period). A narrow structural type so the section/primer can be exercised
// against a retuned gap — or a manifest toggling senshu / jogai / passivity /
// overtime — in tests, mirroring the `rules` parameter's purpose.
type Match = {
  winGap: number;
  senshu?: boolean;
  jogai?: { margin: number };
  passivity?: { limit: number };
  overtime?: { ticks: number };
};

// markdown inline-code span
const code = (s: string): string => "`" + s + "`";

const bullets = (items: Iterable<string>): string =>
  [...items].map((s) => `- ${code(s)}`).join("\n");

const header = (): string =>
  [
    "# ModelKombat — Bot authoring spec",
    "",
    "> **GENERATED — do not edit by hand.** Regenerate with `npm run gen:spec`.",
    "> Every allowlist, limit, and frame-table number below is read directly from",
    "> the engine, so this document cannot lie about how a fight resolves.",
    "",
    `- **Benchmark version:** \`${BENCHMARK_VERSION}\` — a score is comparable only against another at the same version.`,
    `- **Input hash:** \`${INPUT_HASH}\` (pins the scoring inputs: rules + opponents + run params).`,
    "",
    "A bot is a **JSON document, not code**: no I/O, no loops, no recursion. It is",
    "validated once against the allowlists below (the security boundary), then run",
    "unchanged. The engine calls it **once per tick**; rules are evaluated",
    "top-to-bottom against one coherent (latency-delayed) snapshot, and the first",
    "rule whose `when` holds and that carries a `do` returns the tick's `Action`.",
  ].join("\n");

// A version-neutral game-overview intro: what ModelKombat IS, so a cold model
// understands the domain (an LLM authors a data-not-code karate bot that fights
// in a King-of-the-Hill arena) before the DSL mechanics. Kept to the minimum that
// helps AUTHORING — no render-layer flavor, no engine internals. Cites NO version /
// hash / manifest count, so a `BENCHMARK_VERSION` bump must never touch this prose.
const overviewSection = (): string =>
  [
    "## What ModelKombat is",
    "",
    "ModelKombat is a fighting game whose fighters are authored by LLMs. You — a",
    "language model — read this spec and emit a **bot document** in the small JSON",
    "domain-specific language defined below. A bot is **data, not code**: it is",
    "validated once against the allowlists here (the security boundary) and then",
    "interpreted, never executed as a program.",
    "",
    "Two bots then fight a **WKF karate match** — strikes, throws, and sweeps across",
    "height bands, decided on points. Your bot enters a **King-of-the-Hill arena** and",
    "fights the sitting champions — the fighters other authors have already placed",
    "there; you author from this spec alone, with no feedback loop while you write.",
    "Encode a strategy as priority-ordered rules and submit.",
  ].join("\n");

const limitsSection = (): string =>
  [
    "## Limits",
    "",
    "Hard caps enforced at validation time — a document that exceeds any of these",
    "is rejected. The engine needs no instruction metering: worst-case cost is",
    "bounded by document size. Every expression node (numeric or boolean) counts",
    `against \`maxNodes\` and nesting against \`maxDepth\`.`,
    "",
    ...Object.entries(LIMITS).map(([k, v]) => `- ${code(k)} — ${v}`),
  ].join("\n");

const documentShapeSection = (): string =>
  [
    "## Document shape",
    "",
    "```jsonc",
    "{",
    '  "version": 1,',
    '  "name": "string (1..64 chars)",   // the fighter name shown on the ladder — not your author handle',
    '  "model": "string (1..64 chars)",  // the model + reasoning effort that authored this bot (e.g. "Claude Opus 4.8 (high)")',
    '  "memory": { "cellName": 0 },      // optional: declared int cells, persist across ticks within a fight',
    '  "rules": [ <Rule>, ... ],         // priority-ordered; first matching `do` wins',
    '  "default": <Action>               // taken when no rule fires',
    "}",
    "```",
    "",
    "```jsonc",
    "// Rule: if `when` holds, apply `set` writes; a `do` (if present) is the terminal action.",
    "// A rule with no `do` is a TRACKER (updates memory, evaluation continues).",
    '{ "when": <BoolExpr>, "set": [ { "cell": "name", "to": <NumExpr> } ], "do": <Action> }',
    "```",
  ].join("\n");

const expressionsSection = (): string =>
  [
    "## Expressions",
    "",
    "All values are **fixed-point integers**. Arithmetic is **int32-saturating**:",
    `every op clamps its result to [\`${LIMITS.intMin}\`, \`${LIMITS.intMax}\`];`,
    "`div` truncates toward zero and division by zero yields `0`. These rules make",
    "every evaluation bit-reproducible across platforms.",
    "",
    "Positions, distances, reach, and velocities are measured in **sub-units**",
    "(`1000` sub-units = one world unit). `opponent.distance` and a move's `reach`",
    "share this scale, so you compare them directly.",
    "",
    "**Numeric expressions** (`NumExpr`):",
    "",
    `- leaves: ${code("const")} (\`{op:"const",value}\`), ${code("field")} (\`{op:"field",path}\`), ${code("mem")} (\`{op:"mem",cell}\`), ${code("rule")} (\`{op:"rule",path}\`)`,
    `- all ${code("op")} tags (leaves + arithmetic): ${NUM_OPS.map(code).join(", ")}`,
    "",
    "**Boolean expressions** (`BoolExpr`):",
    "",
    `- operators: ${BOOL_OPS.map(code).join(", ")}`,
  ].join("\n");

// Per-field authoring documentation for the read surface. The engine keeps this
// knowledge in `types.ts` comments (encodings), `dsl.ts` FIELD_READERS (the 0/1
// boolean serialization), and `sim.ts` perceiveOpponent (the delay layer split) —
// none machine-readable, so it is mirrored here by hand, keyed by `FieldPath` so
// the compiler flags any field left undocumented (a drift guard). `delay` names
// the perception layer: `live` (self + the scoreboard reads), `lPos` (the foe's
// positional reads), `lAct` (the foe's action tells), or `static` (frame-table).
type Delay = "live" | "lPos" | "lAct" | "static";
type FieldDoc = { reads: string; enc: string; delay: Delay };

const DELAY_LABEL: Record<Delay, string> = {
  live: "live",
  lPos: "`lPos`",
  lAct: "`lAct`",
  static: "static",
};

const FIELD_DOCS: Record<FieldPath, FieldDoc> = {
  "self.x": {
    reads: "your position in the ring",
    enc: "sub-units, `0`..`ring.width`",
    delay: "live",
  },
  "self.facing": {
    reads: "the way you face",
    enc: "`-1` or `1`",
    delay: "live",
  },
  "self.points": { reads: "your score", enc: "WKF points", delay: "live" },
  "self.canAct": {
    reads: "may you start a new action?",
    enc: "`0` mid-move / `1` free",
    delay: "live",
  },
  "self.phaseRemaining": {
    reads: "ticks left in your move's current phase",
    enc: "ticks",
    delay: "live",
  },
  "self.counterWindow": {
    reads: "post-parry counter ticks left",
    enc: "ticks (`0` closed)",
    delay: "live",
  },
  "self.cancelWindow": {
    reads: "on-contact cancel ticks left",
    enc: "ticks (`0` closed)",
    delay: "live",
  },
  "self.finishWindow": {
    reads: "okizeme finish ticks left on the downed foe",
    enc: "ticks (`0` can't finish)",
    delay: "live",
  },
  "self.stamina": {
    reads: "your conditioning meter",
    enc: "`0`..`stamina.max` (`0` if no meter)",
    delay: "live",
  },
  "self.gassed": {
    reads: "are you gassed (stamina ≤ `gasThreshold`)?",
    enc: "`0` no / `1` yes",
    delay: "live",
  },
  "self.penalties": {
    reads: "your jogai/passivity warning count",
    enc: "count",
    delay: "live",
  },
  "self.passivityRemaining": {
    reads: "ticks until your passivity foul",
    enc: "ticks (`0` imminent / off)",
    delay: "live",
  },
  "self.senshu": {
    reads: "do you hold first blood?",
    enc: "`0` no / `1` yes",
    delay: "live",
  },
  "self.posture": {
    reads: "your stance",
    enc: "`0` standing / `1` crouching / `2` airborne",
    delay: "live",
  },
  "self.y": {
    reads: "your height",
    enc: "sub-units (`0` grounded)",
    delay: "live",
  },
  "self.vy": {
    reads: "your vertical velocity",
    enc: "sub-units/tick (`>0` rising, `<0` falling)",
    delay: "live",
  },
  "opponent.x": {
    reads: "the foe's position",
    enc: "sub-units",
    delay: "lPos",
  },
  "opponent.y": {
    reads: "the foe's height",
    enc: "sub-units (`0` grounded)",
    delay: "lPos",
  },
  "opponent.facing": {
    reads: "the way the foe faces",
    enc: "`-1` or `1`",
    delay: "lPos",
  },
  "opponent.distance": {
    reads: "the gap between you",
    enc: "sub-units — compare to a move's `reach`",
    delay: "lPos",
  },
  "opponent.attacking": {
    reads: "is the foe committed to a strike?",
    enc: "`0` no / `1` yes",
    delay: "lAct",
  },
  "opponent.attackBand": {
    reads: "the height band of the foe's attack",
    enc: "`0` none / `1` low / `2` mid / `3` high",
    delay: "lAct",
  },
  "opponent.posture": {
    reads: "the foe's stance",
    enc: "`0` standing / `1` crouching / `2` airborne",
    delay: "lAct",
  },
  "opponent.throwing": {
    reads: "is the foe committed to a grab?",
    enc: "`0` no / `1` yes",
    delay: "lAct",
  },
  "opponent.knockdown": {
    reads: "is the foe knocked down?",
    enc: "`0` no / `1` yes",
    delay: "lAct",
  },
  "opponent.vx": {
    reads: "the foe's horizontal velocity (dead-reckoning)",
    enc: "sub-units/tick",
    delay: "lPos",
  },
  "opponent.predictedDistance": {
    reads: "the gap dead-reckoned over the `lPos` lag",
    enc: "sub-units",
    delay: "lPos",
  },
  "opponent.stamina": {
    reads: "the foe's conditioning meter",
    enc: "`0`..`stamina.max`",
    delay: "lAct",
  },
  "opponent.gassed": {
    reads: "is the foe gassed?",
    enc: "`0` no / `1` yes",
    delay: "lAct",
  },
  "opponent.points": {
    reads: "the foe's score",
    enc: "WKF points",
    delay: "live",
  },
  "opponent.penalties": {
    reads: "the foe's warning count",
    enc: "count",
    delay: "live",
  },
  "opponent.passivityRemaining": {
    reads: "ticks until the foe's passivity foul",
    enc: "ticks",
    delay: "lAct",
  },
  "opponent.senshu": {
    reads: "does the foe hold first blood?",
    enc: "`0` no / `1` yes",
    delay: "live",
  },
  "ring.width": { reads: "the ring width", enc: "sub-units", delay: "static" },
  "clock.tick": {
    reads: "the current tick",
    enc: "ticks (0-based)",
    delay: "live",
  },
  "clock.ticksRemaining": {
    reads: "ticks left in regulation",
    enc: "ticks",
    delay: "live",
  },
  "clock.overtime": {
    reads: "is the bout in sudden death?",
    enc: "`0` regulation / `1` overtime",
    delay: "live",
  },
};

const stateReadsSection = (rules: Rules): string => {
  const lPos = rules.perception?.lPos ?? 0;
  const lAct = rules.perception?.lAct ?? 0;

  const fieldRow = (path: FieldPath): string => {
    const d = FIELD_DOCS[path];

    return `| ${code(path)} | ${d.reads} | ${d.enc} | ${DELAY_LABEL[d.delay]} |`;
  };

  // Object.keys loses the key type; the record's keys ARE the FieldPath allowlist.
  const rows = (Object.keys(FIELD_DOCS) as FieldPath[]).map(fieldRow);

  return [
    "## State read surface (`field`)",
    "",
    'The whitelisted state leaves a bot may read via `{op:"field",path}`. All reads',
    "return **integers**: booleans read as `0`/`1`, and enums are the small integers",
    "named in the *encoding* column (e.g. `opponent.attackBand` is `0` none / `1` low",
    "/ `2` mid / `3` high).",
    "",
    `**Delay.** \`self.*\` and the live scoreboard reads (\`opponent.points\` / \`opponent.penalties\` / \`opponent.senshu\`) carry no latency. The foe's *positional* reads lag \`lPos\` = ${lPos} tick(s); its *action* tells lag \`lAct\` = ${lAct} ticks (the master inequality — see the primer).`,
    "",
    "| field | reads | encoding / unit | delay |",
    "| --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
};

const ruleReadsSection = (): string =>
  [
    "## Ruleset read surface (`rule`)",
    "",
    "The frozen frame-table constants a bot may read symbolically via",
    '`{op:"rule",path}` — e.g. `rule("moves.mae-geri.reach")` instead of the literal.',
    "An unconfigured constant reads the sentinel `0`. Their current values are in",
    "the frame table below.",
    "",
    bullets(ALLOWED_RULES),
  ].join("\n");

const actionGrammarSection = (): string =>
  [
    "## Action grammar",
    "",
    "A bot returns exactly **one** action per tick. `dir` is relative to facing:",
    "`+1` toward the opponent, `-1` away, `0` hold.",
    "",
    `- action types: ${ACTION_TYPES.map(code).join(", ")}`,
    `- ${code("attack")} takes a ${code("move")} and a ${code("band")}.`,
    `- attack moves: ${[...MOVES].map(code).join(", ")}`,
    `- bands: ${[...BANDS].map(code).join(", ")}`,
    "",
    "**Bands are asymmetric.** You *emit* a band as the string `high` / `mid` / `low`,",
    "but you *read* the foe's band as an integer (`opponent.attackBand`, `0`..`3`) — so",
    "never compare the two directly.",
    "",
    "**Illegal-in-the-moment actions don't error — they degrade.** While `self.canAct`",
    "is `0` you are mid-move and any non-idle action is denied (you do nothing until the",
    "move ends) — so every bot leads with a `self.canAct == 0` → `idle` guard. An",
    "`attack` silently **degrades to `idle`** (no frames, no stamina spent) when the move",
    "is not configured, its `band` is not one of the move's legal `bands`, you cannot",
    "afford its stamina (the gassed special-lockout), or it is context-wrong (an `air`",
    "move like `tobi-geri` on the ground). But an attack that *starts* yet lands beyond",
    "`reach` still commits and **whiffs** — you pay its full `recovery`. Committing out of",
    "range is a punishable mistake, not a no-op.",
  ].join("\n");

const moveRow = (id: string, m: MoveSpec): string =>
  `| ${code(id)} | ${m.startup} | ${m.active} | ${m.recovery} | ${m.score} | ${m.reach} | ${m.staminaCost ?? 0} | ${(m.bands ?? []).join("/") || "—"} | ${(m.cancelInto ?? []).join(" / ") || "—"} |`;

// The English gloss + strategic role of each technique — the "intent" the numeric
// frame table can't convey (an author otherwise needs prior karate knowledge to
// know `mawashi-geri` is the roundhouse). Mirrored VERBATIM from the public site's
// arsenal (`web/src/pages/home/Arsenal.tsx`) so the spec and site never disagree.
// `throw` is included (it is a technique authors use) though it lives in the global
// constants, not the moves table.
const MOVE_ROLES: Record<string, { gloss: string; role: string }> = {
  "kizami-zuki": {
    gloss: "jab",
    role: "Fast lead-hand poke — the tempo-setter that opens the cancel chain.",
  },
  "gyaku-zuki": {
    gloss: "reverse punch",
    role: "The power hand and cancel hub — every combo routes through it.",
  },
  "mae-geri": {
    gloss: "front kick",
    role: "The straight-line body kick — a reliable waza-ari from mid range.",
  },
  "mawashi-geri": {
    gloss: "roundhouse kick",
    role: "Arcs to the body for two, or over the guard to the head for the ippon.",
  },
  uraken: {
    gloss: "backfist",
    role: "Cheapest, shortest hand — a gas-proof jodan snap and combo starter.",
  },
  shuto: {
    gloss: "knife-hand",
    role: "The longest-reaching hand, out-ranging even the reverse punch.",
  },
  "yoko-geri": {
    gloss: "side kick",
    role: "A beyond-neutral thrust that out-reaches even the roundhouse.",
  },
  "ushiro-geri": {
    gloss: "back kick",
    role: "The longest, most committed strike — a turn-away thrust you'll see coming.",
  },
  empi: {
    gloss: "elbow strike",
    role: "Shortest reach in the game — a point-blank two-point payoff.",
  },
  "hiza-geri": {
    gloss: "knee strike",
    role: "The only standing mid-band knockdown — it sets up a three-point finish.",
  },
  "tobi-geri": {
    gloss: "jumping kick",
    role: "Leap in from range for a head-height ippon — the only airborne strike.",
  },
  sweep: {
    gloss: "foot sweep",
    role: "Chops the base out; scores nothing, but the okizeme finish pays three.",
  },
  throw: {
    gloss: "throw",
    role: "Clean takedown for the instant ippon — the anti-turtle answer.",
  },
};

const roleLine = (id: string): string => {
  const r = MOVE_ROLES[id];

  return `- ${code(id)} (${r.gloss}) — ${r.role}`;
};

const frameTableSection = (rules: Rules): string => {
  // `Object.entries` widens optional move values to `MoveSpec | undefined`, but
  // an absent optional key yields NO entry at runtime — every enumerated value
  // is a real `MoveSpec`. The assertion drops that unreachable `undefined` (so
  // there is no dead guard branch); an unconfigured move shows up as a missing
  // key, simply contributing no row.
  const moves = Object.entries(rules.moves) as [string, MoveSpec][];
  const rows = moves.map(([id, m]) => moveRow(id, m));

  // Role lines for every CONFIGURED technique (same iteration as the table, so an
  // unconfigured move gets neither a row nor a role), plus `throw` when configured.
  const roles = moves.map(([id]) => roleLine(id));
  if (rules.throw) roles.push(roleLine("throw"));

  const globals = Object.entries(RULE_READERS)
    .filter(([path]) => !path.startsWith("moves."))
    .map(([path, read]) => `- ${code(path)} — ${read(rules)}`);

  return [
    "## Frame table",
    "",
    "The authoritative numbers the platform fights on (`CANONICAL_RULES`).",
    "",
    "### Techniques",
    "",
    "`cancels into` — on a CONNECT (hit/block), a move can cancel its recovery into",
    "one of these follow-ups within `cancelWindow` ticks (see the primer). A sweep's",
    "cancel into a strike during the foe's `finishWindow` is the okizeme finish.",
    "",
    "| technique | startup | active | recovery | score | reach | cost | bands | cancels into |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
    "Each technique's role (the numbers above are the truth; this is the intent):",
    "",
    ...roles,
    "",
    "### Global constants",
    "",
    ...globals,
  ].join("\n");
};

const errorCatalogSection = (): string =>
  [
    "## Validation-error catalog",
    "",
    "A rejected document reports structured `{ path, reason }` issues. The reason",
    "families an author hits:",
    "",
    "- **node budget exceeded** — the document has more expression nodes than `maxNodes`.",
    "- **too deeply nested** — an expression exceeds `maxDepth`.",
    "- **field not allowed** / **rule not allowed** — a `field`/`rule` path outside the read surface.",
    "- **unknown move** / **unknown band** — an `attack` naming a move/band outside the allowlist.",
    "- **undeclared cell** — a `mem` read or `set` write to a cell not declared in `memory`.",
    "- **unknown numeric/boolean op** — an unrecognised expression operator.",
  ].join("\n");

const benchmarkSection = (match: Match): string =>
  [
    "## Benchmark rules",
    "",
    "A submitted bot fights **WKF matches** against the sitting champions — the King on",
    "the throne and the challengers ranked below it, up to three fighters in all — scored",
    "deterministically and versioned. The spec is the only input; there is no feedback loop.",
    "",
    `- ${code("win condition")} — a match ends the moment either fighter leads by ${code("winGap")} = ${match.winGap} points; otherwise it runs the full ${code("maxTicks")} = ${MAX_TICKS} ticks and is decided on total points${
      match.overtime
        ? `; if still level, one sudden-death ${code("overtime")} period of ${code("ticks")} = ${match.overtime.ticks} ticks plays — first to a 1-point gap wins`
        : ""
    }${
      match.senshu
        ? `; if still level, the first fighter to have scored (${code("senshu")}, first blood) wins — only a bout where neither drew first blood is a draw`
        : " (equal ⇒ a draw)"
    }.`,
    `- ${code("yame")} — after each SCORING exchange resolves, both fighters reset to the neutral start (position, posture, guard, open windows) — but points, stamina, and memory PERSIST. No okizeme farm carries across exchanges.`,
    ...(match.jogai
      ? [
          `- ${code("jogai")} — a fighter forced OUT of the legal region (into the outer ${code("margin")} = ${match.jogai.margin} strip of the ring) rings out: a yame-style neutral reset PLUS a shared category-2 penalty — the first ring-out is a free warning, the second and beyond each award the opponent +1 point.`,
        ]
      : []),
    ...(match.passivity
      ? [
          `- ${code("passivity")} — a fighter that goes ${code("limit")} = ${match.passivity.limit} ticks without landing any offense (a strike that hits, is blocked, or is parried, or a live grab — a whiff at air does NOT count) is fouled for non-engagement: a yame-style neutral reset PLUS the SAME shared category-2 penalty ladder as jogai (first foul a free warning, the second and beyond each award the opponent +1 point). Landing offense resets your clock.`,
        ]
      : []),
    `- ${code("metric")} — win-rate (matches won) is primary; Σ net-points over every (opponent × seed × side) fight breaks ties.`,
    `- ${code("seeds")} — ${SEEDS[0]}..${SEEDS[SEEDS.length - 1]} (${SEEDS.length} seeds), each matchup played twice (bot as A and as B).`,
    `- ${code("maxTicks")} — ${MAX_TICKS}`,
    "",
    "**The climb.** Your bot round-robins the whole arena, and the field — you plus the",
    "sitting champions — is ranked by that metric. Out-rank the weakest champion and you",
    "take its seat (**entered**), relegating it; finish above every champion and you seize",
    "the throne (**crowned**); fall short of them all and you are **unplaced** and the",
    "standings are untouched — one round-robin decides everything, with no separate",
    "clearance gate.",
  ].join("\n");

/**
 * A JSON Schema (draft-07) for the bot document. A deliberate **permissive
 * structural over-approximation** of `validate()`: it enforces shape, the
 * allowlists (enum membership sourced from the same `dsl.ts` sets the markdown
 * renders), and expression arities — but CANNOT encode the node budget, max
 * nesting depth, the byte cap, or declared-before-use cells, so `validate()`
 * stays the authority. `additionalProperties` is left open because the validator
 * ignores extra keys ⇒ everything `validate()` accepts, the schema accepts.
 */
export function botDocSchema(): Record<string, unknown> {
  const ref = (name: string): { $ref: string } => ({
    $ref: `#/definitions/${name}`,
  });

  // a `NumExpr`/`BoolExpr`/`Action` variant: pin the discriminator, require its
  // operand(s) — `oneOf` selects exactly one because the discriminators are
  // disjoint consts/enums.
  const variant = (
    disc: string,
    tag: Record<string, unknown>,
    required: string[],
    properties: Record<string, unknown>,
  ): Record<string, unknown> => ({
    type: "object",
    required: [disc, ...required],
    properties: { [disc]: tag, ...properties },
  });

  const dir = { enum: [-1, 0, 1] };

  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    $ref: "#/definitions/BotDoc",
    definitions: {
      BotDoc: {
        type: "object",
        required: ["version", "name", "model", "rules", "default"],
        properties: {
          version: { const: 1 },
          name: { type: "string", minLength: 1, maxLength: 64 },
          model: { type: "string", minLength: 1, maxLength: 64 },
          memory: {
            type: "object",
            maxProperties: LIMITS.maxCells,
            propertyNames: { pattern: CELL_RE.source },
            additionalProperties: { type: "integer" },
          },
          rules: {
            type: "array",
            maxItems: LIMITS.maxRules,
            items: ref("Rule"),
          },
          default: ref("Action"),
        },
      },
      Rule: {
        type: "object",
        required: ["when"],
        properties: {
          when: ref("BoolExpr"),
          set: {
            type: "array",
            items: {
              type: "object",
              required: ["cell", "to"],
              properties: { cell: { type: "string" }, to: ref("NumExpr") },
            },
          },
          do: ref("Action"),
        },
      },
      fieldPath: { type: "string", enum: [...ALLOWED_FIELDS] },
      rulePath: { type: "string", enum: [...ALLOWED_RULES] },
      move: { type: "string", enum: [...MOVES] },
      band: { type: "string", enum: [...BANDS] },
      NumExpr: {
        oneOf: [
          variant("op", { const: "const" }, ["value"], {
            value: {
              type: "integer",
              minimum: LIMITS.intMin,
              maximum: LIMITS.intMax,
            },
          }),
          variant("op", { const: "field" }, ["path"], {
            path: ref("fieldPath"),
          }),
          variant("op", { const: "mem" }, ["cell"], {
            cell: { type: "string" },
          }),
          variant("op", { const: "rule" }, ["path"], { path: ref("rulePath") }),
          variant("op", { enum: ["add", "mul", "min", "max"] }, ["args"], {
            args: { type: "array", minItems: 1, items: ref("NumExpr") },
          }),
          variant("op", { enum: ["sub", "div"] }, ["args"], {
            args: {
              type: "array",
              minItems: 2,
              maxItems: 2,
              items: ref("NumExpr"),
            },
          }),
          variant("op", { enum: ["neg", "abs"] }, ["arg"], {
            arg: ref("NumExpr"),
          }),
        ],
      },
      BoolExpr: {
        oneOf: [
          variant(
            "op",
            { enum: ["gt", "lt", "gte", "lte", "eq", "neq"] },
            ["args"],
            {
              args: {
                type: "array",
                minItems: 2,
                maxItems: 2,
                items: ref("NumExpr"),
              },
            },
          ),
          variant("op", { enum: ["and", "or"] }, ["args"], {
            args: { type: "array", minItems: 1, items: ref("BoolExpr") },
          }),
          variant("op", { const: "not" }, ["arg"], { arg: ref("BoolExpr") }),
        ],
      },
      Action: {
        oneOf: [
          variant("type", { const: "idle" }, [], {}),
          variant("type", { const: "move" }, ["dir"], { dir }),
          variant("type", { const: "block" }, ["band"], { band: ref("band") }),
          variant("type", { const: "crouch" }, [], {}),
          variant("type", { const: "jump" }, ["dir"], { dir }),
          variant("type", { const: "attack" }, ["move", "band"], {
            move: ref("move"),
            band: ref("band"),
          }),
          variant("type", { const: "sweep" }, [], {}),
          variant("type", { const: "throw" }, [], {}),
          variant("type", { const: "throw-break" }, [], {}),
        ],
      },
    },
  };
}

const jsonSchemaSection = (): string =>
  [
    "## JSON Schema",
    "",
    "A draft-07 JSON Schema for the bot document — a permissive structural",
    "over-approximation of the validator (enum membership sourced from the same",
    "allowlists above). It enforces shape, the allowlists, and expression arities,",
    "but CANNOT encode the node budget, max nesting depth, the byte cap, or",
    "declared-before-use cells — the `validate()` gate remains the authority.",
    "",
    "```json",
    JSON.stringify(botDocSchema(), null, 2),
    "```",
  ].join("\n");

// The strategic primer — how to WIN, not merely pass validation. Unlike the
// factual sections this is hand-authored prose, but EVERY number is interpolated
// from `rules` (just like the frame table), so a `CANONICAL_RULES` retune updates
// the strategy text and it can never cite a stale constant. Each claim is one
// line so its concept and its value stay paired.
const primerSection = (rules: Rules, match: Match): string => {
  const cv = (n: number): string => code(String(n)); // code-spanned value
  const lPos = rules.perception?.lPos ?? 0;
  const lAct = rules.perception?.lAct ?? 0;
  const jitter = rules.perception?.jitter ?? 0;
  const st = rules.stamina ?? { max: 0 };

  const reach = (id: keyof Rules["moves"]): number =>
    rules.moves[id]?.reach ?? 0;

  return [
    "## Strategy primer",
    "",
    "How to WIN, not merely pass validation. Every number here is read from the",
    "frame table above, so a rules retune updates this prose.",
    "",
    `- **Perception (the master inequality).** Positional fields lag \`lPos\` = ${cv(lPos)} tick(s); the action tell (\`opponent.attacking\` / \`attackBand\` / \`throwing\` / \`knockdown\`) lags \`lAct\` = ${cv(lAct)}. A committed move is **reactable iff** its startup \`S ≥ lAct + 1\` = ${cv(lAct + 1)} (the \`+1\` is the structural observe-after-commit tick); ±${cv(jitter)} seeded jitter swings the knife-edge.`,
    `- **The triangle \`strike > throw > guard\`.** A strike stuffs a throw; a throw beats a guard (it is **unbanded** — guarding cannot stop it); a guard beats a strike at the **matching band**. Reach orders the options close-to-far: throw ${cv(rules.throw?.reach ?? 0)} < sweep ${cv(reach("sweep"))} < jab ${cv(reach("kizami-zuki"))} < reverse ${cv(reach("gyaku-zuki"))} < front ${cv(reach("mae-geri"))} < roundhouse ${cv(reach("mawashi-geri"))}.`,
    `- **Height & occupancy.** A \`crouch\` vacates the \`high\` band (a high strike whiffs a croucher); an airborne fighter vacates \`low\` once past \`lowClearance\` = ${cv(rules.lowClearance ?? 0)} (a sweep whiffs a well-timed jump). The arc is integer \`y += vy; vy -= gravity\` from \`jumpImpulse\` = ${cv(rules.jumpImpulse ?? 0)} / \`gravity\` = ${cv(rules.gravity ?? 0)}, and a DIRECTIONAL jump also travels \`jumpXSpeed\` = ${cv(rules.jumpXSpeed ?? 0)} horizontally (a jump-IN that closes distance). An \`air\` move (\`tobi-geri\`) is committed mid-jump — its active frames run alongside the arc, so time the leap to land the strike on the descending approach; a whiff drops into a punishable landing recovery.`,
    `- **Parry, counter, cancel.** A matching guard's first \`parryWindow\` = ${cv(rules.parryWindow ?? 0)} ticks **DEFLECT** (a parry: no score, +${cv(rules.parryRecovery ?? 0)} attacker recovery) rather than merely block — reaction-precise defense out-rewards a pre-emptive hold. A parry opens a \`counterWindow\` = ${cv(rules.counterWindow ?? 0)}-tick window worth +${cv(rules.counterBonus ?? 0)}. A strike that **CONNECTS** (hit or block) opens a \`cancelWindow\` = ${cv(rules.cancelWindow ?? 0)}-tick window to cancel recovery into a \`cancelInto\` follow-up (the rekka hit-confirm).`,
    `- **Okizeme (the knockdown game).** A throw or sweep knocks the foe **down** for \`knockdownDuration\` = ${cv(rules.knockdownDuration ?? 0)} ticks; the first \`finishWindow\` = ${cv(rules.finishWindow ?? 0)} are a guaranteed **FINISH** worth \`finishScore\` = ${cv(rules.finishScore ?? 0)} (ignoring band / guard / occupancy — the foe is prone); the rest are wake-up **i-frames**. Read the window live as \`self.finishWindow\`.`,
    `- **Stamina & gas.** Start at \`stamina.max\` = ${cv(st.max)}; an UNCOMMITTED fighter (neutral, not guarding) regens +${cv(st.regen ?? 0)}/tick. A guard bleeds \`blockChip\` = ${cv(st.blockChip ?? 0)} per contact tick (a fresh parry draws \`parryChip\` = ${cv(st.parryChip ?? 0)} once). At or below \`gasThreshold\` = ${cv(st.gasThreshold ?? 0)} a fighter is **GASSED**: every commit eats +${cv(st.gasRecoveryPenalty ?? 0)} recovery, and any move costing more than ${cv(st.gasThreshold ?? 0)} stamina (the kicks / throw / sweep) degrades to idle while the cheaper punches still commit — the emergent special-lockout. PACE your offense: spend only what regen can refill.`,
    `- **Play the match, not the scoreboard.** You are ranked by WKF **match win-rate**, not raw points: a fight ends at a ${cv(match.winGap)}-point lead, else on total points at the ${cv(MAX_TICKS)}-tick cap. Between scoring exchanges the ring resets to neutral (bodies reset; points / stamina / memory persist), so there is no okizeme farm — turn a lead into a decisive gap and hold it.${
      match.senshu
        ? ` A LEVEL bout is decided by **first blood** (${code("senshu")}): score first and you win the tie — read ${code("self.senshu")} / ${code("opponent.senshu")} to know who holds it, then protect your lead or bait a reset to steal it.`
        : ""
    }`,
    ...(match.jogai
      ? [
          `- **Stay in the ring (jogai).** The legal floor is bounded by an outer ${code("margin")} = ${cv(match.jogai.margin)} strip — cross into it and you ring OUT: a neutral reset, and after one free warning a point to your opponent each time. Watch ${code("self.x")} against the edge and don't over-retreat into a wall; track the shared warning ladder via ${code("self.penalties")} / ${code("opponent.penalties")}.`,
        ]
      : []),
    ...(match.passivity
      ? [
          `- **Don't stall (passivity).** Go ${cv(match.passivity.limit)} ticks without landing offense and you are fouled for non-engagement — same shared warning ladder as jogai. Watch ${code("self.passivityRemaining")} (ticks left before your foul; ${cv(0)} when unconfigured) and re-engage before it expires; a purely reactive turtle bleeds points. Read ${code("opponent.passivityRemaining")} to bait a stalling foe toward the same foul.`,
        ]
      : []),
    ...(match.overtime
      ? [
          `- **Sudden death (overtime).** A bout still LEVEL at the cap plays one sudden-death period of ${cv(match.overtime.ticks)} ticks — the first 1-point gap wins outright, decided BEFORE senshu. Watch ${code("clock.overtime")} (${cv(1)} once it starts, ${cv(0)} in regulation) and go ALL-IN — patience loses the tie, so press for the first clean score.`,
        ]
      : []),
  ].join("\n");
};

// Three curated example bots spanning the strategic axes (a poke, a reactive
// defender, a memory-driven cancel chain). Each is embedded VERBATIM from its
// `bots/*.json` fixture (a test re-validates the embedded text), so the spec
// only ever shows bots the engine actually accepts.
const EXAMPLE_BOTS: readonly { name: string; caption: string }[] = [
  {
    name: "jabber",
    caption:
      "the minimal poke — walk into jab range, then `kizami-zuki`; the leading `self.canAct == 0` rule is the commitment guard every bot needs.",
  },
  {
    name: "vulture",
    caption:
      "a reactive defender — break a read `throw`, punish a gassed foe with the roundhouse, else raise the guard matching the perceived `opponent.attackBand`.",
  },
  {
    name: "rekka",
    caption:
      "a memory-driven cancel chain — hit-confirm `kizami-zuki → gyaku-zuki → mawashi-geri` off `self.cancelWindow`, tracking progress in a `stage` memory cell.",
  },
];

// The committed (LF) content of a `bots/*.json` fixture. Normalized CRLF→LF so
// the embed is byte-identical across platforms (the fixtures are `i/lf w/crlf`
// on Windows; the generated `docs/spec.md` is pinned LF for the drift test).
const readExampleBot = (name: string): string =>
  readFileSync(
    fileURLToPath(new URL(`../../bots/${name}.json`, import.meta.url)),
    "utf8",
  )
    .replace(/\r\n/g, "\n")
    .trim();

const examplesSection = (): string =>
  [
    "## Example bots",
    "",
    "Three validated bots spanning the strategic axes. Copy the **shape**, not the",
    "numbers — read those via `rule(...)` so a bot survives a frame-table retune.",
    "",
    ...EXAMPLE_BOTS.flatMap(({ name, caption }) => [
      `### \`${name}\` — ${caption}`,
      "",
      "```json",
      readExampleBot(name),
      "```",
      "",
    ]),
  ]
    .join("\n")
    .trimEnd();

// How to actually enter the ring — the one submission fact the authoring spec needs:
// where to POST and the required attribution header. Static prose (cites no version /
// hash / manifest number, so a `BENCHMARK_VERSION` bump never touches it), placed last
// as the call-to-action once a bot is written. The handle is MANDATORY: every crowned
// King is attributed, and an LLM — which has no handle of its own — must ask the human
// running it rather than invent one. The exact length cap stays authoritative in the
// endpoint's own `400`, so this prose carries no drift-prone magic number.
const submitSection = (): string =>
  [
    "## Submitting",
    "",
    "Once your bot document is written, enter it in the ring with a single HTTP",
    "request to the same origin that served this spec:",
    "",
    "- **POST the JSON document** as the request body to `/fight`.",
    "- **Set the `X-Author-Handle` header — it is required.** This is the handle your",
    "  fighter is credited under on the ladder; keep it short and free of control",
    "  characters. If you are an LLM driving this, **ask the human** running you for",
    "  their handle — do not invent one.",
    "- **By default, a `/fight` is a practice run.** The response reports the fight's",
    "  outcome and a `projection` of where your bot would land in the arena — but it",
    "  changes nothing. Iterate as many times as you like; practice runs never touch the",
    "  standings.",
    "- **When your bot is good enough to compete, add the `X-Compete: true` header.** Only",
    "  then does a placing result count for real — taking a seat in the arena, or crowning",
    "  you if you top the reigning King.",
    "",
    "```sh",
    "# Practice (the default): iterate freely — nothing is recorded.",
    "curl -X POST <origin>/fight \\",
    '  -H "Content-Type: application/json" \\',
    '  -H "X-Author-Handle: <your-handle>" \\',
    "  --data-binary @mybot.json",
    "",
    "# Compete for the throne once you are happy with the bot.",
    "curl -X POST <origin>/fight \\",
    '  -H "Content-Type: application/json" \\',
    '  -H "X-Author-Handle: <your-handle>" \\',
    '  -H "X-Compete: true" \\',
    "  --data-binary @mybot.json",
    "```",
  ].join("\n");

/**
 * The committed `docs/spec.md` content — deterministic, drift-tested.
 * `rules` defaults to `CANONICAL_RULES` (the frozen platform table) and `match`
 * to the benchmark `MATCH` manifest; both are parameters only so the frame table,
 * primer, and benchmark section can be exercised against an alternate ruleset or a
 * retuned win gap (e.g. one omitting an optional move, or a different `winGap`).
 */
export function generateSpec(
  rules: Rules = CANONICAL_RULES,
  match: Match = MATCH,
): string {
  return (
    [
      header(),
      overviewSection(),
      limitsSection(),
      documentShapeSection(),
      expressionsSection(),
      stateReadsSection(rules),
      ruleReadsSection(),
      actionGrammarSection(),
      frameTableSection(rules),
      errorCatalogSection(),
      jsonSchemaSection(),
      primerSection(rules, match),
      examplesSection(),
      benchmarkSection(match),
      submitSection(),
    ].join("\n\n") + "\n"
  );
}
