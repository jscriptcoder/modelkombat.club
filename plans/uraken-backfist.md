# Plan: `uraken` (backfist) — Batch-1 move #1

**Branch**: feat/uraken-backfist (Slice 1) · feat/uraken-rule-readers (Slice 2)
**Status**: Slice 1 **MERGED** (PR #117, benchmark v5) · Slice 2 **Active**
**Design source**: `docs/move-roster.md` (Batch-1 resolved frame data; balance law + policies)

## Goal

The bot can throw `uraken` (backfist) — the **cheapest** (`staminaCost 12`, gas-proof) and
**shortest** (`reach 200000`) hand strike, and the **first `high`-only** technique
(`bands:["high"]` ⇒ it whiffs a croucher). A 1-point _yuko_ snap / cheap gas-proof pressure
tool, wired into `CANONICAL_RULES` and taught in `spec.md`.

## Context — why this is small and additive

Post-C9 the arsenal is canonical and the `sim.ts` resolver is fully **generic**
(`rules.moves[action.move]` + `bandLegal` + `affordable` + `spec !== undefined`), so a new
move is **pure data + allowlist**, no resolver code. `uraken`'s traits are all already-proven
mechanics exercised by new data:

- **1-point strike** — `computeStrike` awards `spec.score` directly (proven by every punch).
- **`high`-only band gate** — `bandLegal` rejects non-listed bands; the _mirror_ of
  `mae-geri`'s `["mid"]` gate, now excluding **mid + low** instead of high + low.
- **`staminaCost 12` basic / gas-proof** — the C10 affordability gate: `12 ≤ gasThreshold 30`
  ⇒ still commits when gassed (proven for the punches).
- **`cancelInto:["gyaku-zuki"]`** — the C6 cancel machinery (proven by the jab).

`spec.md` is **generated** (`npm run gen:spec`): the move table row, the JSON-schema `move`
enum (`[...MOVES]`), and — in Slice 2 — the `rule(path)` list all derive from `MOVES` +
`CANONICAL_RULES` + the field-readers. No hand-editing of `spec.md`.

**Canonical `uraken` spec** (from `docs/move-roster.md`):

```ts
uraken: { startup: 7, active: 2, recovery: 13, score: 1,
          reach: 200000, bands: ["high"], staminaCost: 12,
          cancelInto: ["gyaku-zuki"] }
```

## Acceptance Criteria

Behaviour proven by `runFight` against `CANONICAL_RULES` (engine), `validate` (TCB), and the
`gen-spec` / schema drift tests (spec). Observable score/accept assertions, not literals alone.

- [x] **AC-1 (yuko snap):** a clean `high` `uraken` within reach scores **1**. _(Slice 1, #117)_
- [x] **AC-2 (high-only gate — mid):** `uraken` at `band:"mid"` degrades to idle ⇒ **0**
      (NEW: high-only, the inverse of the punches' `high·mid`). _(Slice 1, #117)_
- [x] **AC-3 (high-only gate — low):** `uraken` at `band:"low"` ⇒ **0**. _(Slice 1, #117)_
- [x] **AC-4 (shortest reach):** at a gap the jab (210k) still reaches but `uraken` (200k)
      cannot, `uraken` whiffs ⇒ **0** (documents `reach < jab`). _(Slice 1, #117)_
- [x] **AC-5 (cheapest, gas-proof):** a **gassed** fighter (`stamina ≤ 30`) still commits
      `uraken` and scores **1** (its cost 12 ≤ `gasThreshold` 30 — unlike the gas-locked
      kicks); the cost drawn is **12** (< jab 15 — the cheapest commit). _(Slice 1, #117)_
- [x] **AC-6 (cancel → reverse):** a `high` `uraken` that connects opens the cancel window; a
      `gyaku-zuki` started within it hit-confirms (the rekka opener works). _(Slice 1, #117)_
- [x] **AC-7 (TCB allowlist):** `validate` accepts `{type:"attack", move:"uraken", band:"high"}`
      **and** accepts it out-of-band (`band:"mid"`) — band-legality is a runtime concern; the
      validator only checks the move id + band are well-formed. _(Slice 1, #117)_
- [x] **AC-8 (spec teaches the move):** regenerated `spec.md` lists `uraken` in the attack-move
      line, the move-stats table (with `bands: high`), and the JSON-schema `move` enum;
      `gen-spec` + schema drift tests stay green. _(Slice 1, #117)_

**Deferred (NOT this feature):** the roster-wide no-Pareto-dominance property test (add once
more of Batch-1 lands, per `docs/move-roster.md`); the gauntlet rebalance re-run (a validation
step after the family lands, folding in `vulture`/`sweeper`).

## Slices

One slice = one PR. Each follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR. Load the project
CLAUDE.md + `tdd`/`testing`/`mutation-testing`/`refactoring` before any code.

### Slice 1: Bot can throw `uraken` — a canonical high-only, cheapest, shortest 1-point snap — ✅ MERGED (PR #117)

**Value**: The bot author gets the cheapest gas-proof poke — a `high`-only _yuko_ snap that
survives gassing and opens the rekka, at the cost of whiffing any croucher and the shortest
hand reach.
**Actor / Trigger / Outcome**: bot author / `{type:"attack", move:"uraken", band}` / the fight
scores **1** on a clean `high` hit in reach; **0** at mid/low (out-of-band), out-of-reach; the
gassed fighter still commits it; it cancels into `gyaku-zuki`.
**Path**: bot DSL `attack` → `dsl.ts` validate (`MOVES` admits `uraken`) → `sim.ts` `intake`
reads `rules.moves.uraken` → existing `bandLegal` + `affordable` + `spec !== undefined` gates
→ `startAttack` → existing `computeStrike`/`applyStrike` (`points: spec.score`) + cancel
window → `result.scores`. **No new resolver code.**
**Production edits**:

1. `types.ts` — `MoveId` union `+ "uraken"`; `Rules.moves` optional `"uraken"?: MoveSpec`
   (type-only ⇒ no runtime mutants).
2. `dsl.ts` (TCB) — `"uraken"` into the `MOVES` allowlist (the one mutable line).
3. `rules.ts` — the canonical `uraken` `MoveSpec` above in `CANONICAL_RULES.moves`.
4. `docs/spec.md` — `npm run gen:spec` (auto: move line, stats table row, JSON-schema `move`
   enum). Update the drift-test expectations that pin those literals.
   **Required implementation skills**: before code, load `tdd`, `testing`, `mutation-testing`,
   `refactoring`.
   **Acceptance criteria**: AC-1 … AC-5, AC-7, AC-8. **Present to human and confirm before code.**
   **RED** — failing tests first, mirroring the `mae-geri` behavioural block + the canonical
   relationship tests in `rules.test.ts`, the validator-accept tests in `validate-bot.test.ts`,
   and the drift tests in `gen-spec.test.ts` / `spec-schema.test.ts`:

- `rules.test.ts` (runFight vs `CANONICAL_RULES`): AC-1 (`high` in reach ⇒ 1), AC-2 (`mid` ⇒ 0),
  AC-3 (`low` ⇒ 0), AC-4 (gap where jab reaches but uraken doesn't ⇒ 0), AC-5 (gassed fighter
  still scores 1; cost drawn = 12).
- `validate-bot.test.ts`: AC-7 (accept `high`; accept out-of-band `mid`).
- `gen-spec.test.ts` / `spec-schema.test.ts`: AC-8 (regenerated `spec.md` contains the uraken
  row + enum entry; drift green).
  Mutator-awareness: the mutable production line is the `MOVES` string literal — AC-7 kills
  `"uraken" → ""`; AC-1's `=== 1` and AC-5's `=== 12`/gassed-still-scores pin score + cost; AC-2

* AC-3 (both mid and low fizzle) pin the high-only gate (kills a `bands` widening).
  **GREEN**: the four additive edits above; nothing in `sim.ts`.
  **MUTATE**: scope Stryker to `dsl.ts` (`MOVES`) + `rules.ts` (the new spec object). Expect
  allowlist + spec-literal mutants, killed by the ACs. Confirm `dsl.ts`/`rules.ts` stay 100%.
  **KILL MUTANTS**: strengthen only if a survivor appears; ask the human if a survivor's value
  is ambiguous.
  **REFACTOR**: none expected (additive mirror of the arsenal pattern); assess via `refactoring`,
  skip if no value.
  **Done when**: AC-1…AC-5, AC-7, AC-8 green; full suite green (byte-identical for all
  non-`uraken` paths); `dsl.ts`/`rules.ts` mutation 100%; typecheck + lint clean; mutation report
  reviewed; human approves commit.

### Slice 2: Bots can introspect `uraken`'s frames via `rule("moves.uraken.*")`

**Value**: The bot author can read `uraken`'s frames at runtime to write adaptive logic
(e.g. gate on `rule("moves.uraken.reach")`), the same as every other move.
**Actor / Trigger / Outcome**: bot author / a bot document using `{op:"rule",
path:"moves.uraken.reach"}` / `validate` accepts it and the interpreter returns the canonical
value (200000).
**Path**: bot DSL `rule(path)` → `dsl.ts` `ALLOWED_RULES` (derived from the field-readers)
admits the path → interpreter reads `CANONICAL_RULES.moves.uraken.<field>`.
**Production edits**:

1. `dsl.ts` (TCB) — 6 field-readers `moves.uraken.{startup,active,recovery,score,reach,
staminaCost}` (mirror the `mae-geri` readers, `?.`/`?? 0` for the optional key), which flow
   into `ALLOWED_RULES`.
2. `docs/spec.md` — `npm run gen:spec` (auto: the `moves.uraken.*` rule-path list + the
   `rulePath` enum). Update the drift-test expectations.
   **Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.
   **Acceptance criteria** — **present and confirm before code**:

- [ ] **AC-9 (rule-path accepted):** `validate` accepts a bot using `rule("moves.uraken.reach")`
      (and the other 5 paths); an unknown `moves.uraken.bands` path is **rejected**.
- [ ] **AC-10 (reader returns the value):** the interpreter resolves `rule("moves.uraken.reach")`
      to **200000** and `rule("moves.uraken.staminaCost")` to **12** against `CANONICAL_RULES`.
- [ ] **AC-11 (spec lists the paths):** regenerated `spec.md` lists the six `moves.uraken.*`
      rule paths + the `rulePath` schema enum; drift tests green.
      **RED**: `validate-bot.test.ts` — AC-9 (accept the 6 paths; reject a bogus one); an interpreter
      test — AC-10 (reader values); `gen-spec.test.ts`/`spec-schema.test.ts` — AC-11 (drift).
      **GREEN**: the 6 readers + regen.
      **MUTATE**: scope Stryker to the new `dsl.ts` reader lines; expect path-string + `?? 0`
      mutants, killed by AC-9/AC-10. Confirm `dsl.ts` 100%.
      **KILL MUTANTS / REFACTOR**: as Slice 1 (none expected).
      **Done when**: AC-9…AC-11 green; full suite green; `dsl.ts` mutation 100%; typecheck + lint
      clean; report reviewed; human approves commit.

> **Slice-count note:** Slices 1 + 2 MAY be merged into a single "fully-wired `uraken`" PR
> (matching the C9 "one technique per PR" precedent — every canonical move ships with its
> readers), trading one PR + one spec regen for two smaller independently-valuable slices.
> Recommended: keep them split (each is independently deployable and reviewable); fold only if
> you prefer the single-PR arsenal convention. **Your call at approval.**

## Pre-PR Quality Gate

Before each PR:

1. Mutation testing — `mutation-testing` skill, scoped to the changed `dsl.ts` / `rules.ts`
   lines (`types.ts` is type-only; `sim.ts` untouched). `rm -rf .stryker-tmp` first.
2. Refactoring assessment — `refactoring` skill (expected: no change).
3. `npm run typecheck` + `npm run lint` + `npm run format:check` pass; `spec.md` regenerated
   and drift-clean.
4. On feature completion: re-run the benchmark gauntlet to record `uraken`'s effect (informs
   the deferred `vulture`/`sweeper` rebalance); update `docs/move-roster.md` (mark `uraken`
   shipped, PR #) and `docs/STATUS.md`.

---

_When both slices are merged, **archive** this file under `docs/archive/` (add a README index
entry) — **do not delete it**. The record also lives in the PRs + `docs/move-roster.md`._
