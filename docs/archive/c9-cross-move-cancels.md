# Plan: C9 Slice 6 — cross-move cancels (rekka routes)

**Branch**: feat/c9-cross-move-cancels
**Status**: Active
**Parent tracker**: `plans/c9-arsenal-split.md` (Slice 6 row)

## Goal

Prove and lock in **cross-move cancel routes** — a hit-confirmed technique cancels into a
_different_ one (the rekka combo, e.g. jab → reverse → roundhouse) — and that the **no-feint /
connect-required** property holds across distinct moves (a whiff never opens the window).

## Context — a tests-only PROOF slice (no production change)

**Verified:** the C6 cancel machinery is fully **move-agnostic**, so cross-move routes already
work with **zero production change**:

- `intake` cancel path (sim.ts:364-378) reads `rules.moves[action.move]` generically and checks
  `(f.state.spec.cancelInto ?? []).includes(action.move)` + `bandLegal` — `cancelInto` is already
  `MoveId[]`, so it lists _distinct_ moves.
- `applyStrike` (sim.ts:594-616): a **hit** (596) and a **block** (611) open the cancel window;
  a **parry** and a **whiff** (null) never do → the no-feint property is structural.
- `advance` (931-932) decrements the window; a follow-up that connects re-opens it → 3-move
  chains already chain.

So this is **not** a RED-GREEN slice — there is no production code to drive. It is a
**behavior-proof slice**: permanent behavior-driven `runFight` tests (the `testing` skill) that
assert the _intended_ cross-move combo behavior and lock it against regression. They pass green
immediately because the generic machinery already satisfies the spec (the same situation as the
S3/S4 green-from-start `runFight` tests — **not** characterisation scaffolding, since the
behavior is specified, intended, and the tests are permanent). Canonical `cancelInto` routes are
deferred to S7; routes live in a **test fixture** here.

**If any test unexpectedly fails**, that is a genuine finding (an engine gap) and the slice
converts to RED-GREEN — flag it, don't paper over it.

## Acceptance Criteria

Proven by `runFight`, mirroring the C6 cancel timing (`startup 4 / active 2 / recovery 6`,
`cancelWindow 10`; an opener connects at tick 4, a cancel at tick 6 lands the follow-up at tick
10 — a fresh re-attack could not start before tick 12, landing ≥ 16).

- [ ] **AC-1 (cross-move cancel resolves):** A connecting `kizami-zuki` (jab) whose
      `cancelInto` includes `gyaku-zuki` cancels into the reverse during the jab's recovery; the
      reverse's active frame lands at tick 10 and **both** score ⇒ `scores.a === 2` (and
      `events[10].a.points === 2`, pinning the early cancel timing vs a fresh re-attack at ≥16).
- [ ] **AC-2 (no-feint — whiff never opens it):** The same jab thrown `high` into a croucher
      **whiffs** (vacated band) on its active frame, so no window opens; the tick-6 `gyaku-zuki`
      follow-up is ignored even though the opponent stands from tick 6 (a wrongly-enabled cancel
      would have hit at tick 10) ⇒ `scores.a === 0`.
- [ ] **AC-3 (route restriction):** With `kizami-zuki.cancelInto = ["gyaku-zuki"]`, a tick-6
      cancel attempt into `mawashi-geri` — a move that **is configured and in range** but is **not
      in the jab's route list** — is refused; the jab recovers normally ⇒ `scores.a === 1` (proving
      refusal is by route, not by unconfigured/inert or range).
- [ ] **AC-4 (3-move rekka chain):** `jab.cancelInto⊇[reverse]`, `reverse.cancelInto⊇[roundhouse]`;
      cancelling jab→reverse→roundhouse, each connecting and re-opening the window, scores **3**
      within the run (a non-chained sequence at these frames could reach at most 2) ⇒ `scores.a === 3`.

**Deferred (NOT this slice):** the canonical tuned `cancelInto` route table (lands in S7);
block-as-connect cross-move cancel (re-proves the C6 block trigger generically — skip);
parry-never-opens cross-move variant (re-proves C6 generically — skip; AC-2's whiff is the
no-feint proof).

## Slices

One slice = one PR. This slice has **no production code** — it is the behavior proof + fixture.

### Slice 6: Cross-move cancel routes resolve and preserve no-feint (proof)

**Value**: The bot author gets verified, regression-protected **combos** — hit-confirm a jab,
cancel into a reverse or a roundhouse — the rekka routes the arsenal was built for.
**Actor / Trigger / Outcome**: bot author / a connecting technique + a follow-up `attack` in its
`cancelInto` within `cancelWindow` / the recovery is interrupted into the follow-up and it scores
early; a whiffed opener never enables the cancel.
**Path**: bot DSL `attack` → `intake` cancel path (`cancelInto.includes` + `bandLegal` +
`spec !== undefined`, all existing) → `startAttack` follow-up → `computeStrike`/`applyStrike`
(re-opens the window on connect) → `result.scores`. **No production change.**
**Required implementation skills**: `testing` (behavior-driven tests + factories),
`mutation-testing` (validate the cancel machinery stays protected).

**Tests** (new `describe("runFight — cross-move cancels (rekka routes between distinct
techniques)")`, mirroring the C6 cancel block's helpers):

- `comboAtTicks(steps: { tick; move; band }[])` — a bot that throws a specific named `attack`
  at each given tick (idle otherwise), generalizing C6's `strikeAtTicks`.
- a local `crouchUntil(until)` (copied from the C6 block) for AC-2's whiff.
- `rekkaRules(o)` — fixture configuring `kizami-zuki` (`cancelInto:["gyaku-zuki"]`),
  `gyaku-zuki` (`cancelInto:["mawashi-geri"]`), `mawashi-geri`, all uniform frames
  `startup 4/active 2/recovery 6`, reach 250000, `bands:["high","mid"]`, `cancelWindow 10`,
  `startGap 200000`.
- AC-1 … AC-4 as above.

**No RED-GREEN** (no production code). **MUTATE**: scope Stryker to the existing cancel
machinery (`intake` cancel path + `applyStrike` cancel-open lines) to confirm the cross-move
tests keep those lines at 100% (expected — already covered by C6; the new tests reinforce the
cross-move case). **REFACTOR**: assess the new helpers only; none expected.

**Done when**: AC-1…AC-4 green, full suite green, the cancel machinery stays 100% under scoped
mutation, typecheck + lint clean, human approves commit.

## Pre-PR Quality Gate

1. Mutation testing — scoped to the cancel machinery (`sim.ts` intake cancel path + applyStrike).
2. Refactoring assessment — `refactoring` skill (new test helpers only).
3. `npm run typecheck` + `npm run lint` pass.
4. Update `plans/c9-arsenal-split.md`: mark Slice 6 ✅ (PR #), set Slice 7 (canonical wiring +
   retire `strike`) ▶ next — the C9 finale.

---

_Delete this file when the slice is merged (its record lives in the PR + the split tracker)._
