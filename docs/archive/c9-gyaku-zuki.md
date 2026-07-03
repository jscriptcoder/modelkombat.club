# Plan: C9 Slice 3 — `gyaku-zuki` (reverse punch)

**Branch**: feat/c9-gyaku-zuki-reverse
**Status**: Active
**Parent tracker**: `plans/c9-arsenal-split.md` (Slice 3 row + Status "per-technique pattern")

## Goal

The bot can throw a second punch — `gyaku-zuki` (reverse punch): a longer-range,
more-committed `high·mid` strike worth 1 — establishing the **reach hierarchy**
`kizami-zuki (jab) < gyaku-zuki (reverse)` so spacing becomes a real choice between two
punches.

## Context — why this is one small PR

This is **mechanical** via the per-technique pattern established by Slice 2 (`kizami-zuki`,
PR #68). The resolver (`sim.ts`) already starts/scores **any** configured move generically
through `rules.moves[action.move]` + the Slice-1 `bandLegal` gate + the `spec !== undefined`
inert guard — so **this slice adds ZERO resolver code**. The only production edits are:

1. `types.ts` — extend the `MoveId` union: `… | "gyaku-zuki"` (type-only ⇒ no runtime mutants).
2. `types.ts` — add the optional `"gyaku-zuki"?: MoveSpec` key to `Rules.moves` (type-only).
3. `dsl.ts` — add `"gyaku-zuki"` to the `MOVES` allowlist (line ~121 — **the TCB**; the only
   mutable production line in this slice).

Everything else is the test fixture + `runFight` behavior tests + validator-accept tests.
The jab numbers are NOT touched and `gyaku-zuki` is NOT wired into `CANONICAL_RULES` — that
is Slice 7. New-move frames/reach live in a **test fixture** (mirrors how S2 kept the jab in
a fixture).

## Acceptance Criteria

Behaviour proven by `runFight` (engine behavior) + `validate` (TCB allowlist). Vague
criteria are not acceptable — each is an observable score/accept assertion.

- [ ] **AC-1 (it works):** Given a ruleset configuring `gyaku-zuki` within reach, when a bot
      lands it at `mid`, then it scores **1**.
- [ ] **AC-2 (band gate, reused from S1):** Given `gyaku-zuki` with `bands:["high","mid"]`,
      when a bot attacks `low`, then it degrades to idle ⇒ score **0**.
- [ ] **AC-3 (THE reach hierarchy — the distinctive new behavior):** Given `jab reach <
reverse reach`, at a gap **beyond the jab's reach but within the reverse's**, a
      `kizami-zuki` whiffs (score **0**) while a `gyaku-zuki` from the same gap hits (score
      **1**).
- [ ] **AC-4 (the reverse still has a limit):** Given a gap **beyond `gyaku-zuki`'s own
      reach**, a `gyaku-zuki` whiffs ⇒ score **0**.
- [ ] **AC-5 (inert when unconfigured):** Given a ruleset with **no** `gyaku-zuki` key, a
      `gyaku-zuki` attack references an unconfigured move ⇒ no spec ⇒ idle ⇒ score **0** (the
      `spec !== undefined` guard — like sweep/throw/jab).
- [ ] **AC-6 (TCB allowlist):** `validate` **accepts** a bot whose action is
      `{type:"attack", move:"gyaku-zuki", band:"mid"}`, **and** accepts it at an out-of-band
      `band:"low"` (band-legality is a _runtime_ concern; the validator only checks the move id +
      band are well-formed).

**Deferred (NOT this slice):** higher `staminaCost` and the "longer recovery is
whiff-punishable per the master inequality" property are **canonical-tuning concerns proven
in S7** against `CANONICAL_RULES` relationship tests (the engine's generic recovery
whiff-punishability is already proven by earlier capabilities; re-proving it on a fixture for
one new move adds no engine coverage). The fixture still sets a longer `recovery` than the jab
to document the "more committed" design intent. See the CONFIRM note below — if you want a
fixture-level whiff-punish test in this slice, we add it; default is to defer.

## Slices

One slice = one PR (this whole technique). Follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR.

### Slice 3: Bot can throw `gyaku-zuki`, establishing reach `jab < reverse`

**Value**: The bot author gets a second, longer-range punch — the first real spacing choice
_between two strikes_ (poke with the fast short jab vs commit the longer reverse).
**Actor / Trigger / Outcome**: bot author / a bot returns `{type:"attack",
move:"gyaku-zuki", band}` / the fight scores 1 on a clean reverse, 0 when out-of-band /
out-of-reach / unconfigured, and the reverse reaches gaps the jab cannot.
**Path**: bot DSL `attack` → `dsl.ts` validate (MOVES allowlist admits `gyaku-zuki`) →
`sim.ts` `intake` reads `rules.moves["gyaku-zuki"]` → existing `bandLegal` + `affordable` +
`spec !== undefined` gates → `startAttack` → existing `computeStrike`/`applyStrike` resolution
→ `result.scores`. **No new resolver code** — only the contract widening + allowlist entry.
**Required implementation skills**: before code, load `tdd`, `testing`, `mutation-testing`,
`refactoring`.
**Acceptance criteria**: AC-1 … AC-6 above. **Present to human and confirm before any code.**

**RED** — write these failing tests first (mirroring the S2 jab block in
`run-fight.test.ts` + the S2 validator-accept tests in `validate-bot.test.ts`):

- In a new `describe("runFight — gyaku-zuki (the reverse punch: a longer-reach high·mid
technique)")`, a `reverseRules(o)` fixture configuring **all three** punches so the hierarchy
  is testable at one gap:
  ```ts
  moves: {
    strike:        { startup: 4, active: 2, recovery: 6,  score: 1, reach: 250000 },
    "kizami-zuki": { startup: 4, active: 2, recovery: 6,  score: 1, reach: 150000, bands: ["high","mid"] },
    "gyaku-zuki":  { startup: 4, active: 2, recovery: 10, score: 1, reach: 200000, bands: ["high","mid"] },
  }
  ```
  (reach `150000 < 200000`; the reverse's `recovery: 10 > 6` marks the "more committed" trait.)
  - **AC-1**: `reverseRules({ startGap: 120000 })`, bot attacks `gyaku-zuki` `mid` ⇒
    `scores.a === 1`.
  - **AC-2**: same, attack `low` ⇒ `scores.a === 0` (band gate).
  - **AC-3 (hierarchy)**: `reverseRules({ startGap: 175000 })` (between 150000 and 200000):
    a `kizami-zuki` `mid` bot ⇒ `0`; a `gyaku-zuki` `mid` bot ⇒ `1`. (Two assertions / two
    runs at the **same gap** — this is the headline.)
  - **AC-4**: `reverseRules({ startGap: 220000 })` (beyond 200000), `gyaku-zuki` `mid` ⇒ `0`.
  - **AC-5 (inert)**: `getMockRules({ startGap: 120000 })` (no `gyaku-zuki` key), `gyaku-zuki`
    `mid` ⇒ `0`.
- In `validate-bot.test.ts`: **AC-6** — `validate(getMockBotDoc({ default:{type:"attack",
move:"gyaku-zuki", band:"mid"} })).ok === true`; and the same at `band:"low"` ⇒ `true`.

Mutator-awareness: the only mutable production change is the `MOVES` allowlist string literal.
The validator-accept test (AC-6) kills `"gyaku-zuki" → ""` (the move would be rejected); the
broad suite kills the `Set([...]) → Set([])` ArrayDeclaration mutant (every move rejected).
AC-3's two same-gap runs kill any reach off-by-one that would collapse the hierarchy.

**GREEN** — the three additive edits in Context above (union member, optional `Rules.moves`
key, `MOVES` allowlist entry). Nothing in `sim.ts`.

**MUTATE** — scope Stryker to the changed `dsl.ts` `MOVES` line (`types.ts` changes are
type-only ⇒ no runtime mutants; `sim.ts` is untouched ⇒ out of scope). Expect the
allowlist string-literal + array-declaration mutants, both killed by AC-6 + the suite.

**KILL MUTANTS** — strengthen only if a survivor appears (none expected; the TCB allowlist is
fully covered by S2's pattern). Ask the human if a survivor's value is ambiguous.

**REFACTOR** — none expected (purely additive mirror of S2). Assess via `refactoring`; skip if
no value.

**Done when**: AC-1…AC-6 green, full suite green (byte-identical for all non-`gyaku-zuki`
paths — absent key ⇒ inert), `dsl.ts` interpreter/allowlist mutation 100%, typecheck + lint
clean, mutation report reviewed, human approves commit.

## Pre-PR Quality Gate

1. Mutation testing — `mutation-testing` skill, scoped to `dsl.ts` (the only runtime change).
2. Refactoring assessment — `refactoring` skill (expected: no change).
3. `npm run typecheck` + `npm run lint` pass.
4. Update `plans/c9-arsenal-split.md`: mark Slice 3 ✅ (PR #), set Slice 4 (`mae-geri`) ▶ next.

---

_Delete this file when the slice is merged (its record lives in the PR + the split tracker).
If `plans/` is then empty, delete the directory._
