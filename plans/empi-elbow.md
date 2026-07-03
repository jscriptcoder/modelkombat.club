# Plan: `empi` (elbow) — Batch-1 move #5

**Branch**: feat/empi-elbow (Slice 1) · feat/empi-rule-readers (Slice 2)
**Status**: Active — Slice 1 not started
**Design source**: `docs/move-roster.md` (Batch-1 resolved frame data; balance law + policies)

## Goal

The bot can throw `empi` (elbow) — the **first close-range strike of the expansion** and the
**shortest reach in the game**: `reach 95000` sits **below the throw (120000)**, opening a new
**infighting zone** inside grappling range. It scores **2** (_waza-ari_) at `high·mid` — the
deliberate close-range exception to the hand score-cap — paid for by the shortest reach (whiffs where
every other move connects), a gas-locked cost (`38`), and moderate commitment. Wired into
`CANONICAL_RULES` and taught in `spec.md`.

## Context — why this is small and additive (the `uraken`/`shuto` pattern)

Post-C9 the arsenal is canonical and the `sim.ts` resolver is fully **generic**
(`rules.moves[action.move]` + `bandLegal` + `affordable` + `spec !== undefined`), so a new move is
**pure data + allowlist**, no resolver code — exactly as `uraken` (#1), `shuto` (#2), `yoko-geri` (#3)
and `ushiro-geri` (#4) shipped. `empi` reuses only already-proven mechanics driven by new data:

- **Score-2 (_waza-ari_) close-range strike** — `computeStrike` awards `spec.score` directly;
  `mae-geri`/`mawashi-geri`/`yoko-geri` already prove a 2-point strike. Design-wise `empi` is an
  `uchi` scoring 2, the **deliberate exception** to the hand-cap (close-range is its own category);
  mechanically it is just a `MoveSpec` with `score: 2` — no code branch.
- **Gas-LOCKED (`staminaCost 38 > gasThreshold 30`)** — the `affordable` gate already locks out
  specials when gassed. A gassed fighter can **no longer** throw `empi` (behavioural precedent: the
  `DRAIN_THEN_THROW` / `DRAIN_THEN_YOKO` bots in `rules.test.ts` — a special degrades to idle once its
  cost exceeds the gassed reserve).
- **`high·mid` band gate, flat score 2** — `bandLegal` admits only the listed bands; `mawashi-geri`
  already proves the high·mid case. **Unlike `ushiro-geri`/`mawashi-geri`, `empi` carries NO
  `scoreByBand`** — it scores a flat **2** at both `high` and `mid` (no jodan ippon bonus), and **0**
  at `low` (out of band). This flatness is the distinguishing detail from the jodan kicks.
- **Cancel SOURCE only** — `empi`'s `cancelInto:["gyaku-zuki"]` makes it a rekka source
  (close strike → reverse finisher, situational at ≤240k, the unchanged "close strike → `gyaku-zuki`"
  category policy). **Unlike `yoko-geri`/`ushiro-geri`, `empi` is NOT a cancel target** — the derived
  cancel graph grows `gyaku-zuki.cancelInto` for the **kicks only**, not the close strikes. So there is
  **no `gyaku-zuki.cancelInto` growth** — `empi`'s production footprint is the smaller `uraken`/`shuto`
  shape (one `rules.ts` spec edit), not the two-edit `yoko`/`ushiro` shape.

**The signature trait — the shortest reach in the game (the infighting floor).** Reach ladder around
`empi`: **`empi` 95k** < `hiza-geri` 110k (not yet built) < `throw` 120k < everything else. It is the
first technique whose reach sits **below the throw** — it whiffs at spacings where **every** existing
move (down to the throw itself) still connects, and only lands point-blank, the reward for braving
throw range. Its no-Pareto trade made concrete: it pushes **score up** for a hand-category strike (2
vs the hand-cap of 1) and pays with the **shortest reach** (95k, whiffs everywhere but point-blank), a
**gas-locked** cost (38 > 30), and moderate commitment. Dominance-free vs `mae-geri` (also score 2): it
trades ~175k of reach down for its point-blank access, so neither dominates.

> **Inside-game note (design, not a cancel).** The intended elbow ↔ throw **mixup** lives at the
> **neutral action-choice** level, not as a combo: `sim.ts` fires a cancel only for an `attack`-type
> follow-up in `cancelInto: MoveId[]`, and `throw` is neither an `attack` action nor a `MoveId`, so
> `empi → throw` is **not expressible** in Batch 1 (per `docs/move-roster.md`). This plan does **not**
> attempt it; a throw-cancel is deferred engine work.

**Canonical `empi` spec** (from `docs/move-roster.md`):

```ts
"empi": { startup: 8, active: 2, recovery: 14, score: 2,
          reach: 95000, bands: ["high", "mid"], staminaCost: 38,
          cancelInto: ["gyaku-zuki"] }
```

**No edit to `gyaku-zuki.cancelInto`** (empi is source-only — a close strike, not a kick).

`spec.md` is **generated** (`npm run gen:spec`): the move table row, the JSON-schema `move` enum
(`[...MOVES]`), and — in Slice 2 — the `rule(path)` list all derive from `MOVES`, `CANONICAL_RULES`,
and the field-readers. No hand-editing of `spec.md`.

## Benchmark impact (the `uraken`/`shuto` finding, restated)

Wiring `empi` into `CANONICAL_RULES` (a new scoring-input spec) flips the benchmark `INPUT_HASH` ⇒
**Slice 1 bumps `BENCHMARK_VERSION` v8 → v9** (recompute `INPUT_HASH`, update the guard +
version-assertion tests in `benchmark-config.test.ts`). **Slice 2 adds no `CANONICAL_RULES` field**
(readers only) ⇒ `INPUT_HASH` stable ⇒ **no bump**. The 6 frozen gauntlet bots don't reference `empi`,
so their round-robin outcomes stay byte-identical under v9 (no gauntlet re-characterization).

## Acceptance Criteria

Behaviour proven by `runFight` against `CANONICAL_RULES` (engine), `validate` (TCB), and the
`gen-spec` / schema drift tests (spec). Observable score/accept assertions, not literals alone.

- [ ] **AC-1 (waza-ari — point-blank):** a clean `empi` within reach (point-blank) scores **2**
      (close-range _waza-ari_ — the first close strike of the expansion).
- [ ] **AC-2 (band gate — high·mid, flat 2):** `empi` scores **2** at `band:"high"` **and** **2** at
      `band:"mid"` (flat — **no** jodan bonus, unlike `ushiro-geri`), and degrades to idle ⇒ **0** at
      `band:"low"` (out of band).
- [ ] **AC-3 (shortest reach — the signature / infighting floor):** at a gap between `empi` (95k) and
      the `throw` (120k) — e.g. `startGap 100000` — `empi` whiffs to **0** where a `throw` connects ⇒
      **3** (documents `empi.reach < throw.reach` — the new infighting floor, the shortest reach in the
      game, connecting only point-blank).
- [ ] **AC-4 (gas-LOCKED):** a **gassed** fighter (`stamina ≤ gasThreshold 30`) can **no longer**
      commit `empi` — the commit degrades to idle ⇒ **0** (its cost 38 > 30, like the kicks). Property:
      `empi.staminaCost > gasThreshold`.
- [ ] **AC-5 (close strike → reverse finisher):** an `empi` that connects opens the cancel window; a
      `gyaku-zuki` started within it hit-confirms (empi → reverse, the "close strike → `gyaku-zuki`"
      category policy; situational — the 240k reverse only reaches when the elbow landed within its
      reach). _(empi is a cancel **source only** — there is no reverse → empi edge.)_
- [ ] **AC-6 (TCB allowlist):** `validate` accepts `{type:"attack", move:"empi", band:"mid"}` **and**
      accepts it out-of-band (`band:"low"`) — band-legality is a runtime concern; the validator only
      checks the move id + band are well-formed.
- [ ] **AC-7 (spec teaches the move + bands):** regenerated `spec.md` lists `empi` in the attack-move
      line, the move-stats table (with `bands: high/mid` and the shortest `reach`), and the JSON-schema
      `move` enum; `gen-spec` + schema drift tests stay green; `BENCHMARK_VERSION` v8 → v9.
- [ ] **AC-8 (rule-path accepted):** `validate` accepts a bot using `rule("moves.empi.reach")` (and the
      other 5 paths); an unknown `moves.empi.bands` path is **rejected**. _(Slice 2)_
- [ ] **AC-9 (reader returns the value):** the interpreter resolves `rule("moves.empi.reach")` to
      **95000**, `rule("moves.empi.staminaCost")` to **38**, and `rule("moves.empi.score")` to **2**
      against `CANONICAL_RULES`. _(Slice 2)_
- [ ] **AC-10 (spec lists the paths):** regenerated `spec.md` lists the six `moves.empi.*` rule paths +
      the `rulePath` schema enum; drift tests green. _(Slice 2)_

**Deferred (NOT this feature):** the roster-wide no-Pareto-dominance property test (add once Batch-1
lands, per `docs/move-roster.md`); the `vulture`/`sweeper` gauntlet rebalance (a separate capability,
folded into a family-level re-run once the close-range family lands); the elbow ↔ throw cancel (not
expressible in Batch 1 — deferred engine work).

## Slices

One slice = one PR. Each follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR. Load the project CLAUDE.md +
`tdd`/`testing`/`mutation-testing`/`refactoring` before any code.

### Slice 1: Bot can throw `empi` — the canonical shortest-reach score-2 gas-locked close strike

**Value**: The bot author gets a point-blank _waza-ari_ that only lands inside throw range — a new
infighting tool that scores kick-tier points from the hands, trading all reach for that access. The
first close-range strike of the expansion.
**Actor / Trigger / Outcome**: bot author / `{type:"attack", move:"empi", band}` / the fight scores
**2** on a clean `high`/`mid` hit point-blank; **0** at `low` (out-of-band), where a throw connects but
`empi` whiffs at 100k, and when gassed; it cancels into `gyaku-zuki` (source only).
**Path**: bot DSL `attack` → `dsl.ts` validate (`MOVES` admits `empi`) → `sim.ts` `intake` reads
`rules.moves["empi"]` → existing `bandLegal` + `affordable` (gas-lock) + `spec !== undefined` gates →
`startAttack` → existing `computeStrike`/`applyStrike` (`points: spec.score`) + cancel window (source
only) → `result.scores`. **No new resolver code.**
**Production edits**:

1. `types.ts` — `MoveId` union `+ "empi"`; `Rules.moves` optional `"empi"?: MoveSpec` (type-only ⇒ no
   runtime mutants). Update the `MoveId` doc comment to describe the shortest-reach infighting elbow.
2. `dsl.ts` (TCB) — `"empi"` into the `MOVES` allowlist (the one mutable line).
3. `rules.ts` — **one** edit to `CANONICAL_RULES.moves`: the canonical `empi` `MoveSpec` above. **No
   `gyaku-zuki.cancelInto` growth** (empi is source-only) — this is the smaller `uraken`/`shuto`
   footprint.
4. `benchmark-config.ts` — `BENCHMARK_VERSION` v8 → v9; recompute `INPUT_HASH`.
5. `docs/spec.md` — `npm run gen:spec` (auto: move line, stats table row, JSON-schema `move` enum,
   embedded version/hash). The data-driven drift tests pin these.

**Required implementation skills**: before code, load `tdd`, `testing`, `mutation-testing`,
`refactoring`.
**Acceptance criteria**: AC-1 … AC-7. **Present to human and confirm before code.**
**RED** — failing tests first, mirroring the `yoko-geri`/`mawashi-geri` behavioural block in
`rules.test.ts`, the validator-accept tests in `validate-bot.test.ts`, and the drift/version tests in
`gen-spec.test.ts` / `spec-schema.test.ts` / `benchmark-config.test.ts`:

- `rules.test.ts` (runFight vs `CANONICAL_RULES`): AC-1 (`mid`/`high` in reach ⇒ 2), AC-2 (`high` ⇒ 2,
  `mid` ⇒ 2, `low` ⇒ 0 — flat, no jodan bonus; assert `empi().scoreByBand` is `undefined` to pin the
  flatness vs `ushiro-geri`), AC-3 (gap 100000 where `empi` whiffs but a `throw` lands ⇒ empi 0 / throw
  3; assert `empi().reach < throw().reach` and `< 120000`), AC-4 (gassed fighter degrades ⇒ 0; assert
  `empi().staminaCost > gasThreshold` — mirror `DRAIN_THEN_THROW`), AC-5 (empi → `gyaku-zuki` cancel
  hit-confirms).
- `validate-bot.test.ts`: AC-6 (accept `mid`; accept out-of-band `low`).
- `benchmark-config.test.ts`: AC-7 version guard — bump the version-assertion test to `v9` and re-pin
  `INPUT_HASH` (the guard goes RED on the `CANONICAL_RULES` change until re-pinned; paste the printed
  hash).
- `gen-spec.test.ts` / `spec-schema.test.ts`: AC-7 drift — regenerated `spec.md` contains the `empi`
  row + `move`-enum entry; drift green after regen.

Mutator-awareness: the mutable production lines are the `MOVES` string literal (AC-6 kills
`"empi" → ""`) and the new `empi` spec (AC-1's `=== 2` pins score, AC-4's `> gasThreshold` pins cost,
AC-3 pins `reach < throw`/`< 120000` — kills a reach widening past the throw, AC-2 pins the high·mid
`bands` — kills a widening to include `low` or a narrowing that drops `high`/`mid`, and pins the
**absence** of `scoreByBand` — kills a mutant adding a jodan bonus).
**GREEN**: the five additive edits above; nothing in `sim.ts`.
**MUTATE**: scope Stryker to `dsl.ts` (`MOVES`) + `rules.ts` (the new `empi` spec object) +
`benchmark-config.ts` (version/hash). `rm -rf .stryker-tmp` first. Confirm 100% on the changed lines.
(Note: `rules.ts` numeric literals generate no Stryker mutants — they are pinned by the `INPUT_HASH`
guard, not mutation; the behavioural ACs pin them observably.)
**KILL MUTANTS**: strengthen only if a survivor appears; ask the human if a survivor's value is
ambiguous. **No `scoreByBand` reader in this move ⇒ the `ushiro-geri` inner-`?.` guard test is NOT
needed** (empi has a 6-reader Slice 2).
**REFACTOR**: none expected (additive mirror of the arsenal pattern); assess via `refactoring`, skip if
no value.
**Done when**: AC-1…AC-7 green; full suite green (byte-identical for all non-`empi` paths);
`dsl.ts`/`rules.ts`/`benchmark-config.ts` mutation 100%; typecheck + lint + format clean; mutation
report reviewed; human approves commit.

### Slice 2: Bots can introspect `empi`'s frames via `rule("moves.empi.*")`

**Value**: The bot author can read `empi`'s frames at runtime to write adaptive logic (e.g. gate on
`rule("moves.empi.reach")` to only commit the elbow at point-blank spacing), the same as every other
move.
**Actor / Trigger / Outcome**: bot author / a bot document using `{op:"rule", path:"moves.empi.reach"}`
/ `validate` accepts it and the interpreter returns the canonical value (95000).
**Path**: bot DSL `rule(path)` → `dsl.ts` `ALLOWED_RULES` (derived from the field-readers) admits the
path → interpreter reads `CANONICAL_RULES.moves["empi"].<field>`.
**Production edits**:

1. `dsl.ts` (TCB) — **6** field-readers `moves.empi.{startup,active,recovery,score,reach,staminaCost}`
   in `RULE_READERS` (mirror the `uraken`/`shuto`/`yoko-geri` readers, `?.`/`?? 0` for the optional
   key), which flow into `ALLOWED_RULES` / `RulePath`. **No `scoreByBand.high` reader** (empi has no
   `scoreByBand`) ⇒ a clean 6-reader add, no guard test.
2. `docs/spec.md` — `npm run gen:spec` (auto: the `moves.empi.*` rule-path list + the `rulePath` enum).
   The data-driven drift tests pin these. **No `CANONICAL_RULES` change ⇒ no version bump.**

**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.
**Acceptance criteria**: AC-8 … AC-10. **Present and confirm before code.**
**RED**: `validate-bot.test.ts` — AC-8 (add the 6 `moves.empi.*` paths to the accept table; add
`moves.empi.bands` to the reject table); `interpret-tick.test.ts` — AC-9 (6 reader-value rows:
canonical `8/2/14/2/95000/38`, minimal-sentinel `0`; mutually distinct ⇒ wrong-field read caught);
`gen-spec.test.ts` / `spec-schema.test.ts` — AC-10 (data-driven drift goes RED on the reader add, green
after regen).
**GREEN**: the 6 readers + regen.
**MUTATE**: scope Stryker to the new `dsl.ts` reader lines; expect path-string + `?? 0` mutants, killed
by AC-8/AC-9. Confirm `dsl.ts` 100%.
**KILL MUTANTS / REFACTOR**: as Slice 1 (none expected).
**Done when**: AC-8…AC-10 green; full suite green; `dsl.ts` mutation 100%; typecheck + lint + format
clean; report reviewed; human approves commit.

> **Slice-count note:** Slices 1 + 2 MAY be merged into a single "fully-wired `empi`" PR, but the
> recommended path keeps them split, as `uraken` (#117/#118), `shuto` (#120/#121), `yoko-geri`
> (#123/#124), and `ushiro-geri` (#126/#127) shipped — each is independently deployable and reviewable.
> **Your call.**

## Pre-PR Quality Gate

Before each PR:

1. Mutation testing — `mutation-testing` skill, scoped to the changed `dsl.ts` / `rules.ts` /
   `benchmark-config.ts` lines (`types.ts` is type-only; `sim.ts` untouched). `rm -rf .stryker-tmp`
   first.
2. Refactoring assessment — `refactoring` skill (expected: no change).
3. `npm run typecheck` + `npm run lint` + `npm run format:check` pass; `spec.md` regenerated and
   drift-clean.
4. On feature completion: update `docs/move-roster.md` (mark `empi` shipped, PR #) and
   `docs/STATUS.md`; the family-level `vulture`/`sweeper` gauntlet re-run stays deferred until the
   Batch-1 close-range family (`empi` + `hiza-geri`) lands.

---

_When both slices are merged, **archive** this file under `docs/archive/` (add a README index entry
under the existing "Batch-1 arsenal expansion" section) — **do not delete it**. The record also lives
in the PRs + `docs/move-roster.md`._
