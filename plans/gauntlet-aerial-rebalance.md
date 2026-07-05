# Plan: Gauntlet exercises aerial combat (air-actions Story 4)

**Branch**: feat/air-actions-s4-gauntlet-rebalance (Slice 2); per-slice branches below
**Status**: Active — CONFIRM gate (awaiting AC approval before any code)

## Goal

Weaponize rekka's dormant `tobi-geri` so the frozen gauntlet actually **exercises**
aerial combat — proven by a calibration lock that the jump-in **connects** on the
board — while keeping all 6 bots ∈ `[25%, 75%]`; and close the last officiating×air
gap (passivity × jump). This is the LAST air-actions slice; it closes the capability.

## Empirical grounding (measured 2026-07-05, current v18 board)

- **Current board is healthy** (all 6 ∈ `[25,75]`): jabber 47, rekka 61, zoner 40,
  grappler 52, sweeper 60, vulture 40.
- **rekka's `tobi-geri` is stone-dead** — its jump gate is `opponent.distance > 300000`,
  but bouts open at a ~286–290k gap and close inward, so the gate **never triggers**
  (`jumps = 0`). "Reachable-but-dormant," exactly as v18 shipped it.
- **Lowering the gate to `> 250000` weaponizes it**: rekka jumps off the opening gap
  (and after each yame reset), commits **191** `tobi-geri` over its 100 bouts, and
  **connects 182** of them for a **jodan ippon (3)** — the frozen foes set their high
  guard ~2 ticks too late (they block at tick 8; the strike resolves at tick 6, then
  lands per AC-2.2 connect-then-land). It connects in **100/100** bouts, spread across
  all 5 opponents (jabber 35, zoner 20, grappler 40, sweeper 20, vulture 67).
- **Board stays IN-BAND** after weaponization: jabber 37, rekka 59, zoner 40,
  grappler 64, sweeper 60, vulture 40. Biggest movers jabber −10 / grappler +12, both
  comfortably inside `[25,75]`.
- **The gate is insensitive in `[230k, ~285k]`** (identical results 230k–260k) — rekka
  only ever sees `distance > gate` at the opening/after-reset (~286k), so any value in
  that window fires the same. **Narrow-gating was NOT required** — the S2/S3
  "committal telegraphed move has no healthy niche" warning did not bite here.
- **⇒ AC-4.1's PRIMARY bar (really connects) is met; the documented fallback is NOT
  needed.** Recommended gate: **`> 250000`** (tobi-geri's own reach — a clean semantic;
  a minimal one-constant edit to the existing rule).
- **passivity × jump is emergent + correct** (sim.ts:1308–1318): the passivity clock
  zeroes on a **non-null strike outcome or a throw**. An air strike that _connects_
  registers as an active striker → non-null outcome → clock resets, exactly like a
  ground strike; a **bare jump** (or a whiffed air strike → null outcome) does NOT
  reset. No engine change — a characterization test.

## Acceptance Criteria

- [x] **AC-4.1 (tobi-geri really connects, band stays green).** A new calibration lock
      proves `tobi-geri` **connects (scores a jodan ippon) in ≥1 frozen-board bout** carried
      by rekka; a "guard bites" companion (dormant rekka) yields **0** such connects. The
      band guard (all 6 ∈ `[0.25, 0.75]`) and coverage guard (12/12) stay green. A new
      `BENCHMARK_VERSION` (v18→**v19**) + recomputed `INPUT_HASH` + regenerated `spec.md`
      version string + `docs/benchmark-gauntlet-v19.md`. _(Slice 2 — this branch; board
      37/59/40/64/60/40, all officiating locks still green, INPUT_HASH `4764cdd7…`. The
      `docs/benchmark-gauntlet-v19.md` board doc lands in Slice 3.)_
- [x] **AC-4.2 (passivity × jump).** A characterization test proves an air strike that
      **connects** zeroes the striker's passivity clock (engagement), while a **bare jump**
      does not — consistent with ground strikes, no engine change. (A whiffed air strike
      also does not reset — same as a ground whiff.)
- [ ] **AC-4.3 (capability close).** `docs/benchmark-gauntlet-v19.md` records the board +
      weaponization narrative + dogfood re-characterization; `docs/STATUS.md` item 5 gets the
      air-actions DONE build-log entry; all air-actions plans archived under `docs/archive/`
      (git mv + README); memory updated. `plans/` ends empty (directory removed).

## Slices

Every slice follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR. Load `tdd` + `testing` +
`mutation-testing` + `refactoring` (and `characterisation-tests` for Slice 1) before code.

### Slice 1 — passivity × jump characterization (AC-4.2) — DONE (PR #166)

**One sentence**: Pin that a connecting air strike counts as passivity engagement while a
bare jump does not.
**Value**: The platform maintainer gets a regression guard that the air-strike mechanic
keys the passivity clock correctly — the last officiating×air gap, closed.
**Path**: `runFight` (fixture air rules + fixture bots, a `passivity`-configured `match`)
→ per-fighter no-offense clock → observable via `self.passivityRemaining` reads and/or the
`fouls.*.passivity` tally in `FightResult`. **Benchmark-neutral** (fixtures only; no
`CANONICAL_RULES` / `benchmark-config` change ⇒ no `INPUT_HASH` flip ⇒ byte-identical
`npm run fight`).
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`,
`characterisation-tests`.
**Acceptance criteria**: In `run-fight.test.ts` (the air block, reusing the S2/S3
`airRules` fixture helpers): (a) a fighter that **only jumps** (bare jump, never air-strikes)
under `passivity` accrues its no-offense clock uninterrupted → it fouls at the limit (clock
NOT reset by the jump); (b) a fighter whose air strike **connects** has its passivity clock
**zeroed on the connect tick** (no foul it otherwise would have taken) — engagement; (c) a
**whiffed** air strike (out of reach / vacated band) does NOT reset (consistent with a
ground whiff). Observed through the public `runFight` result (`fouls` / a
`self.passivityRemaining`-gated reveal), never engine internals.
**RED**: The three characterization assertions above. Expectation: they pass on first run
(emergent). If any FAILS, that is a real finding → the minimal engine fix becomes this
slice's GREEN (I expect none). Mutator focus: the passivity reset predicate
`aOutcome !== null || aThrow !== null` (sim.ts:1317) — the air tests must fail if the air
outcome stops feeding it.
**GREEN**: Expected NONE (behavior already emergent). Any needed fix is minimal + air-path-local.
**MUTATE**: Confirm the new air tests kill a mutation of the passivity reset condition on the
air path (mutate `aOutcome !== null` → `false` and verify an air test fails). Characterization —
no new production mutants introduced; the value is regression coverage of the air path.
**KILL MUTANTS**: Strengthen any air assertion that a survivor exposes.
**REFACTOR**: Assess fixture-helper reuse only.
**Done when**: AC-4.2 met, byte-identical `npm run fight` confirmed, mutation reviewed, human approves.

### Slice 2 — weaponize rekka + `tobi-geri` connects-lock + v19 bump (AC-4.1) — DONE

**One sentence**: Lower rekka's jump gate so `tobi-geri` connects on the board, and lock it
in with a calibration guard + a version bump.
**Value**: The measuring instrument is proven to exercise aerial combat (the S3 "full real
integration" bar), and scores become v19-comparable.
**Path**: `bots/rekka.json` (jump rule constant `300000 → 250000`) → `tobi-geri` connects on
the frozen board → a new "tobi-geri adoption lock" in `gauntlet-calibration.test.ts` asserts
it → `benchmark-config.ts` `BENCHMARK_VERSION` v19 + recomputed `INPUT_HASH` →
`benchmark-config.test.ts` hash guard + `dogfood.test.ts` version pin + `spec.md` version
string all reconciled. **Atomic** — the bot-text change flips `INPUT_HASH`, and a dormant
rekka fails the new lock, so weaponization + lock + bump must land together or CI is red.
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.
**Acceptance criteria**:

1. **Connects lock (primary)** — an events-scan over the round-robin finds ≥1 bout where
   rekka scores a `tobi-geri` connect: a points delta **≥ 2** on a tick where rekka was
   airborne this-or-the-prior tick (AC-2.2), attributable to a committed `tobi-geri`
   (delta ≥ 2 excludes the +1 penalty-point confound). FAILS today (dormant rekka → 0).
2. **Guard bites** — the same scan on a dormant-rekka variant (jump gate back at 300000)
   yields **0** connects (proves the lock keys off the live jump-in, not vacuous).
3. **(Optional, mirrors officiating locks) field-read** — rekka references `self.posture`
   (the air-timing read) to gate the strike. Proposed for symmetry; drop if it reads as
   over-engineering vs. the coverage guard already checking the move reference.
4. Band guard green (all 6 ∈ `[0.25,0.75]` — measured: 37/59/40/64/60/40); coverage green
   (12/12; update the stale `(11/11)` title).
5. `BENCHMARK_VERSION = "v19"`, `INPUT_HASH` recomputed (the config guard prints the expected
   value on drift), `dogfood.test.ts` version pin updated, `spec.md` regenerated
   (`npm run gen:spec` — version string only; gauntlet internals are not in the spec).
   **RED**: Write the connects-lock (1) + guard-bites (2) FIRST — they fail against today's
   dormant rekka. Also expect the `benchmark-config` hash guard to go RED the moment rekka.json
   changes.
   **GREEN**: Edit `bots/rekka.json` jump gate `300000 → 250000`; bump `BENCHMARK_VERSION`;
   recompute + paste `INPUT_HASH`; update the dogfood version pin; regen `spec.md`; fix the
   coverage title. All guards green together.
   **MUTATE**: The connects-lock detection predicate (airborne-this-or-prior, delta ≥ 2, commit
   attribution) + the guard-bites counterfactual.
   **KILL MUTANTS**: Tighten the predicate against survivors (e.g., a mutant that drops the
   airborne condition and still passes ⇒ add a grounded-score negative).
   **REFACTOR**: Assess sharing the events-scan helper with Slice 1 if it emerged there.
   **Done when**: AC-4.1 met, full determinism/replay + calibration suites green, mutation
   reviewed, human approves.

### Slice 3 — capability close-out (AC-4.3)

**One sentence**: Document the v19 board, record air-actions as DONE, and archive the plans.
**Value**: The capability's build log + calibrated board are recorded; `plans/` is emptied.
**Path**: docs + memory only — no code, no version bump.
**Required implementation skills**: none (docs); `refactoring` judgment on the STATUS entry.
**Acceptance criteria**:

- `docs/benchmark-gauntlet-v19.md`: the v19 board (37/59/40/64/60/40), the weaponization
  narrative (gate 300000→250000, `tobi-geri` connects 100/100 for jodan ippon, gate
  insensitive in [230k,285k], no narrow-gating needed), coverage 12/12, and a dogfood
  re-characterization (run `npm run benchmark` on a sample bot; record win-rate/net).
- `docs/STATUS.md` item 5 rewritten as the air-actions DONE build-log entry (Stories 1–4:
  horizontal jump displacement, air-strike mechanic, air perception, canonical `tobi-geri`
  - `jumpXSpeed`, gauntlet rebalance) + the roadmap updated (air-actions off "not yet built";
    only the platform layer — KotH ladder / HTTP API / Pixi viewer — remains).
- All air-actions plans archived under `docs/archive/` via **history-preserving `git mv`**
  (aerial-mobility, air-strikes, precise-air-timing, air-actions-decisions,
  air-actions-stories, gauntlet-aerial-rebalance) + an `docs/archive/README.md` index entry.
  **Do NOT delete** (overrides the planning skill's "delete" footer). `plans/` ends empty
  ⇒ remove the directory.
- Memory (`air-actions-capability.md` + `MEMORY.md`) updated: capability COMPLETE.
  **RED/GREEN/MUTATE**: n/a (docs).
  **Done when**: AC-4.3 met, human approves.

## Open decisions for the CONFIRM gate

1. **Recommended gate = `> 250000`** (minimal one-constant edit; tobi-geri's reach; the
   [230k,285k] window is empirically equivalent). OK, or prefer a specific value?
2. **Slice 2 optional field-read guard** (rekka reads `self.posture`) — include for
   symmetry with the officiating locks, or omit (coverage guard already checks the move ref)?
3. **Slice order**: Slice 1 (neutral characterization) → Slice 2 (atomic bump) → Slice 3
   (docs). Slice 1 is independent (fixtures) so it goes first to keep main green pre-bump.

## Pre-PR Quality Gate (each slice)

1. Mutation testing (Slices 1–2). 2. Refactoring assessment. 3. Typecheck + lint + format.
2. Determinism/replay + calibration suites green. 5. `npm run fight` byte-identical (Slice 1).

## Non-negotiable invariants (unchanged)

- **TCB untouched** — no new DSL op; rekka is DATA (a constant edit); `MoveSpec`/readers unchanged.
- **Determinism / fixed-point** — no outcome-path float; INPUT_HASH pins the bump.
- **§11 spine untouched** — air strikes already ride `computeStrike`; passivity reset is emergent.

---

_Archive this file under `docs/archive/` at capability close (Slice 3) via `git mv` — do NOT delete._
