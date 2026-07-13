# Variety-telemetry harness — capability scoping

**Status:** SCOPING — **grill-me complete (2026-07-12)**; the 5 open questions + 3
surfaced decision-tree branches are resolved (see §Resolved decisions). Ready for
`story-splitting` → `planning`. Not a plan; no code implied.

## The question it answers

`DESIGN.md §P7` sets a balance target — **no move > ~35% usage, no opener > ~60%
win** — and explicitly notes it is *"tuned via bot-vs-bot telemetry (a harness that
does not yet exist)."* `move-roster.md` echoes it as an open dependency. This
harness is that instrument: it turns **"do we have enough move variety, and is it
actually used?"** from a guess into a measurement, so a decision to add (or cut, or
buff) a move is evidence-driven rather than intuition-driven.

It is the tool you want **before** deciding whether to expand the roster — including
pre-launch, to validate that the reference roster already exercises the arsenal.

## Headline finding: the data already exists (so this is cheap + safe)

Everything the harness needs is already emitted by the engine — no instrumentation
required:

- `runFight` returns `FightResult.events: FightEvent[]` (`sim.ts:121`, `:125`).
- `FightEvent = { tick, a: FighterFrame, b: FighterFrame }` (`sim.ts:85`).
- `FighterFrame = { x, y, action, points, stamina, degrade }` (`sim.ts:77`):
  - **`action`** — the move+band each fighter chose that tick (`{type:"attack",
    move, band}` for a strike). → **move-usage histogram, opener detection**.
  - **`points`** — score *at end of tick*, so a per-tick scoring delta
    (`points[t] − points[t−1] > 0`) is derivable. → **scoring attribution**.
  - **`degrade`** — `DegradeReason | null` (`sim.ts:70`): why an action didn't take
    effect. → **per-move usability (chosen-but-degraded) signal**.
  - **`x`** — both fighters' positions → **distance/spacing occupancy** (which reach
    bands fights actually happen in; are the beyond-neutral pokes ever relevant?).

`benchmark.ts` already walks this exact stream but reduces it to *outcomes*,
reading only `.degrade` and discarding `.action` (`benchmark.ts:103-111`,
`:220-251`). The variety harness is the **same aggregation shape, keeping `.action`**.

### What this means for cost + the non-negotiables

- **No engine change.** `sim.ts` / `dsl.ts` / `types.ts` / `prng.ts` untouched →
  determinism + TCB invariants (#1, #2) preserved by construction.
- **No `CANONICAL_RULES` change** → **no `INPUT_HASH` flip, no `BENCHMARK_VERSION`
  bump** → `npm run fight` stays byte-identical. This is a pure *read-only analysis
  layer*, not a scoring input.
- **Pure + deterministic + TDD-friendly.** The analysis core is a pure reduction
  over synthetic `FightResult` fixtures — trivially unit-testable with factory
  functions, mutation-friendly, exactly the `benchmark.ts` pattern.

## Metrics (mapped to the DESIGN target + natural extras)

All keyed over the **13 techniques** (11 `attack` moves + `throw` + `sweep`), counted
per **honoured commitment** — a frame where `action.type ∈ {attack, throw, sweep}` AND
`degrade === null` (see §Resolved decisions #1).

**Headline (the two DESIGN §P7 dials):**

1. **Move-usage share** — reported on **both** bases: *pooled* (% of all commitments
   across the population — the `> ~35%` dominance guard, tempo-weighted) and *per-bot
   adoption* (fraction of the N bots using the move — the tempo-neutral variety
   signal). A pooled breach is flagged inline `⚠` (no CI gate; decision #8).
2. **Opener win-rate** — each fighter's *first honoured commitment* in a fight, joined
   with that fighter's fight outcome; aggregated per opener move. The `> ~60%` guard
   (flagged `⚠`). Null-opener turtles excluded + counted.

**Natural extras (same data, high value for the "enough variety?" question):**

3. **Diversity index** — **effective-move-count** = `exp(Shannon entropy)` of the
   pooled distribution (Hill q=1): "N of 13 techniques effectively in rotation."
   Companions: `# live (≥1 use)` and `# dead (0 use)` + the dead list.
4. **Dead moves** — techniques with ~0% usage across the whole population: spec
   variety nobody touches → candidates for a buff, a niche fix, or removal.
5. **Per-move degrade rate** — how often a move is *chosen but degrades* (out-of-band
   / unaffordable): flags a move that is hard to use correctly vs one that is simply
   unpicked (different remedies).
6. **Spacing occupancy** — histogram of inter-fighter distance over the fight, bucketed
   into 5 coarse reach tiers (clinch/hand/kick/poke/out — decision #9): are the long-reach
   zoning pokes (`yoko`/`ushiro`) ever spatially relevant, or is the >300k range dead?

## The population question (the one real scope fork)

"Bot-vs-bot telemetry" needs a *corpus* of bots. Its signal scales with the corpus:

- **Pre-launch corpus = the reference bots** — the 6 frozen gauntlet archetypes
  (`GAUNTLET_NAMES`) + example bots (`warden`, etc.), run as a full **round-robin**
  (every bot vs every other, both sides, all `SEEDS`). This measures the *reference
  roster's* meta — small and hand-authored, but real. It answers: *does our own
  curated population exercise the arsenal, or are moves dead on arrival?* A coupled
  round-robin already exists in test form (`gauntlet-calibration.test.ts`), so the
  driver is partly proven.
- **Post-launch corpus = real LLM submissions** — feed the harness a directory of
  submitted `X-Author-Handle` documents and it becomes the true *meta monitor* (what
  are LLMs actually converging on; which opener is oppressive). This is where the
  instrument earns its keep — but it needs submissions, which only exist after launch.

**Recommendation:** build for the round-robin over a supplied bot set (default: the
gauntlet + examples). Same code serves both eras — pre-launch you point it at the
reference bots; post-launch you point it at the submission corpus. No rework.

## Proposed architecture (mirrors `benchmark.ts`)

Three pieces, all in the existing style:

- **`src/engine/telemetry.ts`** — the pure analysis core. Input: a list of
  `FightResult`s (or a population + run params). Output: a `VarietyReport`
  (usage histogram, opener win-rates, diversity index, dead-move list, degrade-per-
  move, spacing occupancy). No I/O. Sibling to `benchmark.ts`.
- **Round-robin driver** — generalizes `benchmark.ts`'s bot-vs-gauntlet loop to a
  population-vs-population round-robin that **keeps `events`** (the benchmark discards
  them per fight). At these sizes this is free: 6 bots → 6×5 ordered pairs × 10 seeds
  = 300 fights; even a 20-bot post-launch corpus is trivial. No scaling concern.
- **`src/cli/*` + `npm run telemetry`** — the thin shell mirroring
  `run-benchmark.ts` / `benchmark.ts`: load a bot set through the validator gate, run
  the round-robin on `CANONICAL_RULES` + `SEEDS`, render the report to stdout
  (cli-design stream discipline). Optionally emit a committed board doc
  `docs/variety-<version>.md`, the way `docs/benchmark-gauntlet-v19.md` snapshots the
  gauntlet.

## Proposed slices (vertical, PR-per-slice; each a pure-reduction, no version bump)

> **Superseded by the split.** These S1–S5 sketches are refined into authoritative
> child stories in the sibling `variety-telemetry-stories.md` (story-splitting,
> 2026-07-12) — notably S1 splits into a walking-skeleton **S1a** + enrichment **S1b**,
> and S5's "external corpus" is enabled-by-construction, not a build. The list below is
> kept for context.

- **S1 — usage histogram (pooled + adoption) + diversity + dead-move flags** over the
  gauntlet round-robin, behind `npm run telemetry`, with a `--json` flag. Includes the
  `⚠` soft-flag on a pooled `>35%` share. *This slice alone answers the original "is our
  variety used?" question* and is the minimum shippable instrument.
- **S2 — opener win-rate** — the second DESIGN §P7 dial (first-honoured-commitment →
  fight-outcome join), with the `⚠` soft-flag on a `>60%` opener.
- **S3 — per-move degrade rate + spacing occupancy** — usability + spatial signals.
- **S4 (optional, has modeling nuance) — scoring attribution** — whiff-vs-land and
  points-per-move. Needs a commitment-reconstruction pass: a point delta at tick `t`
  is attributed to the most-recent *honoured* attack start within the move's
  `startup+active` window (with care for rekka chains where several strikes start in
  quick succession). Defer until S1–S3 prove the instrument.
- **S5 (post-launch) — external submission corpus** ingest, and/or a committed board
  doc / web "meta report" surface.

## Non-goals

- Not a platform endpoint. Offline analysis CLI first; a web meta-report is a later,
  separate surface (S5) if wanted.
- Not a balance *auto-tuner*. It measures; a human reads it and decides. (The
  `no-Pareto-dominance` property test remains the mechanical guard; this is the
  behavioral complement.)
- Not a change to how fights resolve or are scored. Read-only.

## Resolved decisions (grill-me, 2026-07-12)

1. **Usage unit — per honoured commitment.** One count per move START: a frame where
   `action.type ∈ {attack, throw, sweep}` AND `degrade === null`. Grounded in
   `sim.ts:1321` (the frame records the bot's returned action + honour result): a move
   is honoured on exactly one tick; later committed ticks are `idle` or
   `degrade:"locked"`, so this is naturally per-instance and robust to bot style (a
   turtle spamming attacks while locked doesn't inflate the count). A rekka/cancel
   follow-up is its own honoured start ⇒ counts as a use of the move cancelled into.
   *Rejected:* per-tick-occupied (over-weights slow moves by frame length),
   per-connect (measures effectiveness not choice — that is S4).
2. **Key space — all 13 techniques.** The histogram keys the 11 `attack` moves +
   `throw` + `sweep` (the Arsenal set), by resolved action, not just the `moves`
   allowlist.
3. **Share basis — report BOTH, labeled.** (a) *Pooled* = % of all commitments across
   the population (the §P7 `>35%` dominance guard; tempo-weighted). (b) *Per-bot
   adoption* = fraction of the N bots that use the move + mean per-bot share
   (tempo-neutral variety signal; dead-move = adoption 0). Different questions, both
   free. *Rejected:* pooled-only (fast archetypes dominate the reading), per-bot-only
   (loses the "one move dominates actual play" signal).
4. **Diversity index — effective-move-count.** Headline scalar = `exp(Shannon entropy)`
   of the pooled distribution (Hill q=1): "N of 13 techniques effectively in rotation"
   (even 13-way → 13.0, total collapse → 1.0). Companions: `# live (≥1 use)` +
   `# dead (0 use)` with the dead list. *Rejected:* Simpson/inverse-Simpson
   (concentration, less intuitive as a variety headline), threshold-count (arbitrary
   cutoff + boundary cliff).
5. **Opener — first commitment → fight outcome.** Each fighter's first honoured
   technique commitment in a fight, joined to THAT fighter's fight result. Opener
   win-rate per move = (opened-with-X and won) / (opened-with-X); draws counted
   separately, never as wins (matches `benchmark.ts` `botWin` semantics). Pure-turtle
   fighters with no commitment have a NULL opener ⇒ excluded from opener stats +
   counted. *Yame note:* a fight has many neutral resets, but per-exchange "what leads
   offense" is already captured by the S1 usage histogram, so the opener metric stays
   fight-level for a clean win-join. *Rejected:* per-exchange opener (no fight-level
   win-join; duplicates S1), first-scoring-move (pulls S4 attribution into S2).
6. **Population default — the 6 frozen gauntlet, overridable.** No-arg default =
   `GAUNTLET_NAMES` (versioned, balance-locked, spanning ⇒ stable + reproducible
   headline numbers and any committed board). The CLI takes an optional path/glob to
   widen: `npm run telemetry -- bots/*.json` pre-launch (richer arsenal + dead-move
   read across all 15 example bots), or a submission dir post-launch — same code both
   eras. Round-robin rule inherited from `benchmark.ts`: skip self-mirrors (`sameDoc`),
   run both orderings of every distinct pair, over all `SEEDS`. *Rejected:*
   default-all-`bots/*` (non-reproducible; fixture contamination, e.g. `dogfood`),
   gauntlet+curated (needs a curation decision first).
7. **Output — stdout report + `--json` from S1; committed board deferred.** Human table
   to stdout (cli-design stream discipline, mirroring `run-benchmark.ts`) + a `--json`
   flag emitting the raw `VarietyReport` (enables run-to-run diffing + a future web
   surface). A committed `docs/variety-<version>.md` board is deferred to S3/S5, after
   the metric set stabilizes. *Rejected:* board-from-S1 (re-churns a committed doc every
   slice), human-only (no machine output until a retrofit).
8. **Guard mode — descriptive with soft flags; hard CI gate deferred.** S1–S3 MEASURE
   and report; **exit 0 always** (no build failure). §P7 breaches are visibly FLAGGED
   inline (`throw-opener 64% ⚠ (>60%)`, `move share > 35% ⚠`) to draw the eye without
   false-alarm red builds — over just 6 gauntlet bots a signature-move archetype
   naturally pushes a threshold, so a hard gate would trip benignly. Revisit a CI guard
   (the `gauntlet-calibration.test.ts` pattern) once post-launch submissions give a real
   population. *Rejected:* hard gate from the start (6-bot noise trips it),
   pure-descriptive-no-flags (breaches easy to miss).
9. **Spacing-occupancy buckets — 5 coarse reach tiers** (grill-me, 2026-07-13, for S3b).
   Inter-fighter distance (`|a.x − b.x|`, the sim's own horizontal reach gate; over
   `[0, ring.width = 600k]`, start 300k) is bucketed into **5 coarse reach tiers** at
   reach-ladder breakpoints: `clinch [0,120k)` (< throw), `hand [120,240k)`
   (throw..reverse), `kick [240,300k)` (reverse..roundhouse), `poke [300,330k)`
   (roundhouse/startGap..ushiro — the long zoning pokes only), `out [330,600k]` (beyond all
   reach — pure approach/spacing). ONE sample per **tick** (distance is symmetric ⇒
   denominator = total ticks, NOT 2×); **all frames**, no exclusions; fixed **natural
   distance order** (not share-desc — the axis is ordered); **no `⚠`** (diagnostic only —
   the decision-#8 soft-flag exemption; S3a/S3b carry none). The bot API exposes no named
   distance zones (`opponent.distance` is a raw int), so the tiers are the telemetry's own,
   keyed to the ladder. *Rejected:* fine per-rung bands (14 thin, noisy buckets with fiddly
   labels), per-technique cumulative in-reach % (not a partition), fixed-width bins (loses
   the reach-ladder meaning the story names). Full acceptance shape in
   `variety-telemetry-stories.md` §S3b (S3b-1…S3b-9).

### Still open (later grills, not blocking)

- **S4 scoring-attribution internals** — the commitment-reconstruction window + rekka
  chain disambiguation. Grill when S4 is planned.

## Cost estimate

Low. It is `benchmark.ts` again with `.action` kept instead of discarded, plus a
population loop that already exists in test form. S1 is a single small pure module +
a thin CLI + factory-driven tests — comparable to one grounded-move PR, but with
**zero** engine risk and **zero** version churn. S1–S3 together are a modest arc.
