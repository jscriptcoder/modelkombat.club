# Plan: `yoko-geri` (side kick) — Batch-1 move #3

**Branch**: feat/yoko-geri-side-kick (Slice 1) · feat/yoko-geri-rule-readers (Slice 2)
**Status**: ✅ **COMPLETE** — Slice 1 MERGED (PR #123, benchmark v7) · Slice 2 MERGED (PR #124, no bump)
**Design source**: `docs/move-roster.md` (Batch-1 resolved frame data; balance law + policies)

## Goal

The bot can throw `yoko-geri` (side kick) — the **first kick of the arsenal expansion** and a
**beyond-neutral zoning thrust**: `reach 315000` **exceeds `startGap` (300000)** and out-reaches
even the roundhouse (300000), scoring **2** (_waza-ari_) at the cost of the slowest-but-one
startup, longest-but-one recovery, a **mid-only** band, and the highest cost so far (`48`,
**gas-locked**). Wired into `CANONICAL_RULES` and taught in `spec.md`.

## Context — why this is small and additive (the `uraken`/`shuto` pattern)

Post-C9 the arsenal is canonical and the `sim.ts` resolver is fully **generic**
(`rules.moves[action.move]` + `bandLegal` + `affordable` + `spec !== undefined`), so a new move is
**pure data + allowlist**, no resolver code — exactly as `uraken` (#1) and `shuto` (#2) shipped.
`yoko-geri` is the first move to exercise **four** paths the two hands did not — but every one is
already-proven engine mechanics driven by new data:

- **Score-2 (_waza-ari_)** — `computeStrike` awards `spec.score` directly; `mae-geri`/`mawashi-geri`
  already prove a 2-point chudan kick. `yoko-geri` is the expansion's first score-2 move.
- **Gas-LOCKED (`staminaCost 48 > gasThreshold 30`)** — the `affordable` gate already locks out
  specials when gassed (`mae-geri` 35, `mawashi-geri` 45, throw/sweep 40). `yoko-geri` is the first
  gas-locked move added by the expansion — the mirror image of `uraken`/`shuto` (gas-proof hands): a
  gassed fighter can **no longer** throw it. (Behavioural precedent: the `DRAIN_THEN_THROW` bot in
  `rules.test.ts` — a special degrades to idle once its cost exceeds the gassed reserve.)
- **`mid`-only band gate** — `bandLegal` admits only the listed band(s); `mae-geri` already proves the
  chudan-only case. `yoko-geri` is mid-only (whiffs `high` and `low`) ⇒ needs prominent `spec.md` band
  teaching (per move-roster S3).
- **Cancel TARGET, not just source** — `yoko-geri`'s `cancelInto:["gyaku-zuki"]` makes it a rekka
  source (kick → reverse finisher, situational at ≤240k, identical to `mae-geri`/`mawashi-geri`). NEW
  vs the hands: it is **also a cancel target** — `gyaku-zuki.cancelInto` **grows** to include
  `yoko-geri` (the "reverse → any kick" category policy). Both edges use the existing C6 cancel
  machinery; the growth is pure data (spatially valid — the kick out-reaches the punch).

**The signature trait — reach beyond neutral.** Reach ladder around `yoko-geri`:
`mawashi-geri` 300k = `startGap` 300k < **`yoko-geri` 315k**. It is the first technique that connects
at a gap where **every** existing move — including the longest, the roundhouse — whiffs. Its
no-Pareto trade made concrete: it pushes **reach up** (315 > 300) and pays with the slowest-but-one
**startup** (12 > roundhouse 11), the longest-but-one **recovery** (20 > 18), the highest **cost**
(48 > 45), a single **band** (mid vs roundhouse high·mid), and **no ippon** (score 2, no `scoreByBand`
jodan bonus — vs the roundhouse's 3). Dominance-free vs the roundhouse on five axes.

**Canonical `yoko-geri` spec** (from `docs/move-roster.md`):

```ts
"yoko-geri": { startup: 12, active: 3, recovery: 20, score: 2,
               reach: 315000, bands: ["mid"], staminaCost: 48,
               cancelInto: ["gyaku-zuki"] }
```

Plus the grown edge on the **existing** reverse punch:

```ts
"gyaku-zuki": { …, cancelInto: ["mae-geri", "mawashi-geri", "yoko-geri"] } // + the new kick
```

`spec.md` is **generated** (`npm run gen:spec`): the move table row, the JSON-schema `move` enum
(`[...MOVES]`), and — in Slice 2 — the `rule(path)` list all derive from `MOVES`, `CANONICAL_RULES`,
and the field-readers. No hand-editing of `spec.md`.

## Benchmark impact (the `uraken`/`shuto` finding, restated)

Wiring `yoko-geri` into `CANONICAL_RULES` (the new spec **and** the grown `gyaku-zuki.cancelInto`,
both scoring inputs) flips the benchmark `INPUT_HASH` ⇒ **Slice 1 bumps `BENCHMARK_VERSION` v6 → v7**
(recompute `INPUT_HASH`, update the guard + version-assertion tests in `benchmark-config.test.ts`).
**Slice 2 adds no `CANONICAL_RULES` field** (readers only) ⇒ `INPUT_HASH` stable ⇒ **no bump**. The 6
frozen gauntlet bots don't reference `yoko-geri`, so their round-robin outcomes stay byte-identical
under v7 (no gauntlet re-characterization).

## Acceptance Criteria

Behaviour proven by `runFight` against `CANONICAL_RULES` (engine), `validate` (TCB), and the
`gen-spec` / schema drift tests (spec). Observable score/accept assertions, not literals alone.

- [x] **AC-1 (waza-ari — mid):** a clean `mid` `yoko-geri` within reach scores **2** (chudan
      _waza-ari_ — the expansion's first score-2 move).
- [x] **AC-2 (band gate — mid-only):** `yoko-geri` at `band:"high"` degrades to idle ⇒ **0**, and at
      `band:"low"` ⇒ **0** (mid-only, unlike the roundhouse's high·mid gate).
- [x] **AC-3 (beyond-neutral reach — the signature):** at a gap between the roundhouse (300k) and
      `yoko-geri` (315k) — e.g. `startGap 310000` — `yoko-geri` scores **2** where `mawashi-geri`
      (300k) whiffs to **0** (documents `yoko-geri.reach > mawashi-geri.reach` **and** `> startGap` —
      the first move connecting where every existing move whiffs).
- [x] **AC-4 (gas-LOCKED — the first special the expansion adds):** a **gassed** fighter
      (`stamina ≤ gasThreshold 30`) can **no longer** commit `yoko-geri` — the commit degrades to idle
      ⇒ **0** (its cost 48 > 30, unlike the gas-proof hands). Property: `yoko-geri.staminaCost > gasThreshold`.
- [x] **AC-5 (kick → reverse finisher):** a `yoko-geri` that connects opens the cancel window; a
      `gyaku-zuki` started within it hit-confirms (kick → reverse, the unchanged category policy;
      situational — the 240k reverse only reaches when the kick landed within its reach).
- [x] **AC-6 (reverse → side kick — the cancel graph GROWS):** a connecting `gyaku-zuki` cancels
      **into** `yoko-geri` (the "reverse → any kick" policy now includes the new kick — the grown
      `gyaku-zuki.cancelInto` edge, spatially valid since the kick out-reaches the punch).
- [x] **AC-7 (TCB allowlist):** `validate` accepts `{type:"attack", move:"yoko-geri", band:"mid"}`
      **and** accepts it out-of-band (`band:"high"`) — band-legality is a runtime concern; the
      validator only checks the move id + band are well-formed.
- [x] **AC-8 (spec teaches the move + band):** regenerated `spec.md` lists `yoko-geri` in the
      attack-move line, the move-stats table (with `bands: mid` — the single-band call-out), and the
      JSON-schema `move` enum; `gen-spec` + schema drift tests stay green; `BENCHMARK_VERSION` v6 → v7.
- [x] **AC-9 (rule-path accepted):** `validate` accepts a bot using `rule("moves.yoko-geri.reach")`
      (and the other 5 paths); an unknown `moves.yoko-geri.bands` path is **rejected**. _(Slice 2)_
- [x] **AC-10 (reader returns the value):** the interpreter resolves `rule("moves.yoko-geri.reach")`
      to **315000**, `rule("moves.yoko-geri.staminaCost")` to **48**, and `rule("moves.yoko-geri.score")`
      to **2** against `CANONICAL_RULES`. _(Slice 2)_
- [x] **AC-11 (spec lists the paths):** regenerated `spec.md` lists the six `moves.yoko-geri.*` rule
      paths + the `rulePath` schema enum; drift tests green. _(Slice 2)_

**Deferred (NOT this feature):** the roster-wide no-Pareto-dominance property test (add once more of
Batch-1 lands, per `docs/move-roster.md`); the `vulture`/`sweeper` gauntlet rebalance (a separate
capability, folded into a family-level re-run once the kicks land).

## Slices

One slice = one PR. Each follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR. Load the project CLAUDE.md +
`tdd`/`testing`/`mutation-testing`/`refactoring` before any code.

### Slice 1: Bot can throw `yoko-geri` — the canonical beyond-neutral score-2 gas-locked kick — ✅ MERGED (PR #123)

**Value**: The bot author gets a mid-band _waza-ari_ zoning thrust that connects **past neutral** —
at a gap where even the roundhouse whiffs — trading tempo, band, cost, and the ippon ceiling for that
unique range. The first kick, first score-2, first gas-locked move of the expansion.
**Actor / Trigger / Outcome**: bot author / `{type:"attack", move:"yoko-geri", band}` / the fight
scores **2** on a clean `mid` hit in reach; **0** at `high`/`low` (out-of-band), where the roundhouse
whiffs but `yoko-geri` reaches, and when gassed; it cancels into `gyaku-zuki` and the reverse now
cancels into it.
**Path**: bot DSL `attack` → `dsl.ts` validate (`MOVES` admits `yoko-geri`) → `sim.ts` `intake`
reads `rules.moves["yoko-geri"]` → existing `bandLegal` + `affordable` (gas-lock) + `spec !== undefined`
gates → `startAttack` → existing `computeStrike`/`applyStrike` (`points: spec.score`) + cancel window
(both directions) → `result.scores`. **No new resolver code.**
**Production edits**:

1. `types.ts` — `MoveId` union `+ "yoko-geri"`; `Rules.moves` optional `"yoko-geri"?: MoveSpec`
   (type-only ⇒ no runtime mutants).
2. `dsl.ts` (TCB) — `"yoko-geri"` into the `MOVES` allowlist (the one mutable line).
3. `rules.ts` — **two** edits to `CANONICAL_RULES.moves`: (a) the canonical `yoko-geri` `MoveSpec`
   above; (b) extend `gyaku-zuki.cancelInto` with `"yoko-geri"` (the grown "reverse → any kick" edge).
4. `benchmark-config.ts` — `BENCHMARK_VERSION` v6 → v7; recompute `INPUT_HASH`.
5. `docs/spec.md` — `npm run gen:spec` (auto: move line, stats table row, JSON-schema `move` enum,
   embedded version/hash). The data-driven drift tests pin these.

**Required implementation skills**: before code, load `tdd`, `testing`, `mutation-testing`,
`refactoring`.
**Acceptance criteria**: AC-1 … AC-8. **Present to human and confirm before code.**
**RED** — failing tests first, mirroring the `mae-geri`/`shuto` behavioural block in `rules.test.ts`,
the validator-accept tests in `validate-bot.test.ts`, and the drift/version tests in
`gen-spec.test.ts` / `spec-schema.test.ts` / `benchmark-config.test.ts`:

- `rules.test.ts` (runFight vs `CANONICAL_RULES`): AC-1 (`mid` in reach ⇒ 2), AC-2 (`high` ⇒ 0 and
  `low` ⇒ 0), AC-3 (gap 310000 where `mawashi-geri` whiffs but `yoko-geri` lands ⇒ yoko 2 / roundhouse
  0; assert `yoko-geri.reach > mawashi-geri.reach` and `> 300000`), AC-4 (gassed fighter degrades ⇒ 0;
  assert `yoko-geri.staminaCost > gasThreshold` — mirror `DRAIN_THEN_THROW`), AC-5 (yoko→`gyaku-zuki`
  cancel hit-confirms), AC-6 (`gyaku-zuki`→yoko cancel hit-confirms — the grown edge).
- `validate-bot.test.ts`: AC-7 (accept `mid`; accept out-of-band `high`).
- `benchmark-config.test.ts`: AC-8 version guard — bump the version-assertion test to `v7` and re-pin
  `INPUT_HASH` (the guard goes RED on the `CANONICAL_RULES` change — the new spec **and** the grown
  cancelInto — until re-pinned; paste the printed hash).
- `gen-spec.test.ts` / `spec-schema.test.ts`: AC-8 drift — regenerated `spec.md` contains the
  `yoko-geri` row + `move`-enum entry; drift green after regen.

Mutator-awareness: the mutable production lines are the `MOVES` string literal (AC-7 kills
`"yoko-geri" → ""`), the new `yoko-geri` spec (AC-1's `=== 2` pins score, AC-4's `> gasThreshold` pins
cost, AC-3 pins `reach > mawashi-geri`/`> startGap` — kills a reach narrowing to ≤ 300k, AC-2 pins the
mid-only `bands` — kills a widening to include `high`/`low`), and the grown `gyaku-zuki.cancelInto`
array (AC-6 kills removing `"yoko-geri"`).
**GREEN**: the five additive edits above; nothing in `sim.ts`.
**MUTATE**: scope Stryker to `dsl.ts` (`MOVES`) + `rules.ts` (the new spec object **and** the grown
`gyaku-zuki.cancelInto`) + `benchmark-config.ts` (version/hash). `rm -rf .stryker-tmp` first. Confirm
100% on the changed lines.
**KILL MUTANTS**: strengthen only if a survivor appears; ask the human if a survivor's value is ambiguous.
**REFACTOR**: none expected (additive mirror of the arsenal pattern); assess via `refactoring`, skip if
no value.
**Done when**: AC-1…AC-8 green; full suite green (byte-identical for all non-`yoko-geri` paths);
`dsl.ts`/`rules.ts`/`benchmark-config.ts` mutation 100%; typecheck + lint + format clean; mutation
report reviewed; human approves commit.

### Slice 2: Bots can introspect `yoko-geri`'s frames via `rule("moves.yoko-geri.*")` — ✅ MERGED (PR #124)

**Value**: The bot author can read `yoko-geri`'s frames at runtime to write adaptive logic (e.g. gate
on `rule("moves.yoko-geri.reach")` to open at beyond-neutral spacing), the same as every other move.
**Actor / Trigger / Outcome**: bot author / a bot document using `{op:"rule",
path:"moves.yoko-geri.reach"}` / `validate` accepts it and the interpreter returns the canonical value
(315000).
**Path**: bot DSL `rule(path)` → `dsl.ts` `ALLOWED_RULES` (derived from the field-readers) admits the
path → interpreter reads `CANONICAL_RULES.moves["yoko-geri"].<field>`.
**Production edits**:

1. `dsl.ts` (TCB) — 6 field-readers `moves.yoko-geri.{startup,active,recovery,score,reach,
staminaCost}` in `RULE_READERS` (mirror the `uraken`/`shuto` readers, `?.`/`?? 0` for the optional
   key), which flow into `ALLOWED_RULES` / `RulePath`.
2. `docs/spec.md` — `npm run gen:spec` (auto: the `moves.yoko-geri.*` rule-path list + the `rulePath`
   enum). The data-driven drift tests pin these. **No `CANONICAL_RULES` change ⇒ no version bump.**

**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.
**Acceptance criteria**: AC-9 … AC-11. **Present and confirm before code.**
**RED**: `validate-bot.test.ts` — AC-9 (add the 6 `moves.yoko-geri.*` paths to the accept table; add
`moves.yoko-geri.bands` to the reject table); `interpret-tick.test.ts` — AC-10 (6 reader-value rows:
canonical `12/3/20/2/315000/48`, minimal-sentinel `0`; mutually distinct ⇒ wrong-field read caught);
`gen-spec.test.ts` / `spec-schema.test.ts` — AC-11 (data-driven drift goes RED on the reader add,
green after regen).
**GREEN**: the 6 readers + regen.
**MUTATE**: scope Stryker to the new `dsl.ts` reader lines; expect path-string + `?? 0` mutants,
killed by AC-9/AC-10. Confirm `dsl.ts` 100%.
**KILL MUTANTS / REFACTOR**: as Slice 1 (none expected).
**Done when**: AC-9…AC-11 green; full suite green; `dsl.ts` mutation 100%; typecheck + lint + format
clean; report reviewed; human approves commit.

> **Slice-count note:** Slices 1 + 2 MAY be merged into a single "fully-wired `yoko-geri`" PR, but the
> recommended path keeps them split, as `uraken` (#117/#118) and `shuto` (#120/#121) shipped — each is
> independently deployable and reviewable. **Your call.**

## Pre-PR Quality Gate

Before each PR:

1. Mutation testing — `mutation-testing` skill, scoped to the changed `dsl.ts` / `rules.ts` /
   `benchmark-config.ts` lines (`types.ts` is type-only; `sim.ts` untouched). `rm -rf .stryker-tmp` first.
2. Refactoring assessment — `refactoring` skill (expected: no change).
3. `npm run typecheck` + `npm run lint` + `npm run format:check` pass; `spec.md` regenerated and drift-clean.
4. On feature completion: update `docs/move-roster.md` (mark `yoko-geri` shipped, PR #) and
   `docs/STATUS.md`; the family-level `vulture`/`sweeper` gauntlet re-run stays deferred until the
   Batch-1 kick family lands.

---

_When both slices are merged, **archive** this file under `docs/archive/` (add a README index entry
under the existing "Batch-1 arsenal expansion" section) — **do not delete it**. The record also lives
in the PRs + `docs/move-roster.md`._
