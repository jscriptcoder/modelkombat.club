# Plan: C9 Slice 4 — `mae-geri` (front kick)

**Branch**: feat/c9-mae-geri-front-kick
**Status**: Active
**Parent tracker**: `plans/c9-arsenal-split.md` (Slice 4 row + Status "per-technique pattern")

## Goal

The bot can throw `mae-geri` (front kick) — the **first single-band** technique
(`bands:["mid"]`, so the band gate now rejects **both** high and low) and the **first
2-point (*waza-ari*)** strike, with deeper reach than the punches (`reach > reverse`),
extending the hierarchy `jab < reverse < front`.

## Context — why this is one small PR

**Mechanical** via the per-technique pattern (Slices 2–3). The resolver (`sim.ts`) already
handles everything generically:
- It starts/scores any configured move via `rules.moves[action.move]` + the S1 `bandLegal`
  gate + the `spec !== undefined` inert guard.
- A hit awards `spec.score` directly (`sim.ts` `computeStrike`: `points: spec.score + bonus`),
  with **no cap** — so `score: 2` flows through with **zero code change** (the throw already
  scores 3 on its own path).
- `bandLegal` rejects any band not in `spec.bands` — so a single-band `["mid"]` move fizzling
  at **high** and **low** is the same gate S1/S3 already proved at `low`.

So `mae-geri`'s two "new" traits (single-band, 2-point) are **data exercised by tests**, not
new behavior. The only production edits are the same three as S3:

1. `types.ts` — `MoveId` union `+ "mae-geri"` (type-only ⇒ no runtime mutants).
2. `types.ts` — optional `"mae-geri"?: MoveSpec` key on `Rules.moves` (type-only).
3. `dsl.ts` — `"mae-geri"` into the `MOVES` allowlist (the TCB; the only mutable line).

`CANONICAL_RULES` is **not** touched (canonical wiring + per-move stamina re-tune is Slice 7);
`mae-geri`'s frames/reach/score live in a **test fixture**. An `attack` naming the
unconfigured move degrades to idle ⇒ every non-`mae-geri` path stays **byte-identical**.

## Acceptance Criteria

Proven by `runFight` (engine behavior) + `validate` (TCB allowlist). Each is an observable
score/accept assertion.

- [ ] **AC-1 (waza-ari — the 2-point strike):** Given `mae-geri` with `score:2` in reach, when
  a bot lands it at `mid`, then it scores **2** (the score field flows through the strike
  path — first strike worth >1).
- [ ] **AC-2 (single-band gate — high):** Given `mae-geri` with `bands:["mid"]`, when a bot
  attacks **high**, then it degrades to idle ⇒ score **0** (high is now illegal — new vs the
  punches, which allow high).
- [ ] **AC-3 (single-band gate — low):** same move, attack **low** ⇒ score **0**.
- [ ] **AC-4 (reach has a limit):** Given a gap **beyond `mae-geri`'s reach**, a `mae-geri`
  whiffs ⇒ score **0**.
- [ ] **AC-5 (inert when unconfigured):** Given a ruleset with **no** `mae-geri` key, a
  `mae-geri` attack ⇒ no spec ⇒ idle ⇒ score **0** (the `spec !== undefined` guard).
- [ ] **AC-6 (TCB allowlist):** `validate` **accepts** `{type:"attack", move:"mae-geri",
  band:"mid"}`, **and** accepts it at an out-of-band `band:"high"` (band-legality is a
  *runtime* concern; the validator only checks the move id + band are well-formed).

**Deferred (NOT this slice):** a cross-move reach-hierarchy test (`front` reaches a gap the
`reverse` cannot) — the reach-hierarchy *mechanic* was proven in S3; re-proving it on a new
move adds no engine coverage. The fixture still sets `reach > reverse` to document the
hierarchy intent. Kick-tier `staminaCost` and the master-inequality whiff-punishability are
**canonical-tuning concerns proven in S7** against `CANONICAL_RULES` relationship tests; the
fixture sets a longer `recovery` than the punches to mark the "more committed" intent.

## Slices

One slice = one PR. Follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR.

### Slice 4: Bot can throw `mae-geri` — a single-band, 2-point front kick

**Value**: The bot author gets a kick — the first `mid`-only technique (a hard read: it can't
threaten high or low) and the first *waza-ari* (2-point) reward, out-reaching the punches.
**Actor / Trigger / Outcome**: bot author / `{type:"attack", move:"mae-geri", band}` / the
fight scores **2** on a clean `mid` kick, **0** when high / low (out-of-band) / out-of-reach /
unconfigured.
**Path**: bot DSL `attack` → `dsl.ts` validate (MOVES admits `mae-geri`) → `sim.ts` `intake`
reads `rules.moves["mae-geri"]` → existing `bandLegal` + `affordable` + `spec !== undefined`
gates → `startAttack` → existing `computeStrike`/`applyStrike` (`points: spec.score`) →
`result.scores`. **No new resolver code** — contract widening + allowlist entry only.
**Required implementation skills**: before code, load `tdd`, `testing`, `mutation-testing`,
`refactoring`.
**Acceptance criteria**: AC-1 … AC-6 above. **Present to human and confirm before any code.**

**RED** — write these failing tests first (mirroring the S3 `gyaku-zuki` block in
`run-fight.test.ts` + the S3 validator-accept tests in `validate-bot.test.ts`):

- New `describe("runFight — mae-geri (the front kick: a single-band mid waza-ari technique)")`,
  a `kickRules(o)` fixture configuring the kick alongside the baseline strike:
  ```ts
  moves: {
    strike:     { startup: 4, active: 2, recovery: 6,  score: 1, reach: 250000 },
    "mae-geri": { startup: 4, active: 2, recovery: 12, score: 2, reach: 280000, bands: ["mid"] },
  }
  ```
  (`reach 280000 > reverse 200000`; `score 2`; `recovery 12 > 6` marks "more committed";
  `bands:["mid"]` is single-band.)
  - **AC-1**: `kickRules({ startGap: 200000 })` (within reach 280000), kick `mid` ⇒
    `scores.a === 2`.
  - **AC-2**: same, kick `high` ⇒ `scores.a === 0` (single-band gate).
  - **AC-3**: same, kick `low` ⇒ `scores.a === 0` (single-band gate).
  - **AC-4**: `kickRules({ startGap: 300000 })` (beyond reach 280000), kick `mid` ⇒ `0`.
  - **AC-5**: `getMockRules({ startGap: 200000 })` (no `mae-geri` key), kick `mid` ⇒ `0`.
- In `validate-bot.test.ts`: **AC-6** — `validate(getMockBotDoc({ default:{type:"attack",
  move:"mae-geri", band:"mid"} })).ok === true`; and the same at `band:"high"` ⇒ `true`.

Mutator-awareness: the only mutable production change is the `MOVES` allowlist string literal.
AC-6 kills `"mae-geri" → ""` (the move would be rejected); the suite kills `Set([...]) →
Set([])`. AC-1's `=== 2` (not `=== 1`) kills any accidental score-flattening and pins the
waza-ari value. AC-2 + AC-3 (both high and low fizzle) document the single-band gate.

**GREEN** — the three additive edits in Context above. Nothing in `sim.ts`.

**MUTATE** — scope Stryker to the changed `dsl.ts` `MOVES` line range (`types.ts` is
type-only; `sim.ts` untouched). Expect the allowlist string-literal + array-declaration
mutants, both killed by AC-6 + the suite. Confirm `dsl.ts` stays 100%.

**KILL MUTANTS** — strengthen only if a survivor appears (none expected). Ask the human if a
survivor's value is ambiguous.

**REFACTOR** — none expected (purely additive mirror of S2/S3). Assess via `refactoring`; skip
if no value.

**Done when**: AC-1…AC-6 green, full suite green (byte-identical for all non-`mae-geri`
paths), `dsl.ts` interpreter/allowlist mutation 100%, typecheck + lint clean, mutation report
reviewed, human approves commit.

## Pre-PR Quality Gate

1. Mutation testing — `mutation-testing` skill, scoped to `dsl.ts` (the only runtime change).
2. Refactoring assessment — `refactoring` skill (expected: no change).
3. `npm run typecheck` + `npm run lint` pass.
4. Update `plans/c9-arsenal-split.md`: mark Slice 4 ✅ (PR #), set Slice 5 (`mawashi-geri` +
   band-dependent `scoreByBand`) ▶ next.

---
*Delete this file when the slice is merged (its record lives in the PR + the split tracker).*
