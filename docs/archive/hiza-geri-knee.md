# Plan: `hiza-geri` (knee) — Batch-1 move #6 (the last grounded move)

**Branch**: feat/hiza-geri-knee (Slice 1) · feat/hiza-geri-rule-readers (Slice 2)
**Status**: ✅ **COMPLETE** — Slice 1 MERGED (PR #132, benchmark v10) · Slice 2 MERGED (PR #133, no bump)
**Design source**: `docs/move-roster.md` (Batch-1 resolved frame data; balance law + policies)

## Goal

The bot can throw `hiza-geri` (knee) — the **last grounded move of Batch 1** and the **only
mid-band _standing_ knockdown → okizeme technique**. A clean point-blank `hiza-geri` at `mid`
scores **0** but **downs** the foe (`knockdown: true`); the points live in the **okizeme finish**
(`hiza-geri → gyaku-zuki` cancel inside `finishWindow` ⇒ `finishScore` **3**) — the sweep's
score-0 → 3-finish shape, lifted out of the low band into a **standing, point-blank** knockdown.
Its `reach 110000` sits **between `empi` (95000) and the `throw` (120000)** — the second-shortest
reach in the game, deep inside the new infighting zone. Wired into `CANONICAL_RULES` and taught in
`spec.md`.

## Context — why this is small and additive (the `empi`/`sweep` pattern)

Post-C9 the arsenal is canonical and the `sim.ts` resolver is fully **generic**
(`rules.moves[action.move]` + `bandLegal` + `affordable` + `spec !== undefined`), so a new move is
**pure data + allowlist**, no resolver code — exactly as `uraken` (#1), `shuto` (#2), `yoko-geri`
(#3), `ushiro-geri` (#4) and `empi` (#5) shipped. `hiza-geri` reuses only already-proven mechanics
driven by new data — and, uniquely for this move, the **built C8 knockdown + okizeme machinery**:

- **Knockdown → okizeme finish (score 0 → 3), the SIGNATURE** — `knockdown: true` drives the
  existing down-state; a clean hit scores its `score` (**0**) and the points come from the finish.
  The finish is **global**: any knockdown that opens the cancel window and is hit-confirmed with a
  follow-up **inside `finishWindow` (10)** pays `finishScore` (**3**), bounded by
  `knockdownDuration` (18). The **sweep already proves this entire path** (`sweep → gyaku-zuki`
  okizeme finisher) — `hiza-geri` reuses `finishScore` / `finishWindow` / `knockdownDuration`
  **verbatim**: **no new engine field, no `sim.ts` change**. The only novelty is _where_ the
  knockdown comes from — a **mid-band standing** knee, not a low sweep.
- **Mid-band standing knockdown (not occupancy-banded)** — unlike the `sweep` (which has **no**
  `bands` field and is low via occupancy), `hiza-geri` carries an explicit `bands: ["mid"]` and
  gates through the standard `bandLegal` path (like `mae-geri`). So it downs a foe in the **neutral
  standing posture** (mid occupancy) — simpler than the sweep's low-occupancy requirement, and out
  of band (`high`/`low`) it silently degrades to idle (no knockdown, 0), the WKF-faithful policy.
- **Gas-LOCKED (`staminaCost 40 > gasThreshold 30`)** — the `affordable` gate already locks out
  specials when gassed. A gassed fighter can **no longer** commit `hiza-geri` (behavioural
  precedent: the `DRAIN_THEN_THROW` / `DRAIN_THEN_EMPI` bots in `rules.test.ts` — a special degrades
  to idle once its cost exceeds the gassed reserve). Cost 40 mirrors the `throw`/`sweep` special
  tier — fitting, as `hiza-geri` is the standing analogue of the sweep's knockdown.
- **Cancel SOURCE only** — `hiza-geri`'s `cancelInto:["gyaku-zuki"]` makes it a rekka source
  (the okizeme finisher; the unchanged "close strike → `gyaku-zuki`" / "sweep → `gyaku-zuki`"
  category policy). **Like `empi` and unlike the kicks, `hiza-geri` is NOT a cancel target** — the
  derived cancel graph grows `gyaku-zuki.cancelInto` for the **kicks only**, not the close strikes.
  So there is **no `gyaku-zuki.cancelInto` growth** — `hiza-geri`'s production footprint is the
  smaller `empi`/`uraken`/`shuto` shape (**one** `rules.ts` spec edit), not the two-edit
  `yoko`/`ushiro` shape.

**The distinguishing trait vs `empi` (the other close strike).** Both are point-blank score-0…2
infighting tools below the throw, gas-locked, cancel-source-only. They differ on the **payoff
shape**: `empi` scores a **flat 2** (waza-ari) on the hit itself (no knockdown); `hiza-geri` scores
**0** on the hit but **downs** the foe for a **3-point okizeme finish**. The RED must pin this
difference — `hiza-geri().score === 0`, `hiza-geri().knockdown === true`, and the finish pays 3;
and it carries **no `scoreByBand`** (assert `undefined`), distinguishing it from the jodan kicks.

**The reach signature — the second-shortest reach (the infighting floor's next rung).** Reach
ladder around `hiza-geri`: `empi` 95k < **`hiza-geri` 110k** < `throw` 120k < `sweep` 180k <
everything else. It is the second technique whose reach sits **below the throw** — it whiffs at
spacings where the `throw` still connects, and only lands point-blank. Its no-Pareto trade made
concrete: vs the `sweep` (also a score-0 → 3 knockdown) it trades ~70k of reach **down** and the
low band **up** to mid (standing), paying its point-blank access for a standing knockdown angle, so
neither dominates.

> **Inside-game note (design, not a cancel).** As with `empi`, the intended knee ↔ throw **mixup**
> lives at the **neutral action-choice** level, not as a combo: `sim.ts` fires a cancel only for an
> `attack`-type follow-up in `cancelInto: MoveId[]`, and `throw` is neither an `attack` action nor a
> `MoveId`, so `hiza-geri → throw` is **not expressible** in Batch 1 (per `docs/move-roster.md`).
> This plan does **not** attempt it; a throw-cancel is deferred engine work.

**Canonical `hiza-geri` spec** (from `docs/move-roster.md`):

```ts
"hiza-geri": { startup: 9, active: 2, recovery: 16, score: 0,
               reach: 110000, bands: ["mid"], staminaCost: 40,
               knockdown: true, cancelInto: ["gyaku-zuki"] }
```

**No edit to `gyaku-zuki.cancelInto`** (hiza-geri is source-only — a close strike, not a kick).
**No new global constant** (`finishScore` / `finishWindow` / `knockdownDuration` already exist and
are unchanged).

`spec.md` is **generated** (`npm run gen:spec`): the move table row, the JSON-schema `move` enum
(`[...MOVES]`), and — in Slice 2 — the `rule(path)` list all derive from `MOVES`, `CANONICAL_RULES`,
and the field-readers. No hand-editing of `spec.md`.

## Benchmark impact (the roster-expansion finding, restated)

Wiring `hiza-geri` into `CANONICAL_RULES` (a new scoring-input spec) flips the benchmark
`INPUT_HASH` ⇒ **Slice 1 bumps `BENCHMARK_VERSION` v9 → v10** (recompute `INPUT_HASH`, update the
guard + version-assertion tests in `benchmark-config.test.ts`). **Slice 2 adds no `CANONICAL_RULES`
field** (readers only) ⇒ `INPUT_HASH` stable ⇒ **no bump**. The 6 frozen gauntlet bots don't
reference `hiza-geri`, so their round-robin outcomes stay byte-identical under v10 (no gauntlet
re-characterization).

## Acceptance Criteria

Behaviour proven by `runFight` against `CANONICAL_RULES` (engine), `validate` (TCB), and the
`gen-spec` / schema drift tests (spec). Observable score/knockdown/accept assertions, not literals
alone.

- [x] **AC-1 (knockdown, scores 0 — the standing down):** a clean point-blank `hiza-geri` at
      `band:"mid"` **downs** the foe (freezes it for the knockdown, like the sweep) and scores **0**
      on the hit — the points live in the finish. Pins `hiza-geri().score === 0` and
      `hiza-geri().knockdown === true`.
- [x] **AC-2 (band gate — mid only):** `hiza-geri` at `band:"mid"` downs/commits; at `band:"high"`
      and `band:"low"` it degrades to idle ⇒ **0**, no knockdown (out of band). Pins
      `hiza-geri().bands` is exactly `["mid"]` and asserts `hiza-geri().scoreByBand` is `undefined`
      (no jodan bonus — distinct from the kicks).
- [x] **AC-3 (second-shortest reach — the infighting floor):** at a gap in `(110000, 120000]` — e.g.
      `startGap 115000` — `hiza-geri` whiffs to **0** (no knockdown) where a `throw` connects ⇒
      **3**. Documents `empi.reach < hiza-geri.reach < throw.reach` (asserts
      `hiza-geri().reach > empi().reach` **and** `hiza-geri().reach < throwSpec().reach`, i.e. 110k ∈
      (95k, 120k) — the second technique below the throw, landing only point-blank).
- [x] **AC-4 (gas-LOCKED):** a **gassed** fighter (`stamina ≤ gasThreshold 30`) can **no longer**
      commit `hiza-geri` — the commit degrades to idle ⇒ **0**, no knockdown (cost 40 > 30, like the
      throw/sweep/kicks). Property: `hiza-geri().staminaCost > gasThreshold`.
- [x] **AC-5 (okizeme finish — THE signature, 3 hit-confirmed):** a `hiza-geri` that connects downs
      the foe and opens the cancel window; a `gyaku-zuki` started **inside `finishWindow`**
      hit-confirms the **finish** ⇒ scores `finishScore` (**3**) — the standing-knee okizeme, the
      sweep's finish path lifted to mid. Pins `hiza-geri().cancelInto` contains `"gyaku-zuki"`,
      `hiza-geri().knockdown === true`, `hiza-geri().score === 0`. _(hiza-geri is a cancel **source
      only** — there is no `gyaku-zuki → hiza-geri` edge; assert
      `gyaku().cancelInto` does **not** contain `"hiza-geri"`.)_
- [x] **AC-6 (TCB allowlist):** `validate` accepts `{type:"attack", move:"hiza-geri", band:"mid"}`
      **and** accepts it out-of-band (`band:"high"`) — band-legality is a runtime concern; the
      validator only checks the move id + band are well-formed.
- [x] **AC-7 (spec teaches the move + band):** regenerated `spec.md` lists `hiza-geri` in the
      attack-move line, the move-stats table (with `bands: mid`, `reach 110000`, `score 0`), and the
      JSON-schema `move` enum; `gen-spec` + schema drift tests stay green; `BENCHMARK_VERSION`
      v9 → v10.
- [x] **AC-8 (rule-path accepted):** `validate` accepts a bot using `rule("moves.hiza-geri.reach")`
      (and the other 5 paths); an unknown `moves.hiza-geri.knockdown` **and** `moves.hiza-geri.bands`
      path are **rejected** (neither is a reader). _(Slice 2)_
- [x] **AC-9 (reader returns the value):** the interpreter resolves `rule("moves.hiza-geri.reach")`
      to **110000**, `rule("moves.hiza-geri.staminaCost")` to **40**, and
      `rule("moves.hiza-geri.score")` to **0** against `CANONICAL_RULES`. _(Slice 2)_
- [x] **AC-10 (spec lists the paths):** regenerated `spec.md` lists the six `moves.hiza-geri.*` rule
      paths + the `rulePath` schema enum; drift tests green. _(Slice 2)_

**Deferred (NOT this feature):** the roster-wide no-Pareto-dominance property test (add once Batch-1
lands — this move completes Batch 1, so that property test is the **immediate next** work after this
close-out, per `docs/move-roster.md`); the `vulture`/`sweeper` gauntlet rebalance (a separate
capability, folded into a family-level re-run once the close-range family — `empi` + `hiza-geri` —
has landed); the knee ↔ throw cancel (not expressible in Batch 1 — deferred engine work).

## Slices

One slice = one PR. Each follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR. Load the project CLAUDE.md +
`tdd`/`testing`/`mutation-testing`/`refactoring` before any code.

### Slice 1: Bot can throw `hiza-geri` — the canonical mid-band standing knockdown → okizeme knee — ✅ MERGED (PR #132)

**Value**: The bot author gets a point-blank **standing** knockdown that scores nothing on the hit
but sets up a guaranteed 3-point okizeme finish — the sweep's knockdown game lifted out of the low
band into a mid, point-blank angle. The last grounded tool of Batch 1.
**Actor / Trigger / Outcome**: bot author / `{type:"attack", move:"hiza-geri", band}` / a clean
`mid` hit point-blank **downs** the foe for **0**, then a `gyaku-zuki` in the finish window pays
**3**; **0**/no-knockdown at `high`/`low` (out-of-band), where a throw connects but `hiza-geri`
whiffs at 115k, and when gassed.
**Path**: bot DSL `attack` → `dsl.ts` validate (`MOVES` admits `hiza-geri`) → `sim.ts` `intake`
reads `rules.moves["hiza-geri"]` → existing `bandLegal` + `affordable` (gas-lock) +
`spec !== undefined` gates → `startAttack` → existing `computeStrike`/`applyStrike`
(`points: spec.score` = 0; `knockdown` down-state) + cancel window (source only) + the existing
`finishWindow`/`finishScore` okizeme path → `result.scores`. **No new resolver code, no new global
constant.**
**Production edits**:

1. `types.ts` — `MoveId` union `+ "hiza-geri"`; `Rules.moves` optional `"hiza-geri"?: MoveSpec`
   (type-only ⇒ no runtime mutants). Update the `MoveId` doc comment to describe the mid-band
   standing knockdown knee.
2. `dsl.ts` (TCB) — `"hiza-geri"` into the `MOVES` allowlist (the one mutable line).
3. `rules.ts` — **one** edit to `CANONICAL_RULES.moves`: the canonical `hiza-geri` `MoveSpec` above
   (`score: 0`, `knockdown: true`, `bands: ["mid"]`, `cancelInto: ["gyaku-zuki"]`). **No
   `gyaku-zuki.cancelInto` growth** (hiza-geri is source-only) — the smaller `empi` footprint. **No
   global-constant change** (`finishScore`/`finishWindow`/`knockdownDuration` reused as-is).
4. `benchmark-config.ts` — `BENCHMARK_VERSION` v9 → v10; recompute `INPUT_HASH`.
5. `docs/spec.md` — `npm run gen:spec` (auto: move line, stats table row, JSON-schema `move` enum,
   embedded version/hash). The data-driven drift tests pin these.

**Required implementation skills**: before code, load `tdd`, `testing`, `mutation-testing`,
`refactoring`.
**Acceptance criteria**: AC-1 … AC-7. **Present to human and confirm before code.**
**RED** — failing tests first, mirroring the `sweep` okizeme block **and** the `empi`/`yoko-geri`
behavioural blocks in `rules.test.ts`, the validator-accept tests in `validate-bot.test.ts`, and the
drift/version tests in `gen-spec.test.ts` / `spec-schema.test.ts` / `benchmark-config.test.ts`.
Extend the `armed(...)` union with `"hiza-geri"` and add a `hizaGeri` helper (mirror `empi`):

- `rules.test.ts` (runFight vs `CANONICAL_RULES`): AC-1 (point-blank `mid` ⇒ downs foe + scores 0;
  mirror the sweep's "downs a grounded foe for no score" test but **mid-band, point-blank** and a
  neutral standing target), AC-2 (`mid` commits, `high`/`low` ⇒ 0/no-knockdown; assert
  `hizaGeri().bands` is `["mid"]` and `hizaGeri().scoreByBand` is `undefined`), AC-3 (gap 115000
  where `hiza-geri` whiffs but a `throw` lands ⇒ hiza-geri 0 / throw 3; assert
  `empi().reach < hizaGeri().reach < throwSpec().reach`), AC-4 (gassed fighter degrades ⇒ 0; assert
  `hizaGeri().staminaCost > gasThreshold` — add a `DRAIN_THEN_HIZA` bot mirroring `DRAIN_THEN_EMPI`),
  AC-5 (hiza-geri connects → `gyaku-zuki` inside `finishWindow` ⇒ **3**; mirror the
  `sweep → cancel → okizeme finish (3)` test, adjusting the reach/spacing to the 110k knee; assert
  `hizaGeri().cancelInto` contains `"gyaku-zuki"`, `hizaGeri().knockdown === true`,
  `hizaGeri().score === 0`, and `gyaku().cancelInto` does **not** contain `"hiza-geri"`).
- `validate-bot.test.ts`: AC-6 (accept `mid`; accept out-of-band `high`).
- `benchmark-config.test.ts`: AC-7 version guard — bump the version-assertion test to `v10` and
  re-pin `INPUT_HASH` (the guard goes RED on the `CANONICAL_RULES` change until re-pinned; paste the
  printed hash).
- `gen-spec.test.ts` / `spec-schema.test.ts`: AC-7 drift — regenerated `spec.md` contains the
  `hiza-geri` row + `move`-enum entry; drift green after regen.

Mutator-awareness: the mutable production lines are the `MOVES` string literal (AC-6 kills
`"hiza-geri" → ""`) and the new `hiza-geri` spec (AC-1's `knockdown === true` + `score === 0` pin the
down-state and no-score, AC-5's finish pins the okizeme route, AC-4's `> gasThreshold` pins cost,
AC-3 pins `empi.reach < reach < throw.reach` — kills a reach widening past the throw or shrinking
below empi, AC-2's `bands: ["mid"]` — kills a widening to include `high`/`low` and pins the
**absence** of `scoreByBand`). The `rules.ts` numeric/boolean literals generate no independently
killable Stryker mutants — they are pinned by the `INPUT_HASH` guard, not mutation; the behavioural
ACs pin them observably.
**GREEN**: the five additive edits above; nothing in `sim.ts`.
**MUTATE**: scope Stryker to `dsl.ts` (`MOVES`) + `rules.ts` (the new `hiza-geri` spec object) +
`benchmark-config.ts` (version/hash, use a `:N-N` line **range** so a bare line number isn't
misparsed as a glob). `rm -rf .stryker-tmp .stryker-incremental.json` first; run **without**
`--incremental` for a definitive result. Confirm 100% on the changed lines.
**KILL MUTANTS**: strengthen only if a survivor appears; ask the human if a survivor's value is
ambiguous. **No `scoreByBand` reader in this move ⇒ the `ushiro-geri` inner-`?.` guard test is NOT
needed** (Slice 2 is a clean 6-reader add).
**REFACTOR**: none expected (additive mirror of the arsenal + sweep-okizeme pattern); assess via
`refactoring`, skip if no value.
**Done when**: AC-1…AC-7 green; full suite green (byte-identical for all non-`hiza-geri` paths);
`dsl.ts`/`rules.ts`/`benchmark-config.ts` mutation 100%; typecheck + lint + format clean; mutation
report reviewed; human approves commit.

### Slice 2: Bots can introspect `hiza-geri`'s frames via `rule("moves.hiza-geri.*")` — ✅ MERGED (PR #133)

**Value**: The bot author can read `hiza-geri`'s frames at runtime to write adaptive logic (e.g.
gate on `rule("moves.hiza-geri.reach")` to only commit the knee at point-blank spacing), the same as
every other move.
**Actor / Trigger / Outcome**: bot author / a bot document using
`{op:"rule", path:"moves.hiza-geri.reach"}` / `validate` accepts it and the interpreter returns the
canonical value (110000).
**Path**: bot DSL `rule(path)` → `dsl.ts` `ALLOWED_RULES` (derived from the field-readers) admits the
path → interpreter reads `CANONICAL_RULES.moves["hiza-geri"].<field>`.
**Production edits**:

1. `dsl.ts` (TCB) — **6** field-readers
   `moves.hiza-geri.{startup,active,recovery,score,reach,staminaCost}` in `RULE_READERS` (mirror the
   `empi`/`sweep` readers, `?.`/`?? 0` for the optional key), which flow into `ALLOWED_RULES` /
   `RulePath`. **No `knockdown` reader and no `scoreByBand` reader** (neither is ever exposed — even
   the sweep, the only other knockdown move, exposes exactly these 6) ⇒ a clean 6-reader add, no
   guard test.
2. `docs/spec.md` — `npm run gen:spec` (auto: the `moves.hiza-geri.*` rule-path list + the `rulePath`
   enum). The data-driven drift tests pin these. **No `CANONICAL_RULES` change ⇒ no version bump.**

**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.
**Acceptance criteria**: AC-8 … AC-10. **Present and confirm before code.**
**RED**: `validate-bot.test.ts` — AC-8 (add the 6 `moves.hiza-geri.*` paths to the accept table; add
`moves.hiza-geri.knockdown` **and** `moves.hiza-geri.bands` to the reject table);
`interpret-tick.test.ts` — AC-9 (6 reader-value rows: canonical `9/2/16/0/110000/40`, minimal-
sentinel `0`). **Note the `score` row is `["moves.hiza-geri.score", 0, 0]`** — canonical 0 (the knee
scores 0) and minimal 0, exactly like the existing `["moves.sweep.score", 0, 0]` row; both the `?.`
and `?? 0` mutants are still killed by the **minimal** column (an absent move returns `undefined ≠
0`), so no extra test is needed **for those two mutants**. The other five rows have distinct
non-zero canonical values, so a wrong-field read is caught.

> **Build correction (what actually shipped).** The prediction above missed one mutant: because
> `hiza-geri` is hyphenated, its reader uses **bracket** notation (`r.moves["hiza-geri"]`), which
> carries a `StringLiteral` mutant (`r.moves[""]`) that the **dot**-accessed `sweep` has not. With
> `score: 0`, `r.moves[""]?.score ?? 0` returns 0 — identical to the original in **both** the
> canonical (0) and minimal (0) columns, so that mutant **survived** the `.each` row. `hiza-geri` is
> the **only hyphenated move whose score is 0**, so it is the only score reader hitting this. Killed
> with a targeted guard test (mirroring the roundhouse `scoreByBand` guard) that configures
> `hiza-geri` with a **non-zero** score, pinning the reader to the `"hiza-geri"` key. Slice 2 thus
> shipped as **6 readers + 1 guard test** (not the predicted zero); `dsl.ts` reader lines mutation
> **100%** (24/24).
> `gen-spec.test.ts` / `spec-schema.test.ts` — AC-10 (data-driven drift goes RED on the reader add,
> green after regen).
> **GREEN**: the 6 readers + regen.
> **MUTATE**: scope Stryker to the new `dsl.ts` reader lines; expect path-string + `?? 0` mutants,
> killed by AC-8/AC-9. `rm -rf .stryker-tmp` first. Confirm `dsl.ts` 100%.
> **KILL MUTANTS / REFACTOR**: as Slice 1 (none expected).
> **Done when**: AC-8…AC-10 green; full suite green; `dsl.ts` mutation 100%; typecheck + lint + format
> clean; report reviewed; human approves commit.

> **Slice-count note:** Slices 1 + 2 MAY be merged into a single "fully-wired `hiza-geri`" PR, but
> the recommended path keeps them split, as `uraken` (#117/#118), `shuto` (#120/#121), `yoko-geri`
> (#123/#124), `ushiro-geri` (#126/#127), and `empi` (#129/#130) shipped — each is independently
> deployable and reviewable. **Your call.**

## Pre-PR Quality Gate

Before each PR:

1. Mutation testing — `mutation-testing` skill, scoped to the changed `dsl.ts` / `rules.ts` /
   `benchmark-config.ts` lines (`types.ts` is type-only; `sim.ts` untouched). `rm -rf .stryker-tmp`
   first.
2. Refactoring assessment — `refactoring` skill (expected: no change).
3. `npm run typecheck` + `npm run lint` + `npm run format:check` pass; `spec.md` regenerated and
   drift-clean.
4. On feature completion: update `docs/move-roster.md` (mark `hiza-geri` shipped, PR #) and
   `docs/STATUS.md`. This move **completes Batch 1** — record that the roster-wide
   no-Pareto-dominance property test + the `vulture`/`sweeper` gauntlet re-run are now the immediate
   next work.

---

_When both slices are merged, **archive** this file under `docs/archive/` (add a README index entry
under the existing "Batch-1 arsenal expansion" section) — **do not delete it**. The record also lives
in the PRs + `docs/move-roster.md`._
