# Variety-telemetry harness — child stories

**Status:** story-splitting complete + **S1a hardened via find-gaps (2026-07-12)** —
S1a now carries 12 testable acceptance examples (see §Gaps closed). Decisions locked in
the sibling scoping doc `variety-telemetry-harness.md` (§Resolved decisions). Feeds
`planning`, one selected child story at a time.

**Shipped:** **S1a** (PRs #270–#272, archived) + **S1b** (PRs #273–#276, archived via
#277) + **S2** (PRs #278–#280, plan archived at `docs/archive/variety-telemetry-s2.md`)
are complete + live. The `telemetry` CLI now emits the pooled usage histogram, per-bot
adoption (k/N) + mean share, the effective-move-count diversity headline + live/dead
list, `--json`, a `-- <path…>` population override with fail-fast load, and the **opener
win-rate table** with the sample-gated §P7 `⚠` flag — so **both** DESIGN §P7 balance
dials (usage > 35%, opener > 60%) are now measured. **Next un-planned story: S3a**
(per-move degrade-rate).

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
| **S3a** | "Which moves are *chosen but keep failing to execute*?" | Per-move degrade-rate (chosen vs honoured, split by `DegradeReason`) | — | Given a move a bot picks out-of-band, Then its degrade-rate + reason show in the report | internal CLI; shippable |
| **S3b** | "Which reach zones do fights actually happen in?" | Inter-fighter distance occupancy histogram, bucketed by the reach ladder | — | Given the round-robin, Then a distance histogram shows whether the >300k pokes' range is ever occupied | internal CLI; shippable |
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
  disambiguation; S3b's exact distance bucketing. Grill each when its story is planned.

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

## Next step

**S1a + S1b + S2 are shipped and archived** (S2 plan at
`docs/archive/variety-telemetry-s2.md`). Both DESIGN §P7 balance dials are now measured.
The next un-planned child story is **S3a** (per-move degrade-rate) — load `planning` for
it (no open grills; straight to planning, optionally hardened with `find-gaps` on its
one acceptance example first). Each planned slice loads `tdd`, `testing`,
`mutation-testing`, `refactoring` and completes RED–GREEN–MUTATE–KILL MUTANTS–REFACTOR
before the next begins (the harness's pure reduction core is ideal for factory-driven
behavioral tests over synthetic `FightResult` fixtures — the `benchmark.ts` test pattern).

Remaining un-planned stories (each independently valuable, each needs its own planning
pass): **S3a** (per-move degrade-rate), **S3b** (distance-occupancy histogram — *grill*
the distance bucketing first), **S4** (scoring attribution — *grill first*: the
commitment-reconstruction window + rekka disambiguation; an engine survey answering both
is already captured in the session scratchpad `s4-scoring-attribution-engine-research.md`
for when S4 is picked up). S5a/b/c are post-launch / far-future.
