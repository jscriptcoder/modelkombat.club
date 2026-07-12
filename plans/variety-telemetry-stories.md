# Variety-telemetry harness — child stories

**Status:** story-splitting complete + **S1a hardened via find-gaps (2026-07-12)** —
S1a now carries 12 testable acceptance examples (see §Gaps closed). Decisions locked in
the sibling scoping doc `variety-telemetry-harness.md` (§Resolved decisions). Feeds
`planning`, one selected child story at a time.

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

- Given the round-robin, Then each opener move shows its win-rate = (a fighter opened
  with it and won) / (opened with it); draws counted separately, never as wins.
- Given an opener whose win-rate exceeds 60%, Then it is flagged `⚠` (exit 0).
- Given a fighter that never commits a technique in a fight, Then it contributes a
  **null opener** (excluded from win-rates, shown as a count).

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

## Next step

Load `planning` for **S1a** to turn it into PR-sized implementation slices. Each
planned slice must load `tdd`, `testing`, `mutation-testing`, and `refactoring` and
complete RED–GREEN–MUTATE–KILL MUTANTS–REFACTOR before the next begins (the harness's
pure reduction core is ideal for factory-driven behavioral tests over synthetic
`FightResult` fixtures — the `benchmark.ts` test pattern). Optionally run `find-gaps`
on this split first to harden the S1a acceptance examples.
