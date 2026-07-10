# Plan: King-challenge telemetry parity (`/fight` title block)

**Status:** ✅ IMPLEMENTED (2026-07-10) — **option (A) chosen: full parity**. Built via
TDD (RED→GREEN→MUTATE→KILL→REFACTOR); full suite green (1560), **100% mutation score** on
both changed regions, lint + prettier clean. Pending: commit approval → PR → archive.
**Date raised:** 2026-07-10
**Owner context:** followed a live dogfood where `bots/warden.json` (Claude Opus 4.8)
cleared the frozen **v19** gauntlet 6/6 authoring BLIND (spec + `/fight` only) and took
the empty throne (`title.outcome = "throne-empty-crowned"`).

## What was built (deviation from the drafted approach — for the better)

The drafted fix inlined the derivation in the handler and reused `toReportOpponent` on
`titleFight.perOpponent[0]` with an empty-guard. Implementation improved on both:

- **A pure sibling shaper, not an inline block.** Added `toTitleFightReport(BenchmarkResult)`
  → `{ winRate, net, wins, losses, draws, bouts, endReasons, degrade }` in
  `src/http/fight-report.ts` (next to `toReportOpponent`). The handler's `title` block is now
  just `{ outcome, ...toTitleFightReport(titleFight), seeds, incumbent }`. Derivation lives in a
  directly-unit-testable pure function — matching this repo's established pattern (the gauntlet
  shaper is unit-tested against a _synthetic_ `BenchmarkResult`, because draws are unrealizable
  through a real fight). This is what let a `draws:2` unit test kill the `losses` `- draws`
  arithmetic mutant that survived when the derivation was buried in the fight-running handler.
- **No `perOpponent[0]?` lookup / no empty-guard.** Every field derives from always-defined
  top-level aggregates; `endReasons` comes from `officiating.endedBy` (fully-keyed, all-zero for
  a mirror skip) instead of `perOpponent[0].endReasons` (undefined for a mirror). The mirror edge
  produces clean all-zero telemetry for free.

Files touched: `src/http/fight-report.ts` (+ `.test.ts`), `src/http/handle-fight.ts` (+ `.test.ts`).
TCB untouched (invariant #2); response change is purely additive (no consumer breaks — verified
`web/src/RingPage.tsx`, `api/fight.test.ts`, `docs/spec.md`).

---

## 1. Background — how we got here

warden cleared all six gauntlet opponents using ONLY `docs/spec.md` + the `/fight`
response (no engine/benchmark peeking). Final board: jabber 0.55 · rekka 0.70 · zoner 0.80 ·
grappler 1.00 · sweeper 1.00 · vulture 0.70. Strategy = archetype-adaptive dual-camp bot
(fast `gyaku` vs pokers, `mawashi`-high out-spacing vs closers, live `rusher`/`poker`
detection flags, crouch rekka's unreactable `tobi-geri`, and the keystone: **`mae-geri`
counter on parry** = guaranteed 3 pts, which took zoner 0.5→0.8). See memory
`gauntlet-clearability-open-question.md` (now RESOLVED) for the full strategy write-up.

**What made the blind clear tractable:** the `/fight` gauntlet report is RICH — per-opponent
`winRate` + `wins`/`losses`/`draws` + **`net`** + `passed` + **`endReasons`** (gap/time/senshu/
overtime), plus top-level **`degrade`** diagnostics. Those three bolded fields did the heavy
lifting (e.g. `degrade` exposed self-gassing = 1515 idle-degrades → the stamina fix;
`endReasons` revealed the _shape_ of each loss — jabber's all-overtime vs sweeper's all-gap).

---

## 2. The concern (user-raised)

To dethrone a King, a challenger must **clear the gauntlet AND beat the King in the same
submission**. Worry: once an LLM figures out how to clear the gauntlet, it will then tweak to
beat the King, and those tweaks may **regress gauntlet clearance** — an oscillation / whack-a-mole
where it can never satisfy both objectives at once and loses a previously-clean 6/6.

This is a **real multi-objective optimization hazard** (it happened repeatedly during warden's
26 iterations: fixing rushers broke pokers, jump-in fixed zoner but broke grappler/rekka, etc.).
What made it _survivable_ on the gauntlet: (a) the **full board prints on every submission**, so a
regression is immediately visible and rejectable, and (b) mechanistic reasoning about which changes
are orthogonal vs trade-offs. The oscillation is only tractable when feedback is rich enough to see
the trade-offs.

---

## 3. THE FINDING (confirmed against the implementation)

**The King challenge does NOT return the same telemetry as the gauntlet — it returns strictly
less.** The rich data is _computed_ but _discarded_ before serialization.

### Evidence

- The title fight is a FULL benchmark (same engine call as the gauntlet):
  `src/http/handle-fight.ts:165` — `const titleFight = benchmark({ bot, gauntlet: [current.champion], seeds, ... })`
- A `BenchmarkResult` carries everything (`src/engine/benchmark.ts:55-64`): `netPoints`, `winRate`,
  `wins`, `draws`, `totalFights`, `perOpponent: OpponentScore[]`, `officiating`, **`degrade`**.
  Each `OpponentScore` (`src/engine/benchmark.ts:36-43`) has `netPoints`, `wins`, `draws`, `fights`,
  **`endReasons`**.
- BUT the response only surfaces two scalars from it (`src/http/handle-fight.ts:190-200`):
  ```ts
  title: {
    outcome: dethroned ? "crowned" : "king-retained",
    winRate: titleFight.winRate,      // ← the ONLY performance signal
    seeds,
    bouts: titleFight.totalFights,    // ← just the count
    incumbent: incumbentOf(current),  // name/model/handle — identity, NOT behavior
  }
  ```
- Compare the gauntlet per-opponent contract (`src/http/fight-report.ts:12-21`): `winRate`, `wins`,
  `losses`, `draws`, **`net`**, `passed`, **`endReasons`** + top-level **`degrade`**.

### What the King challenge drops (vs the gauntlet)

- **`net`** (`titleFight.netPoints` / `perOpponent[0].netPoints`) — close (9-11) vs blown out (2-20)?
- **`endReasons`** (`perOpponent[0].endReasons`) — losing on gap/time/senshu/overtime = the SHAPE of the problem.
- **`degrade`** (`titleFight.degrade`) — the self-diagnostic (am I self-gassing / degrading vs the King?).
- **`wins`/`losses`/`draws`** split — only the derived `winRate` scalar survives.

### Why this makes the oscillation WORSE than on the gauntlet (compounding factors)

1. The King is an **unknown** opponent revealed by a **single scalar** (`winRate`), and its **doc is
   never exposed** — `incumbentOf` is explicit: "identity only, never the doc" (`handle-fight.ts:104-111`).
   (The gauntlet's six were reverse-engineerable from rich per-opponent telemetry; the King is not.)
2. **Every King probe must first clear the gauntlet** — no clear, no title fight
   (`handle-fight.ts:145`: `if (!report.cleared) return json(report)`). So you can't build a cheap
   specialized King-prober; each experiment is a full gauntlet-clearer, and the only King-signal is
   `winRate`. Learning about the King is _coupled_ to maintaining clearance, on the lowest signal.
3. Dethrone is strictly `titleFight.winRate > 0.5` (`handle-fight.ts:176`); `net` is NOT a King-fight
   tiebreak (unlike the gauntlet metric), so a 10-10 title fight just retains the King with zero texture.

Net: a challenger tuning against a lone `winRate` (no `net`/`endReasons`/`degrade`) must **guess why**
it's losing to the King — and blind guesses are exactly what regress a clean 6/6. The user's worry is
well-founded _given the current serialization_.

---

## 4. The fix (surgical — data already exists, TCB untouched)

Surface the King fight at **gauntlet fidelity**. The `title` block currently discards
`titleFight.perOpponent[0]` and `titleFight.degrade`; add them.

**Change site:** `src/http/handle-fight.ts:190-200` (the `title` object).

**Approach:** reuse the existing shaper. `src/http/fight-report.ts:40-49` has `toReportOpponent`
(an `OpponentScore → { winRate, wins, losses, net, passed, endReasons }` mapper). Export it (or a
King-appropriate variant without `passed`, since the King gate is `>0.5` not the per-member gate) and
apply it to `titleFight.perOpponent[0]`. Also include `titleFight.degrade`.

Proposed shape (final naming TBD in TDD):

```ts
title: {
  outcome: dethroned ? "crowned" : "king-retained",
  winRate: titleFight.winRate,
  net: titleFight.netPoints,        // NEW
  wins: titleFight.wins,            // NEW
  losses: titleFight.totalFights - titleFight.wins - titleFight.draws, // NEW
  draws: titleFight.draws,          // NEW
  bouts: titleFight.totalFights,
  seeds,
  endReasons: titleFight.perOpponent[0]?.endReasons, // NEW (single-opponent benchmark ⇒ [0])
  degrade: titleFight.degrade,      // NEW — the self-diagnostic
  incumbent: incumbentOf(current),
}
```

Guard the `perOpponent[0]` access: the no-mirror rule skips a byte-clone challenger
(`benchmark` → winRate 0, empty `perOpponent`), so `perOpponent` can be empty — handle undefined.

### TDD seams (tests already exist)

- `src/http/handle-fight.test.ts` — already exercises the crown/retain/dethrone paths with an
  injected in-memory throne + fixed `freshSeeds` (see lines 1-60 for fixtures: `loadBot`, `dummy`,
  `mover`, pinned seeds). Add assertions that the `title` block on an occupied throne carries
  `net`/`endReasons`/`degrade`/win-loss-draw.
- `src/http/fight-report.ts` — if `toReportOpponent` is exported/reused, add/extend its unit tests.
- RED first: assert the new fields are present & correct on a `king-retained` and a `crowned` outcome.

### Acceptance criteria

- On an OCCUPIED throne, the `/fight` `title` block includes `net`, `wins`, `losses`, `draws`,
  `endReasons`, and `degrade` for the title fight — same fidelity a gauntlet opponent gets.
- Empty-throne bootstrap (`throne-empty-crowned`, `handle-fight.ts:150-160`) unchanged (no title fight ran).
- Failed-gate path unchanged (`handle-fight.ts:145`).
- No-mirror empty-`perOpponent` case handled (no crash; sensible empty `endReasons`).
- `npm run typecheck` + `npm test` green. Update `api/fight.test.ts` / contract docs if the response
  contract is snapshotted anywhere. Consider whether `docs/spec.md` "Submitting" section or any
  published response-contract doc needs the enriched title shape (regenerate with `npm run gen:spec`
  if the generator covers it — it may not).

---

## 5. Design decision — RESOLVED

**Human chose (A) — full parity** (2026-07-10). Rationale carried over: make the King challenge
as debuggable as the gauntlet, remove the asymmetry, keep clear-then-dethrone tractable and the
ladder turning. The King's _doc_ stays hidden either way (scouting-by-behavior only); this change
only enriches the challenger's OWN result telemetry. (Option B — deliberate opacity — was declined.)

---

## 6. Deeper open question (out of scope for this fix, worth a separate note)

Even with perfect telemetry: is every valid King **dethronable by SOME gauntlet-clearer**? The
gauntlet calibration guarantees inter-bot balance (`[25,75]` round-robin) but asserts NOTHING about
King-dethronability. An un-dethronable King stalls the ladder. This is a game-theoretic invariant the
platform would have to test for deliberately (King-turnover as a first-class property). No amount of
`/fight` richness fixes it. Flag for a future design conversation; relates to the "clearer exists"
property in `gauntlet-clearability-open-question.md`.

---

## 7. Empirical test available (optional, dogfood)

warden currently holds the v19 throne. The clean experiment for the whole concern: author a
CHALLENGER that must clear the gauntlet AND dethrone warden, driving only off `/fight`. Would reveal
in practice (a) how thin the current King telemetry really is, (b) whether the loop converges or
oscillates and loses clearance, (c) whether a sitting King is even dethronable by a fresh clearer.
Best run AFTER deciding §5 (so we test the intended telemetry).

---

## Key files

- `src/http/handle-fight.ts` — the `/fight` orchestration (gate → throne → title fight). Fix site: the
  `title` block ~L190-200. Title fight computed L165; gate L145; dethrone predicate L176; `incumbentOf`
  (identity-only) L104-111.
- `src/http/fight-report.ts` — gauntlet report shaper; `toReportOpponent` (L40-49) is the reuse target.
- `src/engine/benchmark.ts` — `BenchmarkResult` (L55-64) / `OpponentScore` (L36-43): the rich data
  already computed for the title fight.
- `src/http/handle-fight.test.ts` — TDD seam (injected throne + fixed seeds).
- `bots/warden.json` — the reigning champion / reference clearer.
- `docs/DESIGN.md` — KotH section (where stance B would be documented).
- Memory: `gauntlet-clearability-open-question.md` (RESOLVED — strategy write-up + gotchas).
