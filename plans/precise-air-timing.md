# Plan: Precise air timing (air-actions Story 3)

**Branch**: `feat/air-actions-s3-self-y-vy`
**Status**: Active

Story 3 of the air-actions capability (`plans/air-actions-stories.md` split candidate
3). Resolved design: `plans/air-actions-decisions.md` §S3 (air perception); hardened
AC-3.1 in the stories doc. **`self.posture` already shipped in Story 2 Slice 2** (the
minimum read to time an air strike), so this story is precisely the two remaining
self-reads: **`self.y`** (height) + **`self.vy`** (vertical velocity, sign = motion
direction).

## Goal

A bot can read its own vertical motion — height and velocity — to time an air strike
precisely: strike at the apex, or gate it to the descent (`self.vy < 0`).

## Scope

- **In:** two new live, zero-delay static `FIELD_READERS` — `self.y` (≥ 0) and
  `self.vy` (sign convention: `> 0` rising / `< 0` falling / `0` at apex).
  `SelfState` gains `y` + `vy`; `viewFor` populates them (y from the fighter's live
  `y`; vy from the airborne / air-attacking state, sentinel `0` grounded); the
  `FieldPath` union + `ALLOWED_FIELDS` + interpreter grow by two; `docs/spec.md`
  regenerated (field-path list + JSON-schema field enum).
- **Out:** nothing deferred — this closes the air-perception surface. (`self.vx` is
  NOT added: no AC demands it — YAGNI.)

## Benchmark

**Neutral — no version bump.** A field reader is a read surface, NOT an `INPUT_HASH`
input (only `CANONICAL_RULES` / `MATCH` / bot texts are). `npm run fight` is
byte-identical (sentinel reads when no arc); the only drift is `docs/spec.md`'s
field-path list + JSON-schema enum (regenerated). `INPUT_HASH` / `BENCHMARK_VERSION`
stay `a23c05f9…` / `v18`. No gauntlet-bot change (field reads don't trip the
calibration COVERAGE guard — that gate is `CANONICAL_RULES.moves` only). Mirrors the
Slice-2 `self.posture` precedent exactly.

## Acceptance Criteria

Hardened **AC-3.1** (minus the already-shipped `self.posture` clause):

- [x] **Sign convention.** `self.vy > 0` while rising, `< 0` while falling, `0` at the
      apex — a bot gating its air strike on `self.vy < 0` connects ONLY on the
      descending half of the arc (and does not strike while rising / at apex).
- [x] **Height, live.** `self.y ≥ 0` reads the fighter's true arc height at decision
      time (zero delay), `0` when grounded.
- [x] **Grounded sentinels.** Not airborne ⇒ `self.y = 0` and `self.vy = 0`.
- [x] **Air-attacking carries vy.** A fighter mid-air-strike (the air-attacking state)
      reads its live `self.vy` too (the derivation covers airborne AND air-attacking).
- [x] **Absent-arc byte-identical.** No jump physics configured ⇒ sentinel reads ⇒ a
      `self.vy`/`self.y`-gated bot decides identically to a plain bot ⇒ replay
      byte-identical to baseline.
- [x] **Allowlist + interpreter.** Both paths accepted by `ALLOWED_FIELDS`; a
      non-allowlisted `self.*` path still rejected; `dsl.ts` interpreter stays 100%.
- [x] **No version bump.** `INPUT_HASH` / `BENCHMARK_VERSION` unchanged (drift tests
      green); `docs/spec.md` regenerated (field surfaces only).

## Slices

Every slice follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR. No production code without
a failing test. Before code changes, load `tdd`, `testing`, `mutation-testing`,
`refactoring`. Present the ACs and **confirm before writing any code**.

### Slice 1: A bot reads `self.y` + `self.vy` to time its descent

**Value**: Finer air-strike control — a bot strikes only while descending (`self.vy <
0`) or judges its height, instead of counting ticks with `mem`. Closes the
air-perception surface.

**Actor / Trigger / Outcome**: the bot author — a rule gated on `self.vy < 0` (or
`self.y`) fires — observably, the fighter's air strike lands only on the arc's
descending half; the reads are live and sentinel-`0` when grounded.

**Path**: `SelfState` gains `y` + `vy` (types.ts) → `viewFor` populates
`self.y = self.y` (live) and `self.vy = (airborne | air-attacking) ? st.vy : 0`
(sentinel 0 grounded) → `FieldPath` union + `FIELD_READERS` + `ALLOWED_FIELDS` grow by
two (dsl.ts) → the interpreter serves them via the existing `FIELD_READERS[n.path]`
path → `npm run gen:spec` regenerates the field surfaces. **Skipped:** `self.vx`
(no AC); any opponent `vy` (design: composes from posture/attacking already).

**Required implementation skills**: `tdd`, `testing`, `mutation-testing`,
`refactoring`.

**RED** — behaviour tests via `runFight` / the interpret-tick reader table
(mutation-aware): a descent-gated bot (`self.vy < 0 → attack`) strikes only on ticks
past the apex, never while rising/at apex (the sign convention, read across the arc);
`self.y` reads the true non-zero height mid-arc and `0` grounded; `self.vy` reads `0`
grounded (sentinel); an **air-attacking** fighter still reads its live `self.vy`
(pins the second `||` disjunct); a `self.vy`/`self.y`-gated bot in a no-`jumpXSpeed`,
no-`air`-move config is byte-identical to a plain bot; `ALLOWED_FIELDS` accepts both
paths, rejects a bogus `self.altitude`. **RED honesty (Slice-2 gotcha #8):** a
`Record<FieldPath,…>` reader can't RED by omission (compile error) — wire
`viewFor.self.{y,vy} = 0` SENTINELS first (compiles), let the behavioural tests fail
on the constants, then triangulate the real derivation at GREEN. Pre-empt mutants: the
vy `||` (drop either disjunct ⇒ air-attacking or airborne reads 0), the conditional
sentinel (`? st.vy : 0`), the sign at apex (vy `=== 0`), the two equality checks
(`kind === "airborne"` / `=== "air-attacking"`).

**GREEN** — minimum code: the two `SelfState` fields; the two `viewFor` derivations;
the two `FieldPath` + `FIELD_READERS` entries; the interpret-tick + validate-bot
enumeration rows; regen `docs/spec.md`.

**MUTATE / KILL / REFACTOR**: Stryker on the changed `viewFor` derivation + the two
readers (single `--mutate "sim.ts:A-B,dsl.ts:C-D"` — comma-separated ranges in ONE
flag, per Slice-5 gotcha #19); target changed-line 100%; kill the `||`-disjunct and
sign survivors. Refactor: none expected (mirrors `self.posture`).

**Done when**: all ACs met, mutation report reviewed, typecheck + lint + format clean,
full suite green with `INPUT_HASH` / `BENCHMARK_VERSION` UNCHANGED (`npm run fight`
byte-identical), human approves commit.

**DELIVERED (2026-07-05):** `SelfState` gained `y` + `vy`; `viewFor` populates
`self.y = self.y` (live) and `self.vy = (airborne || air-attacking) ? st.vy : 0`;
two `FieldPath` + `FIELD_READERS` entries; `docs/spec.md` regenerated (field-path
list + JSON-schema enum only — no scoring change ⇒ `INPUT_HASH`/`BENCHMARK_VERSION`
UNCHANGED at `v18`). **Arc offset gotcha:** `events[t].a.y` is the END-of-tick
height, but a bot's `self.y` at tick `t` reads the height ENTERING tick `t` =
`events[t-1].a.y` — behavioural tests must assert reachability contrasts (apex 24000
gate fires / 30000 never) or ordering (rising gate fires strictly before falling),
NOT exact `events[t].a.y == read`. **Mutation gotcha:** `(airborne||air-attacking) ?
st.vy : 0` — the `ConditionalExpression → true` mutant (always `st.vy`) makes a
GROUNDED read `undefined` (grounded states have no `vy`), which every `< 0` gate
misses (both `undefined<0` and `0<0` are false); killed by a grounded `self.vy >= 0`
gate that MUST fire (`0>=0` true, `undefined>=0` false). The air-attacking `||`
disjunct is observable via a `mem` TRACKER (`set`, no `do`, fires while locked mid-
strike) that records a descent read and reveals it in a post-landing move. Mutation
**11/11 (100%)**; 1204 tests green. Four CLI bot test `state` factories + the two
interpret-tick/validate factories needed `y:0, vy:0` defaults (SelfState grew).

## Pre-PR Quality Gate

1. Mutation testing on the changed regions (100% changed-line; equivalents documented).
2. Refactoring assessment.
3. `npm run typecheck` + `npm run lint` + `npm run format:check` clean; `npm test` green.
4. Confirm `CANONICAL_RULES` / `BENCHMARK_VERSION` / `INPUT_HASH` UNCHANGED (`npm run
fight` byte-identical); the only diff is `docs/spec.md`'s field surfaces.

---

_At air-actions capability close, **archive** this plan (with the shared air-actions
design records) under `docs/archive/` via history-preserving `git mv` + a README entry
— **do NOT delete** (project convention overrides the planning skill's delete footer)._
