# Plan: `shuto` (knife-hand) — Batch-1 move #2

**Branch**: feat/shuto-knife-hand (Slice 1) · feat/shuto-rule-readers (Slice 2)
**Status**: Active
**Design source**: `docs/move-roster.md` (Batch-1 resolved frame data; balance law + policies)

## Goal

The bot can throw `shuto` (knife-hand) — the **longest-reach hand strike**
(`reach 260000`), which **out-ranges the reverse punch** (`gyaku-zuki` 240000) despite
scoring only **1** (_yuko_). A `high·mid` gas-proof poke (`staminaCost 22 ≤ gasThreshold 30`)
that trades score down for reach up — wired into `CANONICAL_RULES` and taught in `spec.md`.

## Context — why this is small and additive (the `uraken` #117/#118 pattern)

Post-C9 the arsenal is canonical and the `sim.ts` resolver is fully **generic**
(`rules.moves[action.move]` + `bandLegal` + `affordable` + `spec !== undefined`), so a new
move is **pure data + allowlist**, no resolver code — exactly as `uraken` (move #1) shipped.
`shuto`'s traits are all already-proven mechanics exercised by new data:

- **1-point strike** — `computeStrike` awards `spec.score` directly (every punch).
- **`high·mid` band gate** — `bandLegal` admits both listed bands, rejects `low` (identical to
  the punches' gate; **not** a new mechanic — `uraken` already exercised the single-band case).
- **`staminaCost 22` basic / gas-proof** — `22 ≤ gasThreshold 30` ⇒ still commits when gassed;
  the priciest of the gas-proof hands (`uraken` 12 < `kizami` 15 < `shuto` 22).
- **`cancelInto:["gyaku-zuki"]`** — the C6 cancel machinery (the rekka opener; `shuto` is a
  cancel _source_ only — `gyaku-zuki.cancelInto` grows only for the new **kicks**, not hands).

**The signature trait — reach beyond the reverse.** Reach ladder around `shuto`:
`gyaku-zuki` 240k < **`shuto` 260k** < `mae-geri` 270k. A **1-point** hand that out-reaches the
**2-point** reverse is the no-Pareto trade made concrete: `shuto` pushes **reach up** (260 > 240)
and pays with **score down** (1 < 2), **cost up** (22 > 20), and **startup down** (8 > 7). It
also out-reaches the jab (210k) while paying more (cost 22 > 15, startup 8 > 7) — dominance-free
against **both** existing hands.

`spec.md` is **generated** (`npm run gen:spec`): the move table row, the JSON-schema `move`
enum (`[...MOVES]`), and — in Slice 2 — the `rule(path)` list all derive from `MOVES` +
`CANONICAL_RULES` + the field-readers. No hand-editing of `spec.md`.

**Canonical `shuto` spec** (from `docs/move-roster.md`):

```ts
shuto: { startup: 8, active: 2, recovery: 15, score: 1,
         reach: 260000, bands: ["high", "mid"], staminaCost: 22,
         cancelInto: ["gyaku-zuki"] }
```

## Benchmark impact (the `uraken` finding, restated)

Wiring `shuto` into `CANONICAL_RULES` flips the benchmark `INPUT_HASH` ⇒ **Slice 1 bumps
`BENCHMARK_VERSION` v5 → v6** (recompute `INPUT_HASH`, update the guard + version-assertion
tests in `benchmark-config.test.ts`). **Slice 2 adds no `CANONICAL_RULES` field** (readers
only) ⇒ `INPUT_HASH` stable ⇒ **no bump**. The 6 frozen gauntlet bots don't reference `shuto`,
so their round-robin outcomes stay byte-identical under v6 (no gauntlet re-characterization).

## Acceptance Criteria

Behaviour proven by `runFight` against `CANONICAL_RULES` (engine), `validate` (TCB), and the
`gen-spec` / schema drift tests (spec). Observable score/accept assertions, not literals alone.

- [ ] **AC-1 (yuko — high):** a clean `high` `shuto` within reach scores **1**.
- [ ] **AC-2 (yuko — mid):** a clean `mid` `shuto` within reach scores **1** (`high·mid`, unlike
      `uraken`'s high-only gate).
- [ ] **AC-3 (band gate — low):** `shuto` at `band:"low"` degrades to idle ⇒ **0** (`low` ∉ bands).
- [ ] **AC-4 (out-ranges the reverse — the signature):** at a gap where `gyaku-zuki` (240k) whiffs
      but `shuto` (260k) still lands, `shuto` scores **1** where the reverse would score **0**
      (documents `shuto.reach > gyaku-zuki.reach` — a 1-pt hand out-reaching the 2-pt reverse).
- [ ] **AC-5 (gas-proof, priciest basic hand):** a **gassed** fighter (`stamina ≤ 30`) still commits
      `shuto` and scores **1** (its cost 22 ≤ `gasThreshold` 30 — unlike the gas-locked kicks); the
      cost drawn is **22** (> `uraken` 12, > `kizami` 15 — the most expensive gas-proof hand).
- [ ] **AC-6 (cancel → reverse):** a `shuto` that connects opens the cancel window; a `gyaku-zuki`
      started within it hit-confirms (the rekka opener works).
- [ ] **AC-7 (TCB allowlist):** `validate` accepts `{type:"attack", move:"shuto", band:"high"}`
      **and** accepts it out-of-band (`band:"low"`) — band-legality is a runtime concern; the
      validator only checks the move id + band are well-formed.
- [ ] **AC-8 (spec teaches the move):** regenerated `spec.md` lists `shuto` in the attack-move line,
      the move-stats table (with `bands: high·mid`), and the JSON-schema `move` enum; `gen-spec` +
      schema drift tests stay green; `BENCHMARK_VERSION` v5 → v6.
- [ ] **AC-9 (rule-path accepted):** `validate` accepts a bot using `rule("moves.shuto.reach")`
      (and the other 5 paths); an unknown `moves.shuto.bands` path is **rejected**. _(Slice 2)_
- [ ] **AC-10 (reader returns the value):** the interpreter resolves `rule("moves.shuto.reach")` to
      **260000** and `rule("moves.shuto.staminaCost")` to **22** against `CANONICAL_RULES`. _(Slice 2)_
- [ ] **AC-11 (spec lists the paths):** regenerated `spec.md` lists the six `moves.shuto.*` rule
      paths + the `rulePath` schema enum; drift tests green. _(Slice 2)_

**Deferred (NOT this feature):** the roster-wide no-Pareto-dominance property test (add once more
of Batch-1 lands, per `docs/move-roster.md`); the `vulture`/`sweeper` gauntlet rebalance (a
separate capability, folded into a family-level re-run).

## Slices

One slice = one PR. Each follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR. Load the project
CLAUDE.md + `tdd`/`testing`/`mutation-testing`/`refactoring` before any code.

### Slice 1: Bot can throw `shuto` — the canonical longest-reach 1-point hand

**Value**: The bot author gets a `high·mid` _yuko_ poke that **out-ranges the reverse punch** and
survives gassing, at the cost of the reverse's second point and a slower startup — a distinct
spacing tool in the hand game.
**Actor / Trigger / Outcome**: bot author / `{type:"attack", move:"shuto", band}` / the fight
scores **1** on a clean `high`/`mid` hit in reach; **0** at `low` (out-of-band) and where the
reverse would reach but `shuto` out-ranges it; the gassed fighter still commits it; it cancels
into `gyaku-zuki`.
**Path**: bot DSL `attack` → `dsl.ts` validate (`MOVES` admits `shuto`) → `sim.ts` `intake`
reads `rules.moves.shuto` → existing `bandLegal` + `affordable` + `spec !== undefined` gates →
`startAttack` → existing `computeStrike`/`applyStrike` (`points: spec.score`) + cancel window →
`result.scores`. **No new resolver code.**
**Production edits**:

1. `types.ts` — `MoveId` union `+ "shuto"`; `Rules.moves` optional `"shuto"?: MoveSpec`
   (type-only ⇒ no runtime mutants).
2. `dsl.ts` (TCB) — `"shuto"` into the `MOVES` allowlist (the one mutable line).
3. `rules.ts` — the canonical `shuto` `MoveSpec` above in `CANONICAL_RULES.moves`.
4. `benchmark-config.ts` — `BENCHMARK_VERSION` v5 → v6; recompute `INPUT_HASH`.
5. `docs/spec.md` — `npm run gen:spec` (auto: move line, stats table row, JSON-schema `move`
   enum, embedded version/hash). The data-driven drift tests pin these.

**Required implementation skills**: before code, load `tdd`, `testing`, `mutation-testing`,
`refactoring`.
**Acceptance criteria**: AC-1 … AC-8. **Present to human and confirm before code.**
**RED** — failing tests first, mirroring the `uraken`/`mae-geri` behavioural block in
`rules.test.ts`, the validator-accept tests in `validate-bot.test.ts`, and the drift/version
tests in `gen-spec.test.ts` / `spec-schema.test.ts` / `benchmark-config.test.ts`:

- `rules.test.ts` (runFight vs `CANONICAL_RULES`): AC-1 (`high` in reach ⇒ 1), AC-2 (`mid` in
  reach ⇒ 1), AC-3 (`low` ⇒ 0), AC-4 (gap where `gyaku-zuki` whiffs but `shuto` lands ⇒ shuto 1 /
  reverse 0), AC-5 (gassed fighter still scores 1; cost drawn = 22), AC-6 (shuto→`gyaku-zuki`
  cancel hit-confirms).
- `validate-bot.test.ts`: AC-7 (accept `high`; accept out-of-band `low`).
- `benchmark-config.test.ts`: AC-8 version guard — bump the version-assertion test to `v6` and
  re-pin `INPUT_HASH` (the guard goes RED on the `CANONICAL_RULES` change until re-pinned).
- `gen-spec.test.ts` / `spec-schema.test.ts`: AC-8 drift — regenerated `spec.md` contains the
  `shuto` row + `move`-enum entry; drift green after regen.

Mutator-awareness: the mutable production line is the `MOVES` string literal — AC-7 kills
`"shuto" → ""`; AC-1/AC-2's `=== 1` and AC-5's `=== 22`/gassed-still-scores pin score + cost;
AC-4 pins `reach > gyaku-zuki` (kills a reach narrowing to ≤ 240k); AC-3 pins the band gate
(kills a `bands` widening to include `low`).
**GREEN**: the five additive edits above; nothing in `sim.ts`.
**MUTATE**: scope Stryker to `dsl.ts` (`MOVES`) + `rules.ts` (the new spec object) +
`benchmark-config.ts` (version/hash). `rm -rf .stryker-tmp` first. Confirm 100% on the changed
lines.
**KILL MUTANTS**: strengthen only if a survivor appears; ask the human if a survivor's value is
ambiguous.
**REFACTOR**: none expected (additive mirror of the arsenal pattern); assess via `refactoring`,
skip if no value.
**Done when**: AC-1…AC-8 green; full suite green (byte-identical for all non-`shuto` paths);
`dsl.ts`/`rules.ts`/`benchmark-config.ts` mutation 100%; typecheck + lint + format clean;
mutation report reviewed; human approves commit.

### Slice 2: Bots can introspect `shuto`'s frames via `rule("moves.shuto.*")`

**Value**: The bot author can read `shuto`'s frames at runtime to write adaptive logic (e.g.
gate on `rule("moves.shuto.reach")` to open at knife-hand range), the same as every other move.
**Actor / Trigger / Outcome**: bot author / a bot document using `{op:"rule",
path:"moves.shuto.reach"}` / `validate` accepts it and the interpreter returns the canonical
value (260000).
**Path**: bot DSL `rule(path)` → `dsl.ts` `ALLOWED_RULES` (derived from the field-readers)
admits the path → interpreter reads `CANONICAL_RULES.moves.shuto.<field>`.
**Production edits**:

1. `dsl.ts` (TCB) — 6 field-readers `moves.shuto.{startup,active,recovery,score,reach,
staminaCost}` in `RULE_READERS` (mirror the `uraken`/`mae-geri` readers, `?.`/`?? 0` for the
   optional key), which flow into `ALLOWED_RULES` / `RulePath`.
2. `docs/spec.md` — `npm run gen:spec` (auto: the `moves.shuto.*` rule-path list + the `rulePath`
   enum). The data-driven drift tests pin these. **No `CANONICAL_RULES` change ⇒ no version bump.**

**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.
**Acceptance criteria**: AC-9 … AC-11. **Present and confirm before code.**
**RED**: `validate-bot.test.ts` — AC-9 (add the 6 `moves.shuto.*` paths to the accept table;
add `moves.shuto.bands` to the reject table); `interpret-tick.test.ts` — AC-10 (6 reader-value
rows: canonical `8/2/15/1/260000/22`, minimal-sentinel `0`; mutually distinct ⇒ wrong-field read
caught); `gen-spec.test.ts` / `spec-schema.test.ts` — AC-11 (data-driven drift goes RED on the
reader add, green after regen).
**GREEN**: the 6 readers + regen.
**MUTATE**: scope Stryker to the new `dsl.ts` reader lines; expect path-string + `?? 0` mutants,
killed by AC-9/AC-10. Confirm `dsl.ts` 100%.
**KILL MUTANTS / REFACTOR**: as Slice 1 (none expected).
**Done when**: AC-9…AC-11 green; full suite green; `dsl.ts` mutation 100%; typecheck + lint +
format clean; report reviewed; human approves commit.

> **Slice-count note:** Slices 1 + 2 MAY be merged into a single "fully-wired `shuto`" PR
> (matching the C9 "one technique per PR" precedent), trading one PR + one spec regen for two
> smaller independently-valuable slices. Recommended: keep them split, as `uraken` shipped
> (#117 wiring / #118 readers) — each is independently deployable and reviewable. **Your call.**

## Pre-PR Quality Gate

Before each PR:

1. Mutation testing — `mutation-testing` skill, scoped to the changed `dsl.ts` / `rules.ts` /
   `benchmark-config.ts` lines (`types.ts` is type-only; `sim.ts` untouched). `rm -rf .stryker-tmp`
   first.
2. Refactoring assessment — `refactoring` skill (expected: no change).
3. `npm run typecheck` + `npm run lint` + `npm run format:check` pass; `spec.md` regenerated and
   drift-clean.
4. On feature completion: update `docs/move-roster.md` (mark `shuto` shipped, PR #) and
   `docs/STATUS.md`; the family-level `vulture`/`sweeper` gauntlet re-run stays deferred until the
   Batch-1 family lands.

---

_When both slices are merged, **archive** this file under `docs/archive/` (add a README index
entry under the existing "Batch-1 arsenal expansion" section) — **do not delete it**. The record
also lives in the PRs + `docs/move-roster.md`._
