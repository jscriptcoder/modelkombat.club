# Variety-telemetry harness — child stories

**Status:** story-splitting complete; **S1a, S2, and S3a each hardened via find-gaps**
(S1a 2026-07-12 → 12 examples; S2 + S3a 2026-07-13 → 8 examples each; see §Gaps closed);
**S3b resolved via a grill-me pass** (2026-07-13 → 9 examples, S3b-1…S3b-9).
Decisions locked in the sibling scoping doc `variety-telemetry-harness.md`
(§Resolved decisions). Feeds `planning`, one selected child story at a time.

**Shipped:** **S1a** (PRs #270–#272, archived) + **S1b** (PRs #273–#276, archived via
#277) + **S2** (PRs #278–#280, plan archived at `docs/archive/variety-telemetry-s2.md`) +
**S3a** (plan #282 / slice #283, plan archived at `docs/archive/variety-telemetry-s3a.md`)
are complete + live. The `telemetry` CLI now emits the pooled usage histogram, per-bot
adoption (k/N) + mean share, the effective-move-count diversity headline + live/dead
list, `--json`, a `-- <path…>` population override with fail-fast load, the **opener
win-rate table** with the sample-gated §P7 `⚠` flag — so **both** DESIGN §P7 balance
dials (usage > 35%, opener > 60%) are now measured — and the **per-move start-failure
rate** (`locked`-excluded, full per-reason split). **S3b** (distance/spacing-occupancy
histogram) is now **grilled + planned** (`plans/variety-telemetry-s3b.md`, one slice); the
distance bucketing — the roadmap's named blocker — resolved to **5 coarse reach tiers**.

## Parent

**Actor:** the roster designer (deciding whether to add / cut / buff a move — the
originating question of this whole thread).
**Capability:** run a command and get an evidence-based answer to a specific *balance*
question about the frozen roster, instead of guessing.
**Outcome:** move-roster changes (and the pre-launch "is our variety enough?" call)
become data-driven.
**Current constraint:** the "S1–S5" sketch is metric-additive; the first slice as
written bundles a new round-robin driver with four separate readouts, and the last
slice bundles three unrelated capabilities.

**Note on the actor.** Every slice below has the *same* actor and the same surface
(`npm run telemetry` → a report). They are still vertical capability slices, not
component tasks, because **each answers a distinct designer question** and is
independently demonstrable and independently valuable. This is Path/Rules-dimension
slicing ("which question can stand alone first"), not "build the backend / build the
frontend." The round-robin driver is a *task inside* the first story, not its own
story.

## Recommended first slice

**S1a — the designer sees the pooled move-usage meta of the reference population, with
dominant moves flagged and dead moves visible.** `npm run telemetry` runs the gauntlet
round-robin and prints a pooled usage histogram over the 13 techniques.

**Why this first:** it is the walking skeleton — a tracer bullet through the entire
real production path (load bots → validator gate → round-robin `runFight` *keeping
`events`* → pure reduce → stdout). It burns down the only real integration unknown (is
the "keep every fight's `events`" driver sane in time+memory?) in the smallest possible
whole, and it *already answers the originating question* — "is the arsenal broadly used
or collapsing, and is anything dead-on-arrival?" — at a crude but demonstrable level.
It is the bargain: ~1/5 of the harness cost, and if it shows a healthy, diverse meta
with no dead moves, **every later slice can be deferred past launch.** That
delete-a-follow-up property is why it leads.

## Split candidates

| Slice | Designer question it answers | Includes | Defers | Acceptance examples | Release |
|---|---|---|---|---|---|
| **S1a** *(first)* | "Is one move dominating? Is anything dead?" | Round-robin driver (keeps `events`); pooled usage histogram over 13 techniques; `⚠` on pooled share >35%; stdout | adoption, diversity scalar, json, opener | see below | internal CLI tool; shippable |
| **S1b** | "How broadly is the kit adopted, and how much of the arsenal is live?" | Per-bot adoption column; effective-move-count headline + live/dead list; `--json`; population override arg (`-- bots/*.json`) | — | see below | internal CLI; shippable |
| **S2** | "Does any *opener* over-win?" | Opener = first honoured commitment → fight outcome; per-opener win-rate; `⚠` on >60%; null-opener count | — | see below | internal CLI; shippable |
| **S3a** | "Which moves are *chosen but keep failing to execute*?" | Per-move **start-failure rate** (`locked`-excluded: gate-failed starts / start attempts) + full per-reason split | — | see below (hardened via find-gaps 2026-07-13, S3a-1…S3a-8) | internal CLI; shippable |
| **S3b** | "Which reach zones do fights actually happen in?" | Inter-fighter distance occupancy histogram over 5 coarse reach tiers (clinch/hand/kick/poke/out) | — | see below (resolved via grill-me 2026-07-13, S3b-1…S3b-9) | internal CLI; shippable |
| **S4** | "Which moves actually *score* vs whiff (effectiveness, not just choice)?" | Scoring attribution: `points[t]` delta → most-recent honoured commitment in its `startup+active` window; whiff-vs-land + points-per-move | — | Given a scoring exchange, Then the point is attributed to the committing move; rekka-chain disambiguation covered | internal CLI; shippable — *modeling nuance, grill first* |
| **S5a** | "What does the *live* meta look like?" (post-launch) | *Mostly enabled by S1b's override arg* — point the CLI at a submission dir. Real content = having submissions | — | Given a dir of submitted bots, Then the same report runs over them | internal; **valuable only post-launch** |
| **S5b** | "Can the team review a versioned variety snapshot?" | Committed `docs/variety-<version>.md` board (like `docs/benchmark-gauntlet-v19.md`) | — | Given `npm run telemetry`, Then a committed board regenerates deterministically | repo artifact; shippable once metrics stable |
| **S5c** | "Can the community see the meta?" | Public web meta-report surface | — | (defer — separate UX surface) | public; far-future |

### S1a — acceptance examples

- **S1a-1 (histogram + share).** Given the 6 frozen gauntlet bots + `CANONICAL_RULES` +
  `SEEDS`, When I run `npm run telemetry`, Then it prints a pooled usage histogram over
  the 13 techniques, each row showing the **raw honoured-commitment count** and a
  **share** = `count / totalCommitments`, where `totalCommitments` is every honoured
  commitment (all 13 techniques, both fighters) across every distinct-pair,
  both-sides, all-seeds round-robin fight (self-mirrors skipped via `sameDoc`).
- **S1a-2 (share precision + sum invariant).** Given the histogram, Then each share is
  displayed to **1 decimal place** (matching `benchmark.ts`'s `.toFixed(1)`), and the
  **raw fractional shares sum to exactly 1.0** by construction (*when
  `totalCommitments > 0`* — the zero-total case is S1a-4) — the invariant is asserted on
  the raw shares, NOT the rounded display (which may read 99.9%/100.1%).
- **S1a-3 (dead technique).** Given a technique no gauntlet bot ever commits, When the
  report renders, Then it appears with a **0 count / 0.0% share** (a visible
  dead-on-arrival candidate), never omitted.
- **S1a-4 (zero-total degenerate).** Given a population that commits *no* techniques at
  all (`totalCommitments == 0`), When the report renders, Then every share is `0.0%`
  and the effective-move-count reads `n/a` — no `÷0` NaN or crash. (Never occurs for the
  frozen gauntlet; a required guard for the override population and for test fixtures.)
- **S1a-5 (dominance flag).** Given a move whose **raw** pooled share is **strictly
  greater than** a named `USAGE_FLAG_THRESHOLD` (= `0.35`, tracking `DESIGN §P7`'s ~35%
  target; a move at exactly 35.0% is not flagged), Then its row is flagged `⚠` and the
  process still **exits 0** (no gate — grill #8). The threshold is a single named
  constant, not a magic literal, so it can be retuned as §P7 evolves.
- **S1a-8 (flag legend).** Given the report contains at least one `⚠`, Then a one-line
  legend explains it — e.g. *"⚠ = exceeds the §P7 ~35% usage soft target (informational,
  not a failure)"* — so the glyph is never unexplained. *(Microcopy — reword freely.)*
- **S1a-9 (degraded picks excluded).** Given a move a bot repeatedly *chooses* but that
  always degrades (`degrade !== null` — an out-of-band or unaffordable pick), Then it
  contributes **0** to the usage histogram: only honoured commitments count (grill #1).
  So a chosen-but-non-executing move reads as "unused" here — the chosen-vs-honoured gap
  is **S3a's** concern, cross-referenced in the report so a `0` isn't misread as "never
  attempted."
- **S1a-10 (provenance header).** Given any run, Then the report opens with a header
  carrying `BENCHMARK_VERSION`, the population (names / count), seed count, total fights,
  and **`totalCommitments`** — mirroring `benchmark.ts`'s header — so a reader knows
  exactly what population and version the numbers describe (also satisfies N-a).
- **S1a-11 (small-sample caveat).** Given the population size is below a named
  `SMALL_POPULATION` threshold (default set to include the 6-bot gauntlet), Then the
  header prints a caveat noting the figures reflect a small hand-authored *reference*
  population, not discovered LLM behavior (per §Warnings). A larger post-launch corpus
  above the threshold omits it.
- **S1a-12 (CLI contract).** Given S1a runs over the fixed committed gauntlet (no user
  path args), Then: `exit 0` on a produced report; a bot that fails to load/validate at
  startup crashes **loudly to stderr with a non-zero exit** (the gauntlet is
  pre-validated, so a failure is a build/repo bug — mirrors `benchmark.ts`'s startup
  load; never silently run over a shrunken population). Invalid-user-bot / arbitrary-path
  error handling is **deferred to S1b**, where paths are first accepted.
- **S1a-6 (determinism).** Given fixed seeds + rules, When I run it twice, Then the
  output is byte-identical (a pure reduction over `runFight`, which changes no scoring
  input ⇒ no `INPUT_HASH`/version impact).
- **S1a-7 (row order).** Given the histogram, Then rows are sorted by **share
  descending**, ties broken by the **canonical frame-table order** (`sweep`,
  `kizami-zuki`, `gyaku-zuki`, `mae-geri`, `mawashi-geri`, `uraken`, `shuto`,
  `yoko-geri`, `ushiro-geri`, `empi`, `hiza-geri`, `tobi-geri`, `throw`) — so dominant
  moves and the `⚠` surface at the top while equal-share / 0-count rows hold a stable,
  reproducible slot (the determinism in S1a-6 depends on this total order).

### S1b — acceptance examples

- Given the round-robin, Then each technique also shows **adoption** (`k/N` bots that
  ever commit it), and the report headlines **effective-move-count** (`exp(Shannon)` of
  the pooled dist) plus `# live` / `# dead` + the dead list.
- Given `--json`, Then the raw `VarietyReport` (histogram + adoption + diversity) is
  emitted to stdout instead of the table.
- Given `npm run telemetry -- bots/*.json`, Then the population widens to all supplied
  bots (the richer pre-launch dead-move read across all 15 example bots).

### S2 — acceptance examples

_Hardened via find-gaps (2026-07-13) — 3 loose bullets → testable examples. Opener
design locked in scoping decision #5; these pin the win-rate base, low-N handling,
render, and `--json`._

- **S2-1 (opener → outcome join).** Given the round-robin, When a fight runs, Then each
  fighter's **opener** = its FIRST honoured technique commitment in that fight
  (`honouredTechnique` over the same 13-technique key space as S1 — opening with `throw`
  or `sweep` is valid), joined to THAT fighter's fight outcome from `FightResult.winner`
  (`"A"|"B"|"draw"` → win / loss / draw for the side that fighter played). Each fight
  yields up to **2 opener observations** (one per fighter, both orderings), over the
  distinct-pair both-sides all-seeds round-robin (self-mirrors already skipped via
  `sameDoc`).
- **S2-2 (win-rate base — draws in the denominator).** Given per-opener tallies, Then
  each opener's **win-rate = wins / opens**, where `opens = wins + losses + draws` (all
  observations that opened with that move). A **draw is never a win** but stays in the
  denominator (dragging the rate below 0.5 for an even opener), matching `benchmark.ts`'s
  `wins/bouts` convention. Wins, losses, and **draws are each shown as their own column**
  alongside the rate, so a reader can see the split behind the percentage.
- **S2-3 (dominance flag — sample-gated).** Given an opener whose **raw** win-rate is
  **strictly greater than** a named `OPENER_FLAG_THRESHOLD` (= `0.60`, tracking
  `DESIGN §P7`'s ~60% target; exactly 60.0% is NOT flagged — mirrors S1a's strict-`>`
  `USAGE_FLAG_THRESHOLD`) **AND** whose `opens ≥ MIN_OPENER_SAMPLE` (a named constant,
  default ~10, retunable), Then its row is flagged `⚠` and the process still **exits 0**
  (no gate — decision #8). An opener above 60% but below the sample floor shows its N +
  win% but earns **no** `⚠` (kills the 1-open-100% false alarm over the 6-bot reference
  population). A one-line legend explains the glyph (mirrors S1a-8). Both `⚠` thresholds
  are single named constants, not magic literals.
- **S2-4 (null opener).** Given a fighter that never honours a technique in a fight
  (pure turtle), Then that (fighter, fight) observation contributes a **null opener** —
  excluded from every opener's win-rate, and surfaced as a **null-opener count** at the
  same (fighter, fight) granularity as the opener observations (never silently dropped,
  so a reader sees how much of the field turtled).
- **S2-5 (render + row order).** Given the report, Then the opener win-rates render as a
  **second section** beneath the S1 usage histogram in the same `telemetry` report (one
  report, additive readout — per the split's anti-salami guard), with columns
  `opener · opens · W · L · D · win% · ⚠`. Rows are sorted by **win-rate descending**,
  ties broken by **opens descending** (better-sampled first), then the **canonical
  frame-table order** (the same total order as S1a-7) — so the highest (potentially
  oppressive) openers surface at top while equal rows hold a stable, reproducible slot
  (the determinism inherited from S1a-6 depends on this total order).
- **S2-6 (zero-open guard + all-13).** Given a technique that **no** fighter ever opens
  with (`opens == 0`, a `0/0` rate), Then it still appears — opens `0`, W/L/D `0`, win%
  rendered as `—` (the ÷0 guard, mirroring S1a-4's `n/a`) — never omitted (mirrors
  S1a-3), so "dead as an opener" (a move nobody ever leads with) is a visible design
  datum. The opener table thus always lists all 13 techniques. Under S2-5's win%-desc
  order these `—` (0-open) rows sort **to the bottom** (an undefined rate ranks below
  every numeric win%), broken among themselves by canonical order — so real openers
  always lead and dead openers cluster at the tail.
- **S2-7 (`--json` additive).** Given `--json`, Then the opener data rides in the SAME
  versioned envelope S1b shipped (`{version, population, report}`) as **additive fields
  on `VarietyReport`** (`openers: OpenerRow[]` + a `nullOpeners` count) — no new
  top-level key, no envelope reshape. The envelope `version` (= `BENCHMARK_VERSION`)
  is **unchanged**: S2 is a pure read-only reduction (no scoring-input touch ⇒ the
  invariant forbids a version bump), and an added field is a non-breaking JSON change
  (cli-design) — a consumer pinned to the S1b shape still parses; a new one reads
  `report.openers`. `--json` round-trips (`JSON.parse` re-`toEqual`s `runVariety()`),
  mirroring the S1b Slice-3 test.
- **S2-8 (determinism, inherited).** Given fixed seeds + rules, When run twice, Then the
  opener section is byte-identical — a pure reduction over `runFight` (no `INPUT_HASH` /
  `BENCHMARK_VERSION` impact), the same non-negotiable as S1a-6, depending on the S2-5
  total row order.

### S3a — acceptance examples

_Hardened via find-gaps (2026-07-13) — 1 loose bullet → 8 testable examples. The
metric definition was the only real Blocker (`locked` semantics); the rest mirror the
S1a/S2 render + edge-case shape. Grounded in `sim.ts:70` (the 5 `DegradeReason`s) +
`sim.ts:1321` (every frame records the bot's RETURNED action + honour result)._

- **S3a-1 (metric — start-failure rate, `locked` excluded).** Given the round-robin,
  Then for each technique X: `startAttempts(X)` = frames where a fighter chose X and the
  frame was **honoured** (`degrade === null`) **or** degraded with reason ∈
  {`out-of-band`, `unaffordable`, `wrong-context`, `inert`}; `failedStarts(X)` = those
  four-reason frames; **`degradeRate(X) = failedStarts(X) / startAttempts(X)`**. A
  **`locked`** frame is dropped from BOTH numerator and denominator — it is a busy
  fighter's ignored input while committed to an already-honoured move (`sim.ts:512-513`),
  not a failed pick, so counting it would make every slow-but-fine move read ~100%
  degraded. The rate answers *"when a neutral fighter tries to START X, how often does it
  bounce off a legality/affordability gate?"* (matches scoping Metric 5's
  "out-of-band / unaffordable" framing; the still-open S4 window/rekka grill does not
  touch S3a — degrade is a per-frame fact, no reconstruction needed).
- **S3a-2 (render — per-reason columns, third section).** Given the report, Then the
  degrade-rate renders as a **third section** beneath the S1 usage histogram and the S2
  opener table in the same `telemetry` report (one report, additive readout — the
  anti-salami guard), with columns `move · N · fail · rate% · out-of-band ·
  unaffordable · wrong-context · inert`, where `N` = `startAttempts`, `fail` =
  `failedStarts`, and the four reason columns are the per-reason `failedStarts` counts
  (which **sum to `fail`**). Rate is shown to **1 decimal place** (matching S1a /
  `benchmark.ts` `.toFixed(1)`). All four reason columns are ALWAYS present — a `0`
  column is a visible datum (like a dead move, S1a-3), and the override population
  (`-- bots/*.json`) or a future bot can make `wrong-context` / `inert` nonzero (both are
  structurally ~0 for validated bots on `CANONICAL_RULES`, but the report must be
  population-stable). *(Exact column widths/spacing pinned by the render tests, S1b-style,
  not pre-specified here.)*
- **S3a-3 (zero-guard — never-attempted moves).** Given a technique with `startAttempts
  == 0` (never chosen as a neutral start — either never picked, or only ever emitted
  while `locked`), Then it still appears (all 13 always listed, mirroring S1a-3 / S2-6) —
  `N` `0`, `fail` `0`, every reason count `0`, and `rate` rendered **`—`** (the ÷0 guard,
  mirroring S1a-4's `n/a` and S2-6's `—`) — never omitted, so "never even attempted" is a
  visible datum.
- **S3a-4 (sort + row order).** Given the report, Then rows sort by **`rate` descending**
  (hardest-to-execute moves at the top), ties broken by **`N` (startAttempts) descending**
  (better-sampled first), then the **canonical frame-table order** (the same total order
  as S1a-7). The **`—` (zero-attempt) rows sort to the bottom** (an undefined rate ranks
  below every numeric rate, mirroring S2-6), broken among themselves by canonical order —
  so real degraders lead and never-attempted moves cluster at the tail. This total order
  is what the S3a-8 byte-identical determinism depends on.
- **S3a-5 (chosen-but-always-fails ↔ S1a cross-ref).** Given a move a bot chooses
  repeatedly that **always** gate-fails (`honoured(X) == 0`, `failedStarts(X) > 0`), Then
  it reads **`rate 100.0%`, `N = failedStarts`** in this section while contributing **`0`**
  to the S1a usage histogram (0 honoured commitments). Because **`honoured(X)` here IS the
  S1a usage count** (`attempts = usage-count + failedStarts`), the two sections reconcile
  numerically. This is the payoff of the S1a-9 cross-reference: a usage `0` means
  "attempted but never executed," and THIS section says *which gate* — so a usage-`0` is
  never misread as "never attempted." The report cross-references the two.
- **S3a-6 (no flag — diagnostic only).** Given any run, Then unlike S1a (usage > 35%) and
  S2 (opener > 60%), the degrade-rate carries **no §P7 dial and no `⚠` flag** — it is a
  purely diagnostic usability readout (high degrade-rate is a "hard to use / mis-targeted"
  signal for the roster designer or bot author, not a balance breach). The process
  **exits 0**, prints **no legend**, and applies **no sample gate** — a low-`N` high rate
  is self-caveating via the visible `N` column plus the header's global small-sample
  caveat (contrast S2-3's gated flag, which needed `MIN_OPENER_SAMPLE` only because it
  drove a `⚠`).
- **S3a-7 (`--json` additive).** Given `--json`, Then the degrade data rides in the SAME
  versioned envelope S1b shipped (`{version, population, report}`) as **additive fields on
  `VarietyReport`** (`degrades: DegradeRow[]`) — no new top-level key, no envelope
  reshape. The envelope `version` (= `BENCHMARK_VERSION`) is **unchanged** (S3a is a pure
  read-only reduction — no scoring-input touch ⇒ the invariant forbids a bump; an added
  field is a non-breaking JSON change per cli-design). `--json` round-trips
  (`JSON.parse(stdout).report` `toEqual` `runVariety()`), mirroring S1b Slice 3 / S2-7.
- **S3a-8 (determinism, inherited).** Given fixed seeds + rules, When run twice, Then the
  degrade section is byte-identical — a pure reduction over `runFight` reading only
  `.action` + `.degrade` (both already emitted; `benchmark.ts` already walks `.degrade`),
  no `INPUT_HASH` / `BENCHMARK_VERSION` impact — the same non-negotiable as S1a-6 / S2-8,
  depending on the S3a-4 total row order.

### S3b — acceptance examples

_Resolved via a grill-me pass (2026-07-13) — the roadmap's named pre-plan blocker (distance
bucketing) plus the render + edge-case shape (1 loose table bullet → 9 testable examples).
Grounded in the engine: distance = `|a.x − b.x|` (the sim's own horizontal reach gate,
`sim.ts:745`); `x` is on every `FighterFrame`, pushed every tick (`sim.ts:1322`, dense);
`ring.width = 600000`, `startGap = 300000` (`rules.ts:29-30`). The bot API exposes no named
distance zones (`opponent.distance` is a raw sub-unit int), so the tiers are S3b's own,
keyed to the reach ladder._

- **S3b-1 (metric — per-tick reach-tier occupancy).** Given the round-robin, Then for each
  tick of each fight the inter-fighter distance `d = |a.x − b.x|` is placed in one of 5
  half-open **reach tiers**: `clinch [0,120k)`, `hand [120k,240k)`, `kick [240k,300k)`,
  `poke [300k,330k)`, `out [330k,600k]`. `occupancy(zone) = framesIn(zone) / totalFrames`.
  Distance is **symmetric ⇒ exactly ONE sample per tick** (NOT per-fighter like
  usage/openers/degrades, which count `[a, b]`), so `totalFrames = Σ ticks over all fights`
  and the denominator is total ticks, **never 2×**. **All frames counted, no exclusions**
  (yame-reset re-approach and okizeme clinch are genuine spacing — grill-resolved). The
  boundaries are reach-ladder breakpoints: throw-floor 120k, reverse-punch 240k,
  roundhouse/startGap 300k, longest-reach (ushiro) 330k.
- **S3b-2 (render — fourth section, natural distance order).** Given the report, Then the
  occupancy histogram renders as a **fourth section** beneath usage (S1) / opener (S2) /
  degrade (S3a) in the same `telemetry` report (one report, additive readout — the
  anti-salami guard), with columns `zone · distance · frames · share%`. Rows are in **fixed
  natural distance order** (clinch → hand → kick → poke → out), **NOT** share-descending —
  the distance axis is intrinsically ordered, so the reader sees the spatial distribution
  shape (where mass concentrates, whether the poke tail is empty). Share to **1 decimal
  place** (matching S1a / `benchmark.ts` `.toFixed(1)`). All 5 tiers always present. *(Exact
  column widths / any static in-range-move annotation pinned by the render tests + CONFIRM,
  S3a-2-style, not pre-specified here.)*
- **S3b-3 (zero-guard — empty zone).** Given a tier that no tick occupies (e.g. the poke
  range never entered — exactly the motivating "is the >300k poke zone ever occupied?"),
  Then it still appears with `frames 0`, `share 0.0%`, never omitted (a visible
  "spacing-dead zone" datum, mirroring S1a-3's dead move) — so an unoccupied reach niche is
  a first-class reading.
- **S3b-4 (zero-total guard).** Given a population that produces no frames at all
  (`totalFrames == 0` — an empty population / no fights), Then every tier's share is `n/a`
  (the ÷0 guard, mirroring S1a-4's `n/a`). Never occurs for the frozen gauntlet; a required
  guard for the override population and test fixtures.
- **S3b-5 (partition sum invariant).** Given `totalFrames > 0`, Then the 5 **raw** shares
  **sum to exactly 1.0** by construction — every tick lands in exactly one tier (the
  half-open tiers are contiguous and exhaustive over `[0, ring.width]`: no gap, no overlap).
  Asserted on the raw shares, NOT the rounded display (which may read 99.9%/100.1%),
  mirroring S1a-2.
- **S3b-6 (boundary convention).** Given a distance exactly on a tier boundary, Then the
  half-open `[lo,hi)` rule places it in the **higher** tier (a gap of exactly `120000` is
  `hand`, not `clinch`), and the ring ceiling (`d == 600000`, fighters at opposite walls)
  lands in the top `out` tier (inclusive of the max) — so no tick is lost or double-counted
  at a seam. These exact placements are what pin the `<`-vs-`<=` boundary mutants.
- **S3b-7 (no flag — diagnostic only).** Given any run, Then — like S3a and unlike S1a
  (>35%) / S2 (>60%) — the occupancy histogram carries **no §P7 dial and no `⚠`**: it is
  purely diagnostic (spacing is descriptive; there is no balance target for where fights
  happen). The process **exits 0**, prints **no legend**, applies **no sample gate** — a
  low-`totalFrames` reading self-caveats via the visible `frames` column plus the header's
  global small-sample caveat (S1a-11).
- **S3b-8 (`--json` additive).** Given `--json`, Then the occupancy data rides in the SAME
  versioned envelope S1b shipped (`{version, population, report}`) as an **additive field on
  `VarietyReport`** (`occupancy: OccupancyRow[]`) — no new top-level key, no envelope
  reshape. The envelope `version` (= `BENCHMARK_VERSION`) is **unchanged** (S3b is a pure
  read-only reduction — no scoring-input touch ⇒ the invariant forbids a bump; an added
  field is a non-breaking JSON change per cli-design). `--json` round-trips
  (`JSON.parse(stdout).report` `toEqual` `runVariety()`), mirroring S1b Slice 3 / S2-7 /
  S3a-7.
- **S3b-9 (determinism, inherited).** Given fixed seeds + rules, When run twice, Then the
  occupancy section is byte-identical — a pure reduction over `runFight` reading only `.x`
  (already emitted every tick), no `INPUT_HASH` / `BENCHMARK_VERSION` impact — the same
  non-negotiable as S1a-6 / S2-8 / S3a-8, depending on the S3b-2 fixed row order.

## Parking lot

- **S5a is (mostly) not a build.** Grill decision #6 already puts a population
  path/glob override in the CLI (landing in S1b). "Ingest a submission corpus" is then
  just *using* that override on a submissions directory — enabled by construction, its
  only real dependency is having post-launch submissions. Tracked, not a build story.
- **Override-arg placement.** Parked in S1b (it rides with the richer read). If a
  pre-launch `bots/*.json` dead-move sweep is wanted sooner, it can move up to S1a
  cheaply — a planning call.
- **S3a + S3b are separable** (degrade vs spacing) and kept apart deliberately —
  distinct questions, either can be dropped. The scoping doc bundled them as "S3."
- **Still-open grills (from scoping):** S4's commitment-reconstruction window + rekka
  disambiguation. (S3b's distance bucketing — RESOLVED via grill-me 2026-07-13: 5 coarse
  reach tiers; see §S3b acceptance examples.) Grill S4 when its story is planned.

## Warnings

- **Salami-slice smell — addressed.** Every slice adds a readout to the same
  `telemetry` report, which can *look* like component-additive slicing. It is not: each
  answers a distinct, independently-valuable designer question and is independently
  demonstrable. Guard against a planner collapsing them into "just build the whole
  report" — the value of shipping S1a alone is the early integration burn-down + the
  possible-delete-everything-else bargain.
- **Small-sample caveat on every reading.** The default population is 6 hand-authored
  bots, so all shares/opener-rates are low-N and partly reflect the *reference* roster's
  authored style, not discovered LLM behavior. This is *why* there is no CI gate (grill
  #8) and why S5a (real submissions) is where the numbers get trustworthy. State this
  caveat in the report header itself.
- **No release/deploy risk.** S1a–S4 are an internal CLI importing the engine directly
  — no Vercel surface, no `CANONICAL_RULES` touch, no version bump. S5c (web) is the
  only slice that crosses into a public surface and should be re-split then.

## Gaps closed — find-gaps session, 2026-07-12

Focus: **S1a** acceptance examples (4 loose → 12 testable). All Blockers +
Should-addresses closed; both Nice-to-haves folded in; nothing parked.

```
[Blocker → S1a-1/2/4]  Share denominator, 1dp precision, sum-invariant on raw
                       shares (guarded for totalCommitments>0), zero-total ÷0 case
[Blocker → S1a-7]      Row order: share desc, tie-break canonical frame-table order
                       (fixes the byte-identical determinism test + equal-share ties)
[Blocker → S1a-5/8]    ⚠ threshold: strict >, named USAGE_FLAG_THRESHOLD, printed legend
[Should  → S1a-9]      Degraded picks excluded (0 usage) + cross-ref to S3a
[Should  → S1a-10]     Provenance header (version/pop/seeds/fights/totalCommitments)
[Should  → S1a-11]     Small-sample caveat when population < SMALL_POPULATION
[Should  → S1a-12]     CLI contract: exit 0 / fail-fast non-zero; user-bot errors → S1b
[Nice    → S1a-10]     Total-commitment count shown (folded into the header)
[Nice    → S1a-7]      Equal-share tie-break (folded into row order)
```

Contradiction caught + fixed during recap: S1a-2's sum-to-1.0 invariant vs S1a-4's
zero-total all-0.0 → invariant now guarded with `when totalCommitments > 0`.

## Gaps closed — find-gaps session, 2026-07-13

Focus: **S2** acceptance examples (3 loose → 8 testable, S2-1…S2-8). Opener *design* was
already locked in scoping decision #5, so the gaps were presentation + edge-case +
measurability. All closed; two S1a mirrors folded; nothing parked.

```
[Should → S2-2]      Win-rate base: wins/opens, draws IN the denominator + own column
                     (matches benchmark.ts wins/bouts; sets what ">60%" measures)
[Should → S2-3]      Low-N false-alarm: show N always, ⚠ gated on opens ≥ MIN_OPENER_SAMPLE
[Should → S2-5/6]    Render: 2nd section, cols, sort win%↓→opens↓→canonical; all 13,
                     0-open "—" sinks to the bottom (÷0 guard)
[Should → S2-7]      --json additive (openers + nullOpeners on VarietyReport); envelope
                     version unchanged (invariant forbids a bump; additive is non-breaking)
[Mirror→ S2-1/3]     OPENER_FLAG_THRESHOLD strict > + legend (S1a-8); 13-technique keys (S1a)
[Inherit→ S2-8]      Determinism byte-identical (S1a-6), depends on the S2-5 total order
```

Consistency check passed: the N-gate (S2-3) and win%↓ sort (S2-5) interact cleanly — a
high-win% low-N opener floats up but wears no `⚠`; its `opens` column tells the story.

## Gaps closed — find-gaps session, 2026-07-13 (S3a)

Focus: **S3a** acceptance examples (1 loose bullet → 8 testable, S3a-1…S3a-8). The metric
definition was the sole real Blocker; the rest are S1a/S2 render + edge-case mirrors.
Grounded in the engine (`sim.ts:70` — the 5 `DegradeReason`s; `sim.ts:1321` — the frame
records the RETURNED action + honour result). All closed; nothing parked.

```
[Blocker → S3a-1]   Metric: which reasons = failure + the denominator. Resolved:
                    start-failure rate = {oob,unaff,wctx,inert} / (honoured + those);
                    LOCKED EXCLUDED from num AND denom (busy-fighter artifact, not a
                    failed pick — else every slow-but-fine move reads ~100%)
[Should → S3a-2]    Reason split: FULL per-reason counts (4 columns), third section
                    (out-of-band vs unaffordable ⇒ different remedies, Metric 5)
[Should → S3a-3]    Zero-guard: startAttempts==0 → all-0 row, rate "—", all 13 listed
[Should → S3a-4]    Sort: rate↓ → N↓ → canonical; "—" (0-attempt) rows sink to bottom
[Should → S3a-5]    S1a cross-ref: honoured(X) IS the usage count; always-fail move =
                    100% here / 0 in usage → a usage-0 means "attempted, never executed"
[Should → S3a-7]    --json additive (degrades on VarietyReport); envelope version unchanged
[Nice   → S3a-6]    No ⚠ flag — diagnostic only, no §P7 dial, no sample gate, exit 0
[Inherit→ S3a-8]    Determinism byte-identical (S1a-6), depends on the S3a-4 total order
```

Consistency check passed: S3a-1's `locked` exclusion and S3a-5's cross-ref agree — the
denominator (`honoured + failedStarts`, no `locked`) makes `honoured(X)` exactly S1a's
usage count, so the two sections reconcile as `attempts = usage + failedStarts`. No `⚠`
(S3a-6) means no `MIN_*` sample gate is needed (contrast S2-3), so low-N is handled by the
visible `N` column alone.

## Gaps closed — grill session, 2026-07-13 (S3b)

Focus: **S3b** distance bucketing — the roadmap's named pre-plan blocker — plus the render
+ edge-case shape (1 loose table bullet → 9 testable examples, S3b-1…S3b-9). Grounded in
the engine (distance = `|a.x − b.x|`, the sim's own reach gate `sim.ts:745`; `x` dense on
every frame `sim.ts:1322`; `ring.width 600k` / `startGap 300k`). The bot API exposes NO
named distance zones (`opponent.distance` is a raw int), so the tiers are S3b's invention,
keyed to the reach ladder. All forks resolved; nothing parked.

```
[Blocker  → S3b-1]   Bucket scheme: 5 COARSE reach tiers (not 14 fine rungs, not
                     fixed-width) at 120k/240k/300k/330k — readable + isolates the >300k
                     poke zone. Rejected: fine rungs (noisy, fiddly labels), per-technique
                     cumulative (not a partition), fixed-width (loses the ladder meaning)
[Resolved → S3b-1]   Frame inclusion: ALL frames, no exclusions (reset re-approach +
                     okizeme clinch are real spacing; no per-frame 'invalid' signal exists)
[Resolved → S3b-1]   Sample: ONE distance per TICK (symmetric) ⇒ denom = total ticks, NOT
                     2× — the key divergence from usage/opener/degrade (which count [a,b])
[Resolved → S3b-2]   Row order: FIXED natural distance order (clinch→out), NOT share-desc —
                     the axis is intrinsically ordered (a divergence from S1a/S2/S3a)
[Resolved → S3b-7]   No ⚠ flag — diagnostic only (mirror S3a): no §P7 dial, no legend, no
                     sample gate, exit 0
[Mirror   → 3/4/5/6] Zero-zone 0.0% (S1a-3), zero-total n/a (S1a-4), partition sums to 1.0
                     (S1a-2), half-open [lo,hi) boundary + ceiling → top tier
[Mirror   → S3b-8/9] --json additive (occupancy on VarietyReport, version unchanged);
                     determinism byte-identical, depends on the S3b-2 fixed order
```

Consistency check passed: the partition (S3b-5) + half-open boundary (S3b-6) agree —
contiguous exhaustive tiers over `[0, 600k]` mean every tick lands in exactly one, so the
raw shares sum to 1.0. The single-sample-per-tick denominator (S3b-1) is what makes
"frames = ticks" hold — a copy-pasted per-fighter `[a,b]` double-count would still sum to
1.0 but mislabel the denominator, so the tests pin `frames === ticks`, not `2×`.

## Next step

**S1a + S1b + S2 + S3a are shipped and archived; S3b is grilled + planned.** Both DESIGN
§P7 balance dials plus the per-move start-failure rate are measured, and S3b's distance
bucketing (the roadmap's named blocker) is resolved to **5 coarse reach tiers**, hardened
into S3b-1…S3b-9 and sequenced into a single-slice plan `plans/variety-telemetry-s3b.md`.
Next is to **land that plan as its own `docs(plan)` PR** (the S2 "no plan on main" lesson),
then implement the slice: load `tdd`, `testing`, `mutation-testing`, `refactoring` and
complete RED–GREEN–MUTATE–KILL MUTANTS–REFACTOR (the harness's pure reduction core is ideal
for factory-driven behavioral tests over synthetic `FightResult` fixtures — the
`benchmark.ts` pattern).

Remaining un-planned story after S3b: **S4** (scoring attribution — *grill first*: the
commitment-reconstruction window + rekka disambiguation; an engine survey answering both is
already captured in the session scratchpad `s4-scoring-attribution-engine-research.md` for
when S4 is picked up). S5a/b/c are post-launch / far-future.
